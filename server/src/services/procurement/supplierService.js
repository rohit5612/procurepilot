import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class SupplierService {
  /**
   * Create a new supplier
   */
  async createSupplier(supplierData, userId) {
    try {
      // Begin transaction to ensure supplier and coverage mappings are consistent
      await query('BEGIN');

      const result = await query(`
        INSERT INTO suppliers (
          supplier_code,
          name,
          legal_name,
          gst_number,
          vat_number,
          service_tax_number,
          pan_number,
          registration_number,
          supplier_type,
          status,
          contact_person,
          email,
          phone,
          website,
          address_line1,
          address_line2,
          city,
          state,
          postal_code,
          country,
          payment_terms,
          credit_limit,
          currency,
          bank_details,
          rating,
          notes,
          attachments,
          created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25,
          $26, $27, $28
        )
        RETURNING *
      `, [
        supplierData.supplier_code,
        supplierData.name,
        supplierData.legal_name,
        // Prefer explicit gst_number, fall back to legacy tax_id if present
        supplierData.gst_number ?? supplierData.tax_id ?? null,
        supplierData.vat_number ?? null,
        supplierData.service_tax_number ?? null,
        supplierData.pan_number ?? null,
        supplierData.registration_number ?? null,
        supplierData.supplier_type || 'VENDOR',
        supplierData.status || 'ACTIVE',
        supplierData.contact_person || null,
        supplierData.email || null,
        supplierData.phone || null,
        supplierData.website || null,
        supplierData.address_line1 || null,
        supplierData.address_line2 || null,
        supplierData.city || null,
        supplierData.state || null,
        supplierData.postal_code || null,
        supplierData.country || null,
        supplierData.payment_terms || 30,
        supplierData.credit_limit ?? null,
        supplierData.currency || 'INR',
        supplierData.bank_details ? JSON.stringify(supplierData.bank_details) : null,
        supplierData.rating ?? null,
        supplierData.notes || null,
        supplierData.attachments ? JSON.stringify(supplierData.attachments) : null,
        userId
      ]);

      const supplier = result.rows[0];

      // Optional: initial coverage mapping by cluster or circle
      // If cluster_id provided, map to supplier_clusters and derive circle_id from clusters
      if (supplierData?.cluster_id) {
        // Ensure we have numeric
        const clusterId = parseInt(supplierData.cluster_id, 10);
        if (Number.isFinite(clusterId)) {
          // Insert cluster mapping
          await query(
            `INSERT INTO supplier_clusters (supplier_id, cluster_id)
             VALUES ($1, $2)
             ON CONFLICT (supplier_id, cluster_id) DO NOTHING`,
            [supplier.id, clusterId]
          );

          // Get circle_id for the cluster and ensure circle mapping exists too
          const clusterRes = await query(`SELECT circle_id FROM clusters WHERE id = $1`, [clusterId]);
          const circleIdFromCluster = clusterRes.rows?.[0]?.circle_id;
          if (circleIdFromCluster) {
            await query(
              `INSERT INTO supplier_circles (supplier_id, circle_id)
               VALUES ($1, $2)
               ON CONFLICT (supplier_id, circle_id) DO NOTHING`,
              [supplier.id, circleIdFromCluster]
            );
          }
        }
      }

      // If circle_id provided explicitly, map it as well
      if (supplierData?.circle_id) {
        const circleId = parseInt(supplierData.circle_id, 10);
        if (Number.isFinite(circleId)) {
          await query(
            `INSERT INTO supplier_circles (supplier_id, circle_id)
             VALUES ($1, $2)
             ON CONFLICT (supplier_id, circle_id) DO NOTHING`,
            [supplier.id, circleId]
          );
        }
      }

      await query('COMMIT');

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER.CREATED',
        supplier.id.toString(),
        'supplier',
        {
          supplier_id: supplier.id,
          supplier_code: supplier.supplier_code,
          name: supplier.name,
          supplier_type: supplier.supplier_type,
          status: supplier.status
        },
        { created_by: userId }
      );

      return supplier;
    } catch (error) {
      // Rollback on any failure during creation/mapping
      try { await query('ROLLBACK'); } catch (_) {}
      console.error('Failed to create supplier:', error);
      throw new Error(`Failed to create supplier: ${error.message}`);
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(supplierId) {
    try {
      const result = await query(`
        SELECT * FROM suppliers WHERE id = $1
      `, [supplierId]);

      if (result.rows.length === 0) {
        throw new Error('Supplier not found');
      }

      const supplier = result.rows[0];

      // Load circle and cluster IDs from coverage tables
      const circleRes = await query(`SELECT circle_id FROM supplier_circles WHERE supplier_id = $1 LIMIT 1`, [supplierId]);
      const clusterRes = await query(`SELECT cluster_id FROM supplier_clusters WHERE supplier_id = $1 LIMIT 1`, [supplierId]);

      if (circleRes.rows.length > 0) {
        supplier.circle_id = circleRes.rows[0].circle_id;
      }
      if (clusterRes.rows.length > 0) {
        supplier.cluster_id = clusterRes.rows[0].cluster_id;
      }

      return supplier;
    } catch (error) {
      console.error('Failed to get supplier:', error);
      throw new Error(`Failed to get supplier: ${error.message}`);
    }
  }

  /**
   * Get supplier by code
   */
  async getSupplierByCode(supplierCode) {
    try {
      const result = await query(`
        SELECT * FROM suppliers WHERE supplier_code = $1
      `, [supplierCode]);

      if (result.rows.length === 0) {
        throw new Error('Supplier not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get supplier by code:', error);
      throw new Error(`Failed to get supplier by code: ${error.message}`);
    }
  }

  /**
   * Get all suppliers with pagination and filters
   */
  async getSuppliers(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (supplier_code ILIKE $${paramCount} OR name ILIKE $${paramCount} OR legal_name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.supplier_type) {
        paramCount++;
        whereClause += ` AND supplier_type = $${paramCount}`;
        params.push(filters.supplier_type);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.country) {
        paramCount++;
        whereClause += ` AND country = $${paramCount}`;
        params.push(filters.country);
      }

      if (filters.circle_id) {
        paramCount++;
        whereClause += ` AND EXISTS (SELECT 1 FROM supplier_circles sc WHERE sc.supplier_id = s.id AND sc.circle_id = $${paramCount})`;
        params.push(parseInt(filters.circle_id) || filters.circle_id);
      }

      if (filters.cluster_id) {
        paramCount++;
        whereClause += ` AND EXISTS (SELECT 1 FROM supplier_clusters scl WHERE scl.supplier_id = s.id AND scl.cluster_id = $${paramCount})`;
        params.push(parseInt(filters.cluster_id) || filters.cluster_id);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT s.*, 
               COUNT(*) OVER() as total_count,
               (SELECT circle_id FROM supplier_circles WHERE supplier_id = s.id LIMIT 1) as circle_id,
               (SELECT cluster_id FROM supplier_clusters WHERE supplier_id = s.id LIMIT 1) as cluster_id
        FROM suppliers s
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        suppliers: result.rows,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        page,
        limit,
        totalPages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      };
    } catch (error) {
      console.error('Failed to get suppliers:', error);
      throw new Error(`Failed to get suppliers: ${error.message}`);
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(supplierId, updateData, userId) {
    try {
      const oldSupplier = await this.getSupplierById(supplierId);

      const result = await query(`
        UPDATE suppliers SET
          supplier_code = COALESCE($1, supplier_code),
          name = COALESCE($2, name),
          legal_name = COALESCE($3, legal_name),
          gst_number = COALESCE($4, gst_number),
          vat_number = COALESCE($5, vat_number),
          service_tax_number = COALESCE($6, service_tax_number),
          pan_number = COALESCE($7, pan_number),
          registration_number = COALESCE($8, registration_number),
          supplier_type = COALESCE($9, supplier_type),
          status = COALESCE($10, status),
          contact_person = COALESCE($11, contact_person),
          email = COALESCE($12, email),
          phone = COALESCE($13, phone),
          website = COALESCE($14, website),
          address_line1 = COALESCE($15, address_line1),
          address_line2 = COALESCE($16, address_line2),
          city = COALESCE($17, city),
          state = COALESCE($18, state),
          postal_code = COALESCE($19, postal_code),
          country = COALESCE($20, country),
          payment_terms = COALESCE($21, payment_terms),
          credit_limit = COALESCE($22, credit_limit),
          currency = COALESCE($23, currency),
          bank_details = COALESCE($24, bank_details),
          rating = COALESCE($25, rating),
          notes = COALESCE($26, notes),
          attachments = COALESCE($27, attachments),
          qualification_status = COALESCE($28, qualification_status),
          qualified_until = COALESCE($29, qualified_until),
          qualification_notes = COALESCE($30, qualification_notes),
          qualification_documents = COALESCE($31, qualification_documents)
        WHERE id = $32
        RETURNING *
      `, [
        updateData.supplier_code,
        updateData.name,
        updateData.legal_name,
        // Prefer explicit gst_number, fall back to legacy tax_id if present
        updateData.gst_number ?? updateData.tax_id ?? null,
        updateData.vat_number ?? null,
        updateData.service_tax_number ?? null,
        updateData.pan_number ?? null,
        updateData.registration_number ?? null,
        updateData.supplier_type ?? null,
        updateData.status ?? null,
        updateData.contact_person ?? null,
        updateData.email ?? null,
        updateData.phone ?? null,
        updateData.website ?? null,
        updateData.address_line1 ?? null,
        updateData.address_line2 ?? null,
        updateData.city ?? null,
        updateData.state ?? null,
        updateData.postal_code ?? null,
        updateData.country ?? null,
        updateData.payment_terms ?? null,
        updateData.credit_limit ?? null,
        updateData.currency ?? null,
        updateData.bank_details ? JSON.stringify(updateData.bank_details) : null,
        updateData.rating ?? null,
        updateData.notes ?? null,
        updateData.attachments ? JSON.stringify(updateData.attachments) : null,
        updateData.qualification_status ?? null,
        updateData.qualified_until ?? null,
        updateData.qualification_notes ?? null,
        updateData.qualification_documents
          ? JSON.stringify(updateData.qualification_documents)
          : null,
        supplierId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Supplier not found');
      }

      const updatedSupplier = result.rows[0];

      // Update coverage mappings if provided
      if (updateData?.cluster_id) {
        const clusterId = parseInt(updateData.cluster_id, 10);
        if (Number.isFinite(clusterId)) {
          await query('DELETE FROM supplier_clusters WHERE supplier_id = $1', [supplierId]);
          await query(
            `INSERT INTO supplier_clusters (supplier_id, cluster_id)
             VALUES ($1, $2)
             ON CONFLICT (supplier_id, cluster_id) DO NOTHING`,
            [supplierId, clusterId]
          );
          const clusterRes = await query('SELECT circle_id FROM clusters WHERE id = $1', [clusterId]);
          const circleIdFromCluster = clusterRes.rows?.[0]?.circle_id;
          if (circleIdFromCluster) {
            await query('DELETE FROM supplier_circles WHERE supplier_id = $1', [supplierId]);
            await query(
              `INSERT INTO supplier_circles (supplier_id, circle_id)
               VALUES ($1, $2)
               ON CONFLICT (supplier_id, circle_id) DO NOTHING`,
              [supplierId, circleIdFromCluster]
            );
          }
        }
      } else if (updateData?.circle_id) {
        const circleId = parseInt(updateData.circle_id, 10);
        if (Number.isFinite(circleId)) {
          await query('DELETE FROM supplier_circles WHERE supplier_id = $1', [supplierId]);
          await query(
            `INSERT INTO supplier_circles (supplier_id, circle_id)
             VALUES ($1, $2)
             ON CONFLICT (supplier_id, circle_id) DO NOTHING`,
            [supplierId, circleId]
          );
        }
      }

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER.UPDATED',
        updatedSupplier.id.toString(),
        'supplier',
        {
          supplier_id: updatedSupplier.id,
          supplier_code: updatedSupplier.supplier_code,
          name: updatedSupplier.name,
          changes: this.getChanges(oldSupplier, updatedSupplier)
        },
        { updated_by: userId }
      );

      return updatedSupplier;
    } catch (error) {
      console.error('Failed to update supplier:', error);
      throw new Error(`Failed to update supplier: ${error.message}`);
    }
  }

  /**
   * Toggle supplier status (active/inactive)
   */
  async toggleSupplierStatus(supplierId, status, userId) {
    try {
      const oldSupplier = await this.getSupplierById(supplierId);

      const result = await query(`
        UPDATE suppliers SET status = $1 WHERE id = $2 RETURNING *
      `, [status, supplierId]);

      if (result.rows.length === 0) {
        throw new Error('Supplier not found');
      }

      const updatedSupplier = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER.STATUS_TOGGLED',
        updatedSupplier.id.toString(),
        'supplier',
        {
          supplier_id: updatedSupplier.id,
          supplier_code: updatedSupplier.supplier_code,
          name: updatedSupplier.name,
          old_status: oldSupplier.status,
          new_status: updatedSupplier.status
        },
        { updated_by: userId }
      );

      return updatedSupplier;
    } catch (error) {
      console.error('Failed to toggle supplier status:', error);
      throw new Error(`Failed to toggle supplier status: ${error.message}`);
    }
  }

  /**
   * Delete supplier (hard delete)
   */
  async deleteSupplier(supplierId, userId) {
    try {
      // First check if supplier has any related data (supplier items, etc.)
      const supplierItemsResult = await query(`
        SELECT COUNT(*) as count FROM supplier_items WHERE supplier_id = $1
      `, [supplierId]);

      if (supplierItemsResult.rows[0].count > 0) {
        throw new Error(`Cannot delete supplier. It has ${supplierItemsResult.rows[0].count} supplier item(s). Please delete all supplier items first.`);
      }

      const result = await query(`
        DELETE FROM suppliers WHERE id = $1 RETURNING *
      `, [supplierId]);

      if (result.rows.length === 0) {
        throw new Error('Supplier not found');
      }

      const deletedSupplier = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER.DELETED',
        deletedSupplier.id.toString(),
        'supplier',
        {
          supplier_id: deletedSupplier.id,
          supplier_code: deletedSupplier.supplier_code,
          name: deletedSupplier.name
        },
        { deleted_by: userId }
      );

      return deletedSupplier;
    } catch (error) {
      console.error('Failed to delete supplier:', error);
      throw new Error(`Failed to delete supplier: ${error.message}`);
    }
  }

  /**
   * Get supplier contacts
   */
  async getSupplierContacts(supplierId) {
    try {
      const result = await query(`
        SELECT * FROM supplier_contacts 
        WHERE supplier_id = $1 AND is_active = true
        ORDER BY is_primary DESC, name
      `, [supplierId]);

      return result.rows;
    } catch (error) {
      console.error('Failed to get supplier contacts:', error);
      throw new Error(`Failed to get supplier contacts: ${error.message}`);
    }
  }

  /**
   * Add supplier contact
   */
  async addSupplierContact(supplierId, contactData) {
    try {
      const result = await query(`
        INSERT INTO supplier_contacts (
          supplier_id, name, position, email, phone, mobile, is_primary
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        supplierId,
        contactData.name,
        contactData.position,
        contactData.email,
        contactData.phone,
        contactData.mobile,
        contactData.is_primary || false
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to add supplier contact:', error);
      throw new Error(`Failed to add supplier contact: ${error.message}`);
    }
  }

  /**
   * Update supplier contact
   */
  async updateSupplierContact(contactId, updateData) {
    try {
      const result = await query(`
        UPDATE supplier_contacts SET
          name = COALESCE($1, name),
          position = COALESCE($2, position),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          mobile = COALESCE($5, mobile),
          is_primary = COALESCE($6, is_primary),
          is_active = COALESCE($7, is_active)
        WHERE id = $8
        RETURNING *
      `, [
        updateData.name,
        updateData.position,
        updateData.email,
        updateData.phone,
        updateData.mobile,
        updateData.is_primary,
        updateData.is_active,
        contactId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Supplier contact not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to update supplier contact:', error);
      throw new Error(`Failed to update supplier contact: ${error.message}`);
    }
  }

  /**
   * Helper method to get changes between old and new supplier data
   */
  getChanges(oldSupplier, newSupplier) {
    const changes = {};
    const fields = [
      'name',
      'legal_name',
      'gst_number',
      'vat_number',
      'service_tax_number',
      'pan_number',
      'registration_number',
      'supplier_type',
      'status',
      'contact_person',
      'email',
      'phone',
      'website',
      'address_line1',
      'address_line2',
      'city',
      'state',
      'postal_code',
      'country',
      'payment_terms',
      'credit_limit',
      'currency',
      'bank_details',
      'rating',
      'notes',
      'attachments'
    ];

    fields.forEach(field => {
      if (oldSupplier[field] !== newSupplier[field]) {
        changes[field] = {
          old: oldSupplier[field],
          new: newSupplier[field]
        };
      }
    });

    return changes;
  }

  /**
   * Get supplier's applied price list details
   */
  async getAppliedPriceList(supplierId) {
    try {
      const res = await query(`
        SELECT pl.*
        FROM suppliers s
        LEFT JOIN price_lists pl ON pl.id = s.applied_price_list_id
        WHERE s.id = $1
      `, [supplierId]);
      return res.rows[0] || null;
    } catch (error) {
      console.error('Failed to get applied price list:', error);
      throw new Error(`Failed to get applied price list: ${error.message}`);
    }
  }

  /**
   * Set applied price list (enforce list belongs to supplier if list has supplier_id)
   */
  async setAppliedPriceList(supplierId, priceListId, userId) {
    try {
      if (!priceListId) {
        const upd = await query(`UPDATE suppliers SET applied_price_list_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`, [supplierId]);
        return upd.rows[0];
      }
      // Optional: validate list exists and matches supplier if set
      const chk = await query(`SELECT id, supplier_id FROM price_lists WHERE id = $1`, [priceListId]);
      if (chk.rows.length === 0) throw new Error('Price list not found');
      const pl = chk.rows[0];
      if (pl.supplier_id && Number(pl.supplier_id) !== Number(supplierId)) {
        throw new Error('Price list does not belong to this supplier');
      }
      const upd = await query(`UPDATE suppliers SET applied_price_list_id = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [priceListId, supplierId]);
      // domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER.APPLIED_PRICE_LIST_SET',
        supplierId.toString(),
        'supplier',
        { supplier_id: Number(supplierId), applied_price_list_id: Number(priceListId) },
        { updated_by: userId }
      );
      return upd.rows[0];
    } catch (error) {
      console.error('Failed to set applied price list:', error);
      throw new Error(`Failed to set applied price list: ${error.message}`);
    }
  }
}

export default new SupplierService();
