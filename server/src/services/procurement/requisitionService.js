/**
 * Requisition Service
 * Handles all requisition-related business logic
 */

import { query, transaction } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';
import { emitWorkflowEvent, rawQuery } from '../system/workflowService.js';
import procurementPolicyService from './procurementPolicyService.js';

class RequisitionService {
  constructor() {
    this.domainEventService = domainEventService;
  }

  /**
   * Create a new requisition
   */
  /**
   * Normalize circle/cluster from site and ensure cluster_id is a valid clusters.id
   * (avoids accidental telecom circle id in cluster_id).
   */
  /**
   * Lowest active purchase price from supplier_items + item_prices, else item standard/estimated cost.
   */
  async getReferenceUnitPrice(itemId, quantity = 1, client = null) {
    const run = client ? client.query.bind(client) : query;
    const qty = Math.max(Number(quantity) || 1, 0.01);

    const priceRes = await run(
      `
      SELECT MIN(p) AS unit_price FROM (
        SELECT si.unit_price::numeric AS p
        FROM supplier_items si
        WHERE si.item_id = $1
          AND COALESCE(si.unit_price, 0) > 0
          AND (si.valid_from IS NULL OR si.valid_from <= CURRENT_DATE)
          AND (si.valid_to IS NULL OR si.valid_to >= CURRENT_DATE)
        UNION ALL
        SELECT ip.unit_price::numeric AS p
        FROM item_prices ip
        WHERE ip.item_id = $1
          AND ip.price_type = 'PURCHASE'
          AND ip.is_active = true
          AND COALESCE(ip.unit_price, 0) > 0
          AND (ip.valid_from IS NULL OR ip.valid_from <= CURRENT_DATE)
          AND (ip.valid_to IS NULL OR ip.valid_to >= CURRENT_DATE)
          AND (ip.min_quantity IS NULL OR ip.min_quantity <= $2)
          AND (ip.max_quantity IS NULL OR ip.max_quantity >= $2)
      ) priced
      `,
      [itemId, qty]
    );

    const fromMaster = Number(priceRes.rows[0]?.unit_price || 0);
    if (fromMaster > 0) return fromMaster;

    const itemRes = await run(
      `SELECT standard_cost, last_purchase_price, estimated_price FROM items WHERE id = $1`,
      [itemId]
    );
    if (itemRes.rows.length === 0) return 0;
    const row = itemRes.rows[0];
    for (const field of ['standard_cost', 'last_purchase_price', 'estimated_price']) {
      const v = Number(row[field] || 0);
      if (v > 0) return v;
    }
    return 0;
  }

  async resolveLineUnitPrice(line, client = null) {
    const quantity = Math.max(parseFloat(line.quantity) || 0, 0);
    if (line.item_id) {
      const ref = await this.getReferenceUnitPrice(line.item_id, quantity || 1, client);
      if (ref > 0) return ref;
    }
    return Math.max(parseFloat(line.unit_price) || 0, 0);
  }

  async resolveRequisitionGeo(client, data) {
    const out = { ...data };

    if (out.site_id) {
      const siteRes = await client.query(
        'SELECT circle_id, cluster_id FROM sites WHERE id = $1',
        [out.site_id]
      );
      if (siteRes.rows.length > 0) {
        const site = siteRes.rows[0];
        if (site.circle_id != null) out.circle_id = site.circle_id;
        if (site.cluster_id != null) out.cluster_id = site.cluster_id;
      }
    }

    if (out.cluster_id != null && out.cluster_id !== '') {
      const clusterRes = await client.query(
        'SELECT id, circle_id FROM clusters WHERE id = $1',
        [out.cluster_id]
      );
      if (clusterRes.rows.length === 0) {
        const circleAsCluster = Number(out.cluster_id);
        const fallback = await client.query(
          `SELECT id FROM clusters WHERE circle_id = $1 ORDER BY code LIMIT 1`,
          [circleAsCluster]
        );
        if (fallback.rows.length > 0) {
          out.circle_id = circleAsCluster;
          out.cluster_id = fallback.rows[0].id;
        } else {
          throw new Error(
            'Invalid cluster. Re-select the cluster for your circle, or pick the site again from Search.'
          );
        }
      } else {
        const clusterCircleId = clusterRes.rows[0].circle_id;
        if (out.circle_id != null && Number(out.circle_id) !== Number(clusterCircleId)) {
          out.circle_id = clusterCircleId;
        } else if (out.circle_id == null) {
          out.circle_id = clusterCircleId;
        }
      }
    }

    return out;
  }

  async createRequisition(requisitionData, userId) {
    try {
      const result = await transaction(async (client) => {
        const geo = await this.resolveRequisitionGeo(client, requisitionData);
        // Generate requisition number using circle/cluster context
        const requisitionNumber = await this.generateRequisitionNumber(client, geo.circle_id || null, geo.cluster_id || null);
        
        // Insert requisition
        const requisitionQuery = `
          INSERT INTO requisitions (
            requisition_number, title, description, requester_id, department_id,
            project_id, site_id, needed_by_date, circle_id, cluster_id, created_by, updated_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;
        
        const requisitionValues = [
          requisitionNumber,
          geo.title,
          geo.description,
          geo.requester_id,
          geo.department_id,
          geo.project_id || null,
          geo.site_id || null,
          geo.needed_by_date || null,
          geo.circle_id || null,
          geo.cluster_id || null,
          userId,
          userId
        ];
        
        const requisitionResult = await client.query(requisitionQuery, requisitionValues);
        const requisition = requisitionResult.rows[0];
        
        // Insert requisition lines
        if (requisitionData.lines && requisitionData.lines.length > 0) {
          for (let i = 0; i < requisitionData.lines.length; i++) {
            const line = requisitionData.lines[i];
            const lineQuery = `
              INSERT INTO requisition_lines (
                requisition_id, line_number, item_id, item_code, item_name,
                item_description, quantity, unit_of_measure, unit_price, total_price,
                specifications, brand, model, needed_by_date, manufacturer, spare_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `;

            const quantity = parseFloat(line.quantity) || 0;
            const unitPrice = await this.resolveLineUnitPrice(line, client);
            const totalPrice = quantity * unitPrice;

            const lineValues = [
              requisition.id,
              i + 1,
              line.item_id || null,
              line.item_code || null,
              line.item_name,
              line.item_description || null,
              quantity,
              line.unit_of_measure || 'PCS',
              unitPrice,
              totalPrice,
              line.specifications || null,
              line.brand || null,
              line.model || null,
              line.needed_by_date || null,
              line.manufacturer || null,
              line.spare_type || null
            ];
            
            await client.query(lineQuery, lineValues);
          }
        }

        await this.calculateRequisitionTotals(requisition.id, client);

        const header = await client.query(
          `SELECT total_amount, total_quantity FROM requisitions WHERE id = $1`,
          [requisition.id]
        );
        const linesRes = await client.query(
          `SELECT * FROM requisition_lines WHERE requisition_id = $1 ORDER BY line_number`,
          [requisition.id]
        );

        return {
          ...requisition,
          ...header.rows[0],
          lines: linesRes.rows
        };
      });
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get requisition by ID
   */
  async getRequisitionById(requisitionId, userId) {
    const queryText = `
      SELECT
        r.id, r.requisition_number, r.title, r.description, r.requester_id,
        r.department_id, r.project_id, r.site_id, r.needed_by_date,
        r.circle_id, r.cluster_id,
        r.status, r.workflow_instance_id, r.submitted_at, r.submitted_by,
        r.approved_at, r.approved_by, r.rejected_at, r.rejected_by,
        r.rejection_reason, r.total_amount, r.total_quantity,
        r.email_attachment_path, r.email_attachment_name, r.email_attachment_mime, r.email_attachment_size,
        r.created_at, r.updated_at, r.created_by, r.updated_by,
        u.email as requester_email,
        u.first_name || ' ' || u.last_name as requester_name,
        a.first_name || ' ' || a.last_name as approver_name,
        d.name as department_name,
        s.name as site_name,
        s.site_code as site_code,
        json_agg(
          json_build_object(
            'id', rl.id,
            'line_number', rl.line_number,
            'item_id', rl.item_id,
            'item_code', rl.item_code,
            'item_name', rl.item_name,
            'item_description', rl.item_description,
            'quantity', rl.quantity,
            'unit_of_measure', rl.unit_of_measure,
            'unit_price', rl.unit_price,
            'total_price', rl.total_price,
            'specifications', rl.specifications,
            'brand', rl.brand,
            'model', rl.model,
            'needed_by_date', rl.needed_by_date,
            'manufacturer', rl.manufacturer,
            'spare_type', rl.spare_type,
            'is_approved', rl.is_approved,
            'approved_quantity', rl.approved_quantity,
            'approved_unit_price', rl.approved_unit_price,
            'company_code', it.company_code
          ) ORDER BY rl.line_number
        ) FILTER (WHERE rl.id IS NOT NULL) as lines
      FROM requisitions r
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN users a ON r.approved_by = a.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN sites s ON r.site_id = s.id
      LEFT JOIN requisition_lines rl ON r.id = rl.requisition_id
      LEFT JOIN items it ON rl.item_id = it.id
      WHERE r.id = $1
      GROUP BY r.id, u.email, u.first_name, u.last_name, a.first_name, a.last_name, d.name, s.name, s.site_code
    `;

    const result = await query(queryText, [requisitionId]);

    if (result.rows.length === 0) {
      throw new Error('Requisition not found');
    }

    const requisition = result.rows[0];

    // Visibility is governed by route middleware (canViewRequisition)

    // Ensure totals are calculated if not already present
    if (requisition.total_amount === null || requisition.total_amount === 0) {
      await this.calculateRequisitionTotals(requisitionId);
      // Re-fetch to get updated totals
      const updatedResult = await query(queryText, [requisitionId]);
      return updatedResult.rows[0];
    }

    return requisition;
  }

  /**
   * Get vendor options for an approved requisition's lines
   */
  async getVendorOptions(requisitionId) {
    // Fetch requisition lines with item_id
    const linesRes = await query(
      `SELECT rl.id as line_id, rl.item_id, rl.item_name, rl.quantity, rl.unit_of_measure
       FROM requisition_lines rl
       JOIN requisitions r ON r.id = rl.requisition_id
       WHERE rl.requisition_id = $1 AND r.status = 'approved'`,
      [requisitionId]
    );

    const results = [];

    for (const line of linesRes.rows) {
      if (!line.item_id) {
        results.push({
          line_id: line.line_id,
          item_id: null,
          item_name: line.item_name,
          quantity: line.quantity,
          unit_of_measure: line.unit_of_measure,
          candidates: [],
          recommended_supplier_id: null
        });
        continue;
      }

      // Supplier candidates from supplier_items
      const suppliersRes = await query(
        `SELECT si.supplier_id, s.name as supplier_name, si.unit_price, si.currency, si.lead_time_days
         FROM supplier_items si
         JOIN suppliers s ON s.id = si.supplier_id
         WHERE si.item_id = $1
           AND (si.valid_from IS NULL OR si.valid_from <= CURRENT_DATE)
           AND (si.valid_to IS NULL OR si.valid_to >= CURRENT_DATE)`,
        [line.item_id]
      );

      let candidates = suppliersRes.rows.map(r => ({
        supplier_id: r.supplier_id,
        supplier_name: r.supplier_name,
        unit_price: Number(r.unit_price || 0),
        currency: r.currency || 'INR',
        lead_time_days: r.lead_time_days || 0,
        price_list_id: null
      }));

      // Enhance from item_prices (prefer quantity range match)
      const priceRes = await query(
        `SELECT ip.supplier_id, ip.unit_price, ip.currency, ip.price_list_id
         FROM item_prices ip
         WHERE ip.item_id = $1
           AND ip.price_type = 'PURCHASE'
           AND ip.is_active = true
           AND (ip.valid_from IS NULL OR ip.valid_from <= CURRENT_DATE)
           AND (ip.valid_to IS NULL OR ip.valid_to >= CURRENT_DATE)
           AND (ip.min_quantity IS NULL OR ip.min_quantity <= $2)
           AND (ip.max_quantity IS NULL OR ip.max_quantity >= $2 OR ip.max_quantity IS NULL)`,
        [line.item_id, Number(line.quantity) || 1]
      );

      const priceMap = new Map();
      for (const p of priceRes.rows) {
        // Prefer lowest price per supplier
        const cur = priceMap.get(p.supplier_id);
        if (!cur || Number(p.unit_price) < cur.unit_price) {
          priceMap.set(p.supplier_id, {
            supplier_id: p.supplier_id,
            unit_price: Number(p.unit_price),
            currency: p.currency || 'INR',
            price_list_id: p.price_list_id
          });
        }
      }

      // Merge into candidates, add missing suppliers from price list
      const candMap = new Map(candidates.map(c => [c.supplier_id, c]));
      for (const [sid, pv] of priceMap.entries()) {
        const existing = candMap.get(sid);
        if (existing) {
          // Use lower of supplier_items and item_prices
          if (pv.unit_price < existing.unit_price || existing.unit_price === 0) {
            existing.unit_price = pv.unit_price;
            existing.currency = pv.currency;
            existing.price_list_id = pv.price_list_id;
          }
        } else {
          // Add new candidate from price list (need supplier name)
          const sRes = await query('SELECT name FROM suppliers WHERE id = $1', [sid]);
          candMap.set(sid, {
            supplier_id: sid,
            supplier_name: sRes.rows[0]?.name || `Supplier ${sid}`,
            unit_price: pv.unit_price,
            currency: pv.currency,
            lead_time_days: 0,
            price_list_id: pv.price_list_id
          });
        }
      }

      candidates = Array.from(candMap.values()).sort((a, b) => a.unit_price - b.unit_price);
      const recommended_supplier_id = candidates[0]?.supplier_id || null;

      results.push({
        line_id: line.line_id,
        item_id: line.item_id,
        item_name: line.item_name,
        quantity: Number(line.quantity) || 0,
        unit_of_measure: line.unit_of_measure,
        candidates,
        recommended_supplier_id
      });
    }

    return results;
  }

  /**
   * Get all requisitions with filters
   */
  async getRequisitions(filters = {}, userId) {
    const { whereClause, queryParams, nextParamIndex } = this.#buildFilterWhereClause(filters, userId);

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM requisitions r
      ${whereClause}
    `;
    
    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);
    
    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const offset = (page - 1) * limit;
    
    // Main query
    const mainQuery = `
      SELECT
        r.id, r.requisition_number, r.title, r.description, r.requester_id,
        r.department_id, r.project_id, r.site_id, r.needed_by_date,
        r.circle_id, r.cluster_id,
        r.status, r.workflow_instance_id, r.submitted_at, r.submitted_by,
        r.approved_at, r.approved_by, r.rejected_at, r.rejected_by,
        r.rejection_reason, r.total_amount, r.total_quantity,
        r.created_at, r.updated_at, r.created_by, r.updated_by,
        u.email as requester_email,
        u.first_name || ' ' || u.last_name as requester_name,
        d.name as department_name,
        s.name as site_name
      FROM requisitions r
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN sites s ON r.site_id = s.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${nextParamIndex} OFFSET $${nextParamIndex + 1}
    `;
    
    const mainParams = [...queryParams, limit, offset];
    const result = await query(mainQuery, mainParams);
    
    return {
      requisitions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Export requisitions with filters (no pagination)
   */
  async exportRequisitions(filters = {}, userId) {
    const { whereClause, queryParams } = this.#buildFilterWhereClause(filters, userId);

    const exportQuery = `
      SELECT
        r.id, r.requisition_number, r.title, r.description, r.requester_id,
        r.department_id, r.project_id, r.site_id, r.needed_by_date,
        r.circle_id, r.cluster_id,
        r.status, r.workflow_instance_id, r.submitted_at, r.submitted_by,
        r.approved_at, r.approved_by, r.rejected_at, r.rejected_by,
        r.rejection_reason, r.total_amount, r.total_quantity,
        r.created_at, r.updated_at, r.created_by, r.updated_by,
        u.email as requester_email,
        u.first_name || ' ' || u.last_name as requester_name,
        d.name as department_name,
        s.name as site_name
      FROM requisitions r
      LEFT JOIN users u ON r.requester_id = u.id
      LEFT JOIN departments d ON r.department_id = d.id
      LEFT JOIN sites s ON r.site_id = s.id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT 5000
    `;

    const result = await query(exportQuery, queryParams);
    return result.rows;
  }

  /**
   * Internal helper to build WHERE clause and params for requisition filters
   */
  #buildFilterWhereClause(filters = {}, userId) {
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;
    
    // Add filters
    if (filters.search) {
      whereConditions.push(`(r.title ILIKE $${paramIndex} OR r.requisition_number ILIKE $${paramIndex})`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    if (filters.status) {
      whereConditions.push(`r.status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }
    
    if (filters.department_id) {
      whereConditions.push(`r.department_id = $${paramIndex}`);
      queryParams.push(filters.department_id);
      paramIndex++;
    }
    
    if (filters.requester_id) {
      whereConditions.push(`r.requester_id = $${paramIndex}`);
      queryParams.push(filters.requester_id);
      paramIndex++;
    }

    if (filters.circle_id) {
      whereConditions.push(`r.circle_id = $${paramIndex}`);
      queryParams.push(filters.circle_id);
      paramIndex++;
    }

    if (filters.cluster_id) {
      whereConditions.push(`r.cluster_id = $${paramIndex}`);
      queryParams.push(filters.cluster_id);
      paramIndex++;
    }

    // Restrict visibility of draft PRs: only creator or requester can see
    whereConditions.push(`(r.status <> 'draft' OR r.created_by = $${paramIndex} OR r.requester_id = $${paramIndex + 1})`);
    queryParams.push(userId, userId);
    paramIndex += 2;

    // Exclude PRs that have PO generated (system-level flag)
    if (filters.exclude_with_po) {
      whereConditions.push(`r.is_po_generated = false`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    return { whereClause, queryParams, nextParamIndex: paramIndex };
  }

  /**
   * Update requisition
   */
  async updateRequisition(requisitionId, updateData, userId) {
    try {
      const result = await transaction(async (client) => {
        // Update requisition
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;
        
        if (updateData.title !== undefined) {
          updateFields.push(`title = $${paramIndex}`);
          updateValues.push(updateData.title);
          paramIndex++;
        }
        
        if (updateData.description !== undefined) {
          updateFields.push(`description = $${paramIndex}`);
          updateValues.push(updateData.description);
          paramIndex++;
        }
        
        if (updateData.department_id !== undefined) {
          updateFields.push(`department_id = $${paramIndex}`);
          updateValues.push(updateData.department_id);
          paramIndex++;
        }
        
        if (updateData.project_id !== undefined) {
          updateFields.push(`project_id = $${paramIndex}`);
          updateValues.push(updateData.project_id);
          paramIndex++;
        }
        
        if (updateData.site_id !== undefined) {
          updateFields.push(`site_id = $${paramIndex}`);
          updateValues.push(updateData.site_id);
          paramIndex++;
        }
        
        if (updateData.needed_by_date !== undefined) {
          updateFields.push(`needed_by_date = $${paramIndex}`);
          updateValues.push(updateData.needed_by_date);
          paramIndex++;
        }
        
        updateFields.push(`updated_at = NOW()`);
        updateFields.push(`updated_by = $${paramIndex}`);
        updateValues.push(userId);
        paramIndex++;
        
        updateValues.push(requisitionId);
        
        const updateQuery = `
          UPDATE requisitions 
          SET ${updateFields.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING *
        `;
        
        const updateResult = await client.query(updateQuery, updateValues);
        
        if (updateResult.rows.length === 0) {
          throw new Error('Requisition not found');
        }
        
        // Update lines if provided
        if (updateData.lines) {
          // Delete existing lines
          await client.query('DELETE FROM requisition_lines WHERE requisition_id = $1', [requisitionId]);
          
          // Insert new lines
          for (let i = 0; i < updateData.lines.length; i++) {
            const line = updateData.lines[i];
            const lineQuery = `
              INSERT INTO requisition_lines (
                requisition_id, line_number, item_id, item_code, item_name,
                item_description, quantity, unit_of_measure, unit_price, total_price,
                specifications, brand, model, needed_by_date, manufacturer, spare_type
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            `;

            const quantity = parseFloat(line.quantity) || 0;
            const unitPrice = await this.resolveLineUnitPrice(line, client);
            const totalPrice = quantity * unitPrice;

            const lineValues = [
              requisitionId,
              i + 1,
              line.item_id || null,
              line.item_code || null,
              line.item_name,
              line.item_description || null,
              quantity,
              line.unit_of_measure || 'PCS',
              unitPrice,
              totalPrice,
              line.specifications || null,
              line.brand || null,
              line.model || null,
              line.needed_by_date || null,
              line.manufacturer || null,
              line.spare_type || null
            ];
            
            await client.query(lineQuery, lineValues);
          }
        }

        // Calculate totals for the updated requisition
        await this.calculateRequisitionTotals(requisitionId, client);

        // Get updated requisition
        const updatedRequisition = await this.getRequisitionById(requisitionId, userId);

        return updatedRequisition;
      });
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Submit requisition for approval
   * Status flow: draft → pending_approval
   */
  async submitRequisition(requisitionId, userId) {
    try {
      const result = await transaction(async (client) => {
        const pre = await client.query(
          'SELECT requester_id, total_amount FROM requisitions WHERE id = $1 FOR UPDATE',
          [requisitionId]
        );
        if (pre.rows.length === 0) {
          throw new Error('Requisition not found');
        }
        const requesterId = pre.rows[0].requester_id;
        const totalAmount = Number(pre.rows[0].total_amount || 0);

        await procurementPolicyService.assertEligible(client, requesterId, {
          amount: totalAmount,
          category: 'other',
          actorUserId: userId
        });

        // Enforce attachment presence before submit
        const att = await client.query('SELECT email_attachment_path FROM requisitions WHERE id = $1', [requisitionId]);
        const path = att.rows[0]?.email_attachment_path;
        if (process.env.REQUIRE_PR_EMAIL_ATTACHMENT === 'true' && !path) {
          throw new Error('Email PDF attachment is required before submitting PR');
        }
        const updateQuery = `
          UPDATE requisitions
          SET status = 'pending_approval',
              submitted_at = NOW(),
              submitted_by = $1,
              updated_at = NOW(),
              updated_by = $1
          WHERE id = $2 AND status = 'draft'
          RETURNING *
        `;

        const result = await client.query(updateQuery, [userId, requisitionId]);

        if (result.rows.length === 0) {
          throw new Error('Requisition not found or cannot be submitted');
        }

        const requisition = result.rows[0];

        await procurementPolicyService.reserveForDocument(client, requesterId, {
          referenceType: 'requisition',
          referenceId: requisitionId,
          amount: totalAmount,
          category: 'other',
          actorUserId: userId
        });

        // Get complete requisition data with JOINs for workflow
        const completeDataQuery = `
          SELECT 
            r.id, r.requisition_number, r.title, r.description, r.requester_id,
            r.department_id, r.project_id, r.site_id, r.total_amount,
            r.email_attachment_path, r.email_attachment_name,
            u.first_name || ' ' || u.last_name as requester_name,
            d.name as department_name,
            s.name as site_name
          FROM requisitions r
          LEFT JOIN users u ON r.requester_id = u.id
          LEFT JOIN departments d ON r.department_id = d.id
          LEFT JOIN sites s ON r.site_id = s.id
          WHERE r.id = $1
        `;
        
        const completeDataResult = await client.query(completeDataQuery, [requisitionId]);
        const completeRequisition = completeDataResult.rows[0];

        // Create workflow instance for approval
        let workflowResult = null;
        try {
          // Resolve featureId dynamically for 'purchase_requisition'
          const featureRes = await rawQuery(
            `SELECT id FROM features WHERE name = 'purchase_requisition' LIMIT 1`
          );
          const resolvedFeatureId = featureRes.rows[0]?.id;
          if (!resolvedFeatureId) {
            throw new Error('purchase_requisition feature not found');
          }

          workflowResult = await emitWorkflowEvent({
            featureId: resolvedFeatureId,
            event: 'onStatusChange',
            entityId: requisitionId,
            entityType: 'requisition',
            data: {
              requisitionId: requisitionId,
              requisitionNumber: completeRequisition.requisition_number,
              departmentId: completeRequisition.department_id,
              departmentName: completeRequisition.department_name,
              siteId: completeRequisition.site_id,
              siteName: completeRequisition.site_name,
              projectId: completeRequisition.project_id,
              projectName: completeRequisition.project_id ? `Project ${completeRequisition.project_id}` : null,
              totalAmount: parseFloat(completeRequisition.total_amount || 0),
              requesterId: completeRequisition.requester_id,
              requesterName: completeRequisition.requester_name,
              title: completeRequisition.title,
              description: completeRequisition.description
            },
            actorId: userId
          });

          // Update requisition with workflow instance ID
          if (workflowResult && workflowResult.instanceId) {
            await client.query(
              'UPDATE requisitions SET workflow_instance_id = $1 WHERE id = $2',
              [workflowResult.instanceId, requisitionId]
            );
          }
        } catch (workflowError) {
          console.warn('Workflow creation failed, continuing without workflow:', workflowError.message);
          // Don't fail the submission if workflow creation fails
        }

        // Publish domain event
        await this.domainEventService.publishEvent('PROCUREMENT.REQUISITION.SUBMITTED', requisitionId, 'requisition', {
          requisition_id: requisitionId,
          requester_id: completeRequisition.requester_id,
          total_amount: parseFloat(completeRequisition.total_amount || 0),
          department_id: completeRequisition.department_id,
          requisition_number: completeRequisition.requisition_number,
          title: completeRequisition.title,
          submitted_by: userId,
          submitted_at: new Date(),
          workflow_instance_id: workflowResult?.instanceId
        });

        // Attach workflow info for client awareness
        const response = result.rows[0];
        if (!workflowResult?.instanceId) {
          response._workflow = { bound: false, message: 'No active workflow binding found for purchase_requisition; submission will not create approval tasks.' };
        } else {
          response._workflow = { bound: true, instance_id: workflowResult.instanceId };
        }

        return response;
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Approve requisition
   * Status flow: pending_approval → approved
   */
  async approveRequisition(requisitionId, userId, approvalData = {}) {
    try {
      const result = await transaction(async (client) => {
        const updateQuery = `
          UPDATE requisitions
          SET status = 'approved',
              approved_at = NOW(),
              approved_by = $1,
              updated_at = NOW(),
              updated_by = $1
          WHERE id = $2 AND status = 'pending_approval'
          RETURNING *
        `;

        const result = await client.query(updateQuery, [userId, requisitionId]);

        if (result.rows.length === 0) {
          throw new Error('Requisition not found or cannot be approved');
        }

        const requisition = result.rows[0];

        await procurementPolicyService.commitDocument(client, 'requisition', requisitionId, userId);

        // Update line items if approval data provided
        if (approvalData.line_approvals && approvalData.line_approvals.length > 0) {
          for (const line of approvalData.line_approvals) {
            const lineUpdateQuery = `
              UPDATE requisition_lines
              SET is_approved = true,
                  approved_quantity = $1,
                  approved_unit_price = $2
              WHERE id = $3 AND requisition_id = $4
            `;

            await client.query(lineUpdateQuery, [
              line.approved_quantity,
              line.approved_unit_price,
              line.line_id,
              requisitionId
            ]);
          }
        }

        // Update workflow instance if it exists
        if (requisition.workflow_instance_id) {
          try {
            // Import the actOnInstance function dynamically to avoid circular imports
            const { actOnInstance } = await import('../system/workflowService.js');
            await actOnInstance({
              instanceId: requisition.workflow_instance_id,
              actorId: userId,
              action: 'approve',
              comment: approvalData.comment || 'Approved'
            });
          } catch (workflowError) {
            console.warn('Workflow update failed:', workflowError.message);
          }
        }

        // Publish domain event
        await this.domainEventService.publishEvent('PROCUREMENT.REQUISITION.APPROVED', requisitionId, 'requisition', {
          requisition_id: requisitionId,
          requester_id: requisition.requester_id,
          requisition_number: requisition.requisition_number,
          approved_by: userId,
          approved_at: new Date(),
          approval_data: approvalData,
          workflow_instance_id: requisition.workflow_instance_id
        });

        return result.rows[0];
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Reject requisition
   * Status flow: pending_approval → rejected
   */
  async rejectRequisition(requisitionId, userId, rejectionReason) {
    try {
      const result = await transaction(async (client) => {
        const updateQuery = `
          UPDATE requisitions
          SET status = 'rejected',
              rejected_at = NOW(),
              rejected_by = $1,
              rejection_reason = $2,
              updated_at = NOW(),
              updated_by = $1
          WHERE id = $3 AND status = 'pending_approval'
          RETURNING *
        `;

        const result = await client.query(updateQuery, [userId, rejectionReason, requisitionId]);

        if (result.rows.length === 0) {
          throw new Error('Requisition not found or cannot be rejected');
        }

        const requisition = result.rows[0];

        await procurementPolicyService.releaseDocument(client, 'requisition', requisitionId, userId);

        // Update workflow instance if it exists
        if (requisition.workflow_instance_id) {
          try {
            const { actOnInstance } = await import('../system/workflowService.js');
            await actOnInstance({
              instanceId: requisition.workflow_instance_id,
              actorId: userId,
              action: 'reject',
              comment: rejectionReason
            });
          } catch (workflowError) {
            console.warn('Workflow update failed:', workflowError.message);
          }
        }

        // Publish domain event
        await this.domainEventService.publishEvent('PROCUREMENT.REQUISITION.REJECTED', requisitionId, 'requisition', {
          requisition_id: requisitionId,
          requester_id: requisition.requester_id,
          requisition_number: requisition.requisition_number,
          rejected_by: userId,
          rejected_at: new Date(),
          rejection_reason: rejectionReason,
          workflow_instance_id: requisition.workflow_instance_id
        });

        return result.rows[0];
      });

      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete requisition
   */
  async deleteRequisition(requisitionId, userId) {
    try {
      const result = await transaction(async (client) => {
        // Check if requisition can be deleted
        const checkQuery = `
          SELECT status FROM requisitions WHERE id = $1
        `;
        
        const checkResult = await client.query(checkQuery, [requisitionId]);
        
        if (checkResult.rows.length === 0) {
          throw new Error('Requisition not found');
        }
        
        const requisition = checkResult.rows[0];
        
        if (requisition.status !== 'draft') {
          throw new Error('Only draft requisitions can be deleted');
        }
        
        // Delete requisition lines first (CASCADE should handle this, but explicit for safety)
        await client.query('DELETE FROM requisition_lines WHERE requisition_id = $1', [requisitionId]);
        
        // Delete requisition
        const deleteQuery = `
          DELETE FROM requisitions WHERE id = $1
        `;
        
        const deleteResult = await client.query(deleteQuery, [requisitionId]);
        
        if (deleteResult.rowCount === 0) {
          throw new Error('Failed to delete requisition');
        }
        
        // Publish domain event
        await this.domainEventService.publishEvent('requisition.deleted', requisitionId, 'requisition', {
          requisition_id: requisitionId,
          deleted_by: userId,
          deleted_at: new Date()
        });
        
        return { success: true, message: 'Requisition deleted successfully' };
      });
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Withdraw requisition (soft delete)
   */
  async withdrawRequisition(requisitionId, userId) {
    return transaction(async (client) => {
      const { rows } = await client.query(
        'SELECT id, status, workflow_instance_id FROM requisitions WHERE id = $1 FOR UPDATE',
        [requisitionId]
      );
      if (rows.length === 0) {
        throw new Error('Requisition not found');
      }
      const requisition = rows[0];
      if (!['draft', 'submitted', 'pending_approval'].includes(requisition.status)) {
        throw new Error('Only draft or submitted requisitions can be withdrawn');
      }

      const { rows: upd } = await client.query(
        `UPDATE requisitions
         SET status = 'withdrawn',
             updated_at = NOW(),
             updated_by = $2
         WHERE id = $1
         RETURNING *`,
        [requisitionId, userId]
      );

      await procurementPolicyService.releaseDocument(client, 'requisition', requisitionId, userId);

      if (requisition.workflow_instance_id) {
        try {
          const { actOnInstance } = await import('../system/workflowService.js');
          await actOnInstance({
            instanceId: requisition.workflow_instance_id,
            actorId: userId,
            action: 'withdraw',
            comment: 'Withdrawn by requester'
          });
        } catch (e) {
          console.warn('Workflow withdraw failed:', e.message);
        }
      }

      await this.domainEventService.publishEvent(
        'PROCUREMENT.REQUISITION.WITHDRAWN',
        requisitionId,
        'requisition',
        {
          requisition_id: requisitionId,
          withdrawn_by: userId,
          workflow_instance_id: requisition.workflow_instance_id
        }
      );

      return upd[0];
    });
  }

  /**
   * Calculate requisition totals
   */
  async calculateRequisitionTotals(requisitionId, client = null) {
    const queryFunction = client ? client.query.bind(client) : query;

    const updateQuery = `
      UPDATE requisitions
      SET
        total_amount = (
          SELECT COALESCE(SUM(total_price), 0)
          FROM requisition_lines
          WHERE requisition_id = $1
        ),
        total_quantity = (
          SELECT COALESCE(SUM(quantity), 0)
          FROM requisition_lines
          WHERE requisition_id = $1
        )
      WHERE id = $1
    `;

    await queryFunction(updateQuery, [requisitionId]);
  }

  /**
   * Generate requisition number
   */
  async generateRequisitionNumber(client = null, circleId = null, clusterId = null) {
    const queryFunction = client ? client.query.bind(client) : query;

    let sql;
    let params;
    if (circleId !== null || clusterId !== null) {
      sql = 'SELECT generate_requisition_number($1,$2) as requisition_number';
      params = [circleId, clusterId];
    } else {
      // Fallback: derive from latest non-null requisition with circle/cluster
      sql = `SELECT generate_requisition_number(
               (SELECT circle_id FROM requisitions WHERE circle_id IS NOT NULL ORDER BY id DESC LIMIT 1),
               (SELECT cluster_id FROM requisitions WHERE cluster_id IS NOT NULL ORDER BY id DESC LIMIT 1)
             ) as requisition_number`;
      params = [];
    }
    const result = await queryFunction(sql, params);
    return result.rows[0].requisition_number;
  }

  /**
   * Get requisition statistics
   */
  async getRequisitionStats(userId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_requisitions,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approval_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM requisitions
    `;
    
    const result = await query(statsQuery);
    const row = result.rows[0] || {};
    // Backward-compatible alias for UI expecting submitted_count
    row.submitted_count = row.pending_approval_count;
    
    return row;
  }
}

export default new RequisitionService();
