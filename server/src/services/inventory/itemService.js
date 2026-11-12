import { query, getPool } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';
import { parse } from 'csv-parse';
import fs from 'fs/promises';

class ItemService {
  /**
   * Create a new item
   */
  async createItem(itemData, userId) {
    try {
      const result = await query(`
        INSERT INTO items (
          item_code, name, description, category_id, unit_of_measure, 
          item_type, min_stock_level, max_stock_level, reorder_point,
          standard_cost, estimated_price, price_currency, brand, model,
          last_purchase_price, supplier_id, lead_time_days,
          shelf_life_days, weight_kg, dimensions_cm, specifications, attachments,
          created_by, is_returnable
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
        RETURNING *
      `, [
        itemData.item_code,
        itemData.name,
        itemData.description,
        itemData.category_id,
        itemData.unit_of_measure || 'PCS',
        itemData.item_type || 'STOCK',
        itemData.min_stock_level || 0,
        itemData.max_stock_level,
        itemData.reorder_point || 0,
        itemData.standard_cost || 0,
        itemData.estimated_price || 0,
        itemData.price_currency || 'INR',
        itemData.brand || null,
        itemData.model || null,
        itemData.last_purchase_price || 0,
        itemData.supplier_id,
        itemData.lead_time_days || 0,
        itemData.shelf_life_days,
        itemData.weight_kg,
        itemData.dimensions_cm ? JSON.stringify(itemData.dimensions_cm) : null,
        itemData.specifications ? JSON.stringify(itemData.specifications) : null,
        itemData.attachments ? JSON.stringify(itemData.attachments) : null,
        userId,
        typeof itemData.is_returnable === 'boolean' ? itemData.is_returnable : true
      ]);

      const item = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.ITEM.CREATED',
        item.id.toString(),
        'item',
        {
          item_id: item.id,
          item_code: item.item_code,
          name: item.name,
          category_id: item.category_id,
          item_type: item.item_type
        },
        { created_by: userId }
      );

      return item;
    } catch (error) {
      console.error('Failed to create item:', error);
      throw new Error(`Failed to create item: ${error.message}`);
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(itemId) {
    try {
      const result = await query(`
        SELECT i.*, ic.name as category_name, s.name as supplier_name
        FROM items i
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE i.id = $1
      `, [itemId]);

      if (result.rows.length === 0) {
        throw new Error('Item not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get item:', error);
      throw new Error(`Failed to get item: ${error.message}`);
    }
  }

  /**
   * Get item by code
   */
  async getItemByCode(itemCode) {
    try {
      const result = await query(`
        SELECT i.*, ic.name as category_name, s.name as supplier_name
        FROM items i
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        WHERE i.item_code = $1
      `, [itemCode]);

      if (result.rows.length === 0) {
        return null; // Return null instead of throwing error
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get item by code:', error);
      throw new Error(`Failed to get item by code: ${error.message}`);
    }
  }

  /**
   * Get all items with pagination and filters
   */
  async getItems(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      // Add active filter if specified
      if (filters.isActive !== undefined && filters.isActive !== 'all') {
        paramCount++;
        whereClause += ` AND i.is_active = $${paramCount}`;
        params.push(filters.isActive === 'active');
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (i.item_code ILIKE $${paramCount} OR i.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.category_id) {
        paramCount++;
        whereClause += ` AND i.category_id = $${paramCount}`;
        params.push(filters.category_id);
      }

      if (filters.item_type) {
        paramCount++;
        whereClause += ` AND i.item_type = $${paramCount}`;
        params.push(filters.item_type);
      }

      if (filters.supplier_id) {
        paramCount++;
        whereClause += ` AND i.supplier_id = $${paramCount}`;
        params.push(filters.supplier_id);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT i.*, ic.name as category_name, s.name as supplier_name,
               COUNT(*) OVER() as total_count
        FROM items i
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        ${whereClause}
        ORDER BY i.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        items: result.rows,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        page,
        limit,
        totalPages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      };
    } catch (error) {
      console.error('Failed to get items:', error);
      throw new Error(`Failed to get items: ${error.message}`);
    }
  }

  /**
   * Export all items to CSV (Stock Item Report format)
   */
  async exportItemsCsv() {
    try {
      const result = await query(`
        SELECT 
          i.id,
          i.item_code,
          i.name,
          i.description,
          i.company_code,
          i.unit_of_measure,
          i.manufacturer,
          i.hsn_code,
          i.sac_code,
          i.rating,
          i.spare_type,
          i.sub_category,
          i.basic_rate,
          i.discount_percentage,
          i.gst_rate,
          i.is_returnable,
          ic.name AS category_name
        FROM items i
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        ORDER BY i.company_code NULLS LAST, i.item_code
      `);

      const rows = result.rows || [];

      const escapeCsv = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines = [];

      // Title row (matches provided sample)
      lines.push('Stock Items Master Detail');

      // Header row (matches provided CSV as closely as possible)
      const headers = [
        'S.N.',
        'COMPANY CODE',
        'PART NO',
        'CATEGORY',
        'ITEM DESCRIPTION',
        'UNIT',
        'MAKE',
        'HSN CODE',
        'SAC CODE',
        'Rating',
        'SPARE TYPE',
        'SUB CATEGORY',
        'Basic Rate',
        'Discount(%)',
        'After Discount',
        'IGST %',
        'IGST Amt',
        'CGST %',
        'CGST Amt',
        'SGST %',
        'SGST Amt',
        'Final Rate',
        'Returnable'
      ];
      lines.push(headers.map(escapeCsv).join(','));

      rows.forEach((row, index) => {
        const basicRate = Number(row.basic_rate || 0);
        const discountPct = Number(row.discount_percentage || 0);
        const afterDiscount = basicRate * (1 - discountPct / 100);
        const gstRate = Number(row.gst_rate || 0);

        // For now, keep GST split columns simple; they can be adjusted later if needed.
        const igstPct = gstRate;
        const igstAmt = 0;
        const cgstPct = 0;
        const cgstAmt = 0;
        const sgstPct = 0;
        const sgstAmt = 0;
        const finalRate = afterDiscount; // Can be extended to include GST if required

        const record = [
          index + 1,                        // S.N.
          row.company_code || '',           // COMPANY CODE
          row.item_code || '',              // PART NO
          row.category_name || '',          // CATEGORY
          row.name || row.description || '',// ITEM DESCRIPTION
          row.unit_of_measure || '',        // UNIT
          row.manufacturer || '',           // MAKE
          row.hsn_code || '',               // HSN CODE
          row.sac_code || '',               // SAC CODE
          row.rating || '',                 // Rating
          row.spare_type || '',             // SPARE TYPE
          row.sub_category || '',           // SUB CATEGORY
          basicRate,                        // Basic Rate
          discountPct,                      // Discount(%)
          afterDiscount,                    // After Discount
          igstPct,                          // IGST %
          igstAmt,                          // IGST Amt
          cgstPct,                          // CGST %
          cgstAmt,                          // CGST Amt
          sgstPct,                          // SGST %
          sgstAmt,                          // SGST Amt
          finalRate,                        // Final Rate
          row.is_returnable ? 'Yes' : 'No'  // Returnable
        ];

        lines.push(record.map(escapeCsv).join(','));
      });

      return lines.join('\r\n');
    } catch (error) {
      console.error('Failed to export items CSV:', error);
      throw new Error(`Failed to export items CSV: ${error.message}`);
    }
  }

  /**
   * Update item
   */
  async updateItem(itemId, updateData, userId) {
    try {
      const oldItem = await this.getItemById(itemId);

      // Check if item_code is being updated and ensure uniqueness
      if (updateData.item_code && updateData.item_code !== oldItem.item_code) {
        const existingItem = await this.getItemByCode(updateData.item_code);
        if (existingItem && existingItem.id !== itemId) {
          throw new Error('Item code already exists');
        }
      }

      // Normalize inputs: convert empty strings to null and cast types
      const toNullIfEmpty = (v) => (v === '' || v === undefined ? null : v);
      const toIntOrNull = (v) => (v === '' || v === undefined || v === null ? null : (isNaN(parseInt(v)) ? null : parseInt(v)));
      const toNumOrNull = (v) => (v === '' || v === undefined || v === null ? null : (isNaN(Number(v)) ? null : Number(v)));
      const toBoolOrNull = (v) => (v === '' || v === undefined ? null : (typeof v === 'boolean' ? v : (String(v).toLowerCase() === 'true' ? true : (String(v).toLowerCase() === 'false' ? false : null))));

      const p1_item_code = toNullIfEmpty(updateData.item_code);
      const p2_name = toNullIfEmpty(updateData.name);
      const p3_description = toNullIfEmpty(updateData.description);
      const p4_category_id = toIntOrNull(updateData.category_id);
      const p5_unit_of_measure = toNullIfEmpty(updateData.unit_of_measure);
      const p6_item_type = toNullIfEmpty(updateData.item_type);
      const p7_min_stock_level = toNumOrNull(updateData.min_stock_level);
      const p8_max_stock_level = toNumOrNull(updateData.max_stock_level);
      const p9_reorder_point = toNumOrNull(updateData.reorder_point);
      const p10_standard_cost = toNumOrNull(updateData.standard_cost);
      const p11_estimated_price = toNumOrNull(updateData.estimated_price);
      const p12_price_currency = toNullIfEmpty(updateData.price_currency);
      const p13_brand = toNullIfEmpty(updateData.brand);
      const p14_model = toNullIfEmpty(updateData.model);
      const p15_last_purchase_price = toNumOrNull(updateData.last_purchase_price);
      const p16_supplier_id = toIntOrNull(updateData.supplier_id);
      const p17_lead_time_days = toIntOrNull(updateData.lead_time_days);
      const p18_shelf_life_days = toIntOrNull(updateData.shelf_life_days);
      const p19_weight_kg = toNumOrNull(updateData.weight_kg);
      const p20_dimensions_cm = updateData.dimensions_cm ? JSON.stringify(updateData.dimensions_cm) : null;
      const p21_specifications = updateData.specifications ? JSON.stringify(updateData.specifications) : null;
      const p22_attachments = updateData.attachments ? JSON.stringify(updateData.attachments) : null;
      const p23_is_active = toBoolOrNull(updateData.is_active);
      const p24_is_returnable = toBoolOrNull(updateData.is_returnable);

      const result = await query(`
        UPDATE items SET
          item_code = COALESCE($1, item_code),
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          category_id = COALESCE($4, category_id),
          unit_of_measure = COALESCE($5, unit_of_measure),
          item_type = COALESCE($6, item_type),
          min_stock_level = COALESCE($7, min_stock_level),
          max_stock_level = COALESCE($8, max_stock_level),
          reorder_point = COALESCE($9, reorder_point),
          standard_cost = COALESCE($10, standard_cost),
          estimated_price = COALESCE($11, estimated_price),
          price_currency = COALESCE($12, price_currency),
          brand = COALESCE($13, brand),
          model = COALESCE($14, model),
          last_purchase_price = COALESCE($15, last_purchase_price),
          supplier_id = COALESCE($16, supplier_id),
          lead_time_days = COALESCE($17, lead_time_days),
          shelf_life_days = COALESCE($18, shelf_life_days),
          weight_kg = COALESCE($19, weight_kg),
          dimensions_cm = COALESCE($20, dimensions_cm),
          specifications = COALESCE($21, specifications),
          attachments = COALESCE($22, attachments),
          is_active = COALESCE($23, is_active),
          is_returnable = COALESCE($24, is_returnable)
        WHERE id = $25
        RETURNING *
      `, [
        p1_item_code,
        p2_name,
        p3_description,
        p4_category_id,
        p5_unit_of_measure,
        p6_item_type,
        p7_min_stock_level,
        p8_max_stock_level,
        p9_reorder_point,
        p10_standard_cost,
        p11_estimated_price,
        p12_price_currency,
        p13_brand,
        p14_model,
        p15_last_purchase_price,
        p16_supplier_id,
        p17_lead_time_days,
        p18_shelf_life_days,
        p19_weight_kg,
        p20_dimensions_cm,
        p21_specifications,
        p22_attachments,
        p23_is_active,
        p24_is_returnable,
        itemId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Item not found');
      }

      const updatedItem = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.ITEM.UPDATED',
        updatedItem.id.toString(),
        'item',
        {
          item_id: updatedItem.id,
          item_code: updatedItem.item_code,
          name: updatedItem.name,
          changes: this.getChanges(oldItem, updatedItem)
        },
        { updated_by: userId }
      );

      return updatedItem;
    } catch (error) {
      console.error('Failed to update item:', error);
      throw new Error(`Failed to update item: ${error.message}`);
    }
  }

  /**
   * Toggle item status (active/inactive)
   */
  async toggleItemStatus(itemId, isActive, userId) {
    try {
      const oldItem = await this.getItemById(itemId);

      const result = await query(`
        UPDATE items SET is_active = $1 WHERE id = $2 RETURNING *
      `, [isActive, itemId]);

      if (result.rows.length === 0) {
        throw new Error('Item not found');
      }

      const updatedItem = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.ITEM.STATUS_TOGGLED',
        updatedItem.id.toString(),
        'item',
        {
          item_id: updatedItem.id,
          item_code: updatedItem.item_code,
          name: updatedItem.name,
          old_status: oldItem.is_active,
          new_status: updatedItem.is_active
        },
        { updated_by: userId }
      );

      return updatedItem;
    } catch (error) {
      console.error('Failed to toggle item status:', error);
      throw new Error(`Failed to toggle item status: ${error.message}`);
    }
  }

  /**
   * Delete item (soft delete or hard delete with dependency check)
   */
  async deleteItem(itemId, userId, hardDelete = false) {
    try {
      // Check if item exists
      const itemCheck = await query(`
        SELECT id, item_code, name, is_active FROM items WHERE id = $1
      `, [itemId]);

      if (itemCheck.rows.length === 0) {
        throw new Error('Item not found');
      }

      const item = itemCheck.rows[0];

      // If hard delete, check for dependencies
      if (hardDelete) {
        const dependencies = await this.checkItemDependencies(itemId);
        
        if (dependencies.hasReferences) {
          const errorMsg = `Cannot delete item. It is referenced in: ${dependencies.references.join(', ')}. Please use soft delete (deactivate) instead.`;
          throw new Error(errorMsg);
        }

        // No dependencies, proceed with hard delete
        const result = await query(`
          DELETE FROM items WHERE id = $1 RETURNING *
        `, [itemId]);

        const deletedItem = result.rows[0];

        // Publish domain event
        await domainEventService.publishEvent(
          'INVENTORY.ITEM.HARD_DELETED',
          deletedItem.id.toString(),
          'item',
          {
            item_id: deletedItem.id,
            item_code: deletedItem.item_code,
            name: deletedItem.name,
            delete_type: 'hard'
          },
          { deleted_by: userId }
        );

        return deletedItem;
      } else {
        // Soft delete - set is_active to false
        const result = await query(`
          UPDATE items SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *
        `, [itemId]);

        const deletedItem = result.rows[0];

        // Publish domain event
        await domainEventService.publishEvent(
          'INVENTORY.ITEM.SOFT_DELETED',
          deletedItem.id.toString(),
          'item',
          {
            item_id: deletedItem.id,
            item_code: deletedItem.item_code,
            name: deletedItem.name,
            delete_type: 'soft'
          },
          { deleted_by: userId }
        );

        return deletedItem;
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
      throw new Error(`Failed to delete item: ${error.message}`);
    }
  }

  /**
   * Import items from a CSV file (Stock Item Report format).
   * Upserts by company_code when present, otherwise by item_code.
   */
  async importItemsFromCsv(filePath, userId) {
    const pool = getPool();
    const stats = {
      totalRows: 0,
      processedRows: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      errorDetails: []
    };

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');

      const records = await new Promise((resolve, reject) => {
        const rows = [];
        parse(fileContent, {
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          relax_column_count: true
        })
          .on('data', (record) => {
            rows.push(record);
          })
          .on('end', () => resolve(rows))
          .on('error', (err) => reject(err));
      });

      stats.totalRows = records.length;

      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNumber = i + 1;

        // Skip title/header rows based on first column content
        const firstCol = (row[0] || '').toString().trim();
        if (!firstCol || firstCol === 'S.N.' || firstCol.startsWith('Stock Items Master Detail')) {
          stats.skipped++;
          continue;
        }

        try {
          // Map CSV columns by position (based on provided sample)
          const companyCode = (row[1] || '').toString().trim();
          const itemCode = (row[2] || '').toString().trim();
          const categoryName = (row[3] || '').toString().trim();
          const itemName = (row[4] || '').toString().trim();
          const unit = (row[5] || '').toString().trim();
          const manufacturer = (row[6] || '').toString().trim();
          const hsnCode = (row[7] || '').toString().trim();
          const sacCode = (row[8] || '').toString().trim();
          const rating = (row[9] || '').toString().trim();
          const spareType = (row[10] || '').toString().trim();
          const subCategory = (row[11] || '').toString().trim();

          const basicRate = row[12] !== undefined && row[12] !== '' ? Number(row[12]) || 0 : null;
          const discountPct = row[13] !== undefined && row[13] !== '' ? Number(row[13]) || 0 : null;

          // Try to derive GST rate from IGST % if present
          let gstRate = 0;
          if (row[15] !== undefined && row[15] !== '') {
            const igstStr = row[15].toString().replace('%', '').trim();
            const parsedGst = Number(igstStr);
            if (!isNaN(parsedGst)) {
              gstRate = parsedGst;
            }
          }

          if (!companyCode && !itemCode) {
            // Nothing to key on
            stats.skipped++;
            continue;
          }

          // Resolve or create category ID (by name)
          let categoryId = null;
          if (categoryName) {
            const catRes = await query(
              `SELECT id FROM item_categories WHERE name ILIKE $1 LIMIT 1`,
              [categoryName]
            );
            if (catRes.rows.length > 0) {
              categoryId = catRes.rows[0].id;
            } else {
              // Create category on the fly, ensuring category_code is not null and unique
              const baseCode =
                categoryName
                  .toUpperCase()
                  .replace(/[^A-Z0-9]+/g, '-')
                  .replace(/^-+|-+$/g, '')
                  .slice(0, 20) || 'CAT';

              let categoryCode = baseCode;
              let attempt = 1;
              // Try inserting with incremental suffix on unique-constraint conflicts
              // to avoid null/duplicate category_code errors
              // eslint-disable-next-line no-constant-condition
              while (true) {
                try {
                  const newCat = await query(
                    `INSERT INTO item_categories (category_code, name, description, category_type, status, created_by)
                     VALUES ($1, $2, $3, 'PRODUCT', 'ACTIVE', $4)
                     RETURNING id`,
                    [categoryCode, categoryName, `Imported from Stock Item CSV`, userId]
                  );
                  categoryId = newCat.rows[0].id;
                  break;
                } catch (e) {
                  // 23505 = unique_violation
                  if (e && e.code === '23505') {
                    attempt += 1;
                    categoryCode = `${baseCode}-${attempt}`.slice(0, 50);
                    continue;
                  }
                  throw e;
                }
              }
            }
          }

          // Find existing item by company_code first, then by item_code
          let existingItem = null;
          if (companyCode) {
            const resByCompany = await query(
              `SELECT * FROM items WHERE company_code = $1`,
              [companyCode]
            );
            if (resByCompany.rows.length > 0) {
              existingItem = resByCompany.rows[0];
            }
          }
          if (!existingItem && itemCode) {
            const resByCode = await query(
              `SELECT * FROM items WHERE item_code = $1`,
              [itemCode]
            );
            if (resByCode.rows.length > 0) {
              existingItem = resByCode.rows[0];
            }
          }

          if (!existingItem) {
            // Insert new item - minimal required fields
            const ins = await query(
              `INSERT INTO items (
                item_code, name, description, company_code, category_id, unit_of_measure,
                item_type, standard_cost, estimated_price, price_currency,
                brand, model, last_purchase_price, supplier_id,
                manufacturer, hsn_code, sac_code, spare_type, sub_category,
                rating, gst_rate, basic_rate, discount_percentage,
                min_stock_level, max_stock_level, reorder_point,
                created_by, is_returnable
              ) VALUES (
                $1,$2,$3,$4,$5,$6,
                'STOCK', 0, 0, 'INR',
                NULL, NULL, 0, NULL,
                $7,$8,$9,$10,$11,
                $12,$13,$14,$15,
                0,0,0,
                $16,true
              ) RETURNING id`,
              [
                itemCode || companyCode, // item_code
                itemName || itemCode || companyCode,
                null,                    // description
                companyCode || null,
                categoryId,
                unit || 'PCS',
                manufacturer || null,
                hsnCode || null,
                sacCode || null,
                spareType || null,
                subCategory || null,
                rating || null,
                gstRate,
                basicRate !== null ? basicRate : 0,
                discountPct !== null ? discountPct : 0,
                userId
              ]
            );

            stats.created++;
          } else {
            // Partial update existing item: only overwrite fields that are non-empty in CSV
            const fields = [];
            const params = [];
            let p = 1;

            if (companyCode) { fields.push(`company_code = $${p++}`); params.push(companyCode); }
            if (itemCode) { fields.push(`item_code = $${p++}`); params.push(itemCode); }
            if (itemName) { fields.push(`name = $${p++}`); params.push(itemName); }
            if (categoryId) { fields.push(`category_id = $${p++}`); params.push(categoryId); }
            if (unit) { fields.push(`unit_of_measure = $${p++}`); params.push(unit); }
            if (manufacturer) { fields.push(`manufacturer = $${p++}`); params.push(manufacturer); }
            if (hsnCode) { fields.push(`hsn_code = $${p++}`); params.push(hsnCode); }
            if (sacCode) { fields.push(`sac_code = $${p++}`); params.push(sacCode); }
            if (rating) { fields.push(`rating = $${p++}`); params.push(rating); }
            if (spareType) { fields.push(`spare_type = $${p++}`); params.push(spareType); }
            if (subCategory) { fields.push(`sub_category = $${p++}`); params.push(subCategory); }
            if (basicRate !== null) { fields.push(`basic_rate = $${p++}`); params.push(basicRate); }
            if (discountPct !== null) { fields.push(`discount_percentage = $${p++}`); params.push(discountPct); }
            if (gstRate) { fields.push(`gst_rate = $${p++}`); params.push(gstRate); }

            if (fields.length > 0) {
              fields.push(`updated_at = CURRENT_TIMESTAMP`);
              fields.push(`updated_by = $${p++}`);
              params.push(userId);

              params.push(existingItem.id);

              await query(
                `UPDATE items SET ${fields.join(', ')} WHERE id = $${p} RETURNING id`,
                params
              );

              stats.updated++;
            } else {
              stats.skipped++;
            }
          }

          stats.processedRows++;
        } catch (rowError) {
          console.error(`Item CSV import error on row ${rowNumber}:`, rowError);
          stats.errors++;
          stats.errorDetails.push({
            row: rowNumber,
            message: rowError.message
          });
        }
      }

      return stats;
    } catch (error) {
      console.error('Failed to import items from CSV:', error);
      throw new Error(`Failed to import items from CSV: ${error.message}`);
    } finally {
      // Nothing to clean up from pool here, connections are managed by query/getPool
    }
  }

  /**
   * Check if item has any dependencies that would prevent deletion
   */
  async checkItemDependencies(itemId) {
    try {
      const references = [];

      // Check PO lines
      const poLines = await query(`
        SELECT COUNT(*) as count FROM po_lines WHERE item_id = $1
      `, [itemId]);
      if (parseInt(poLines.rows[0].count) > 0) {
        references.push(`${poLines.rows[0].count} PO line(s)`);
      }

      // Check requisition lines
      const reqLines = await query(`
        SELECT COUNT(*) as count FROM requisition_lines WHERE item_id = $1
      `, [itemId]);
      if (parseInt(reqLines.rows[0].count) > 0) {
        references.push(`${reqLines.rows[0].count} requisition line(s)`);
      }

      // Check item prices
      const itemPrices = await query(`
        SELECT COUNT(*) as count FROM item_prices WHERE item_id = $1
      `, [itemId]);
      if (parseInt(itemPrices.rows[0].count) > 0) {
        references.push(`${itemPrices.rows[0].count} price list(s)`);
      }

      // Check supplier items
      const supplierItems = await query(`
        SELECT COUNT(*) as count FROM supplier_items WHERE item_id = $1
      `, [itemId]);
      if (parseInt(supplierItems.rows[0].count) > 0) {
        references.push(`${supplierItems.rows[0].count} supplier item(s)`);
      }

      // Check inventory transfers
      const transfersCheck = await query(`
        SELECT COUNT(*) as count FROM inventory_transfers WHERE item_id = $1
      `, [itemId]);
      if (parseInt(transfersCheck.rows[0].count) > 0) {
        references.push(`${transfersCheck.rows[0].count} inventory transfer(s)`);
      }

      // Check inventory adjustments
      const adjustmentsCheck = await query(`
        SELECT COUNT(*) as count FROM inventory_adjustments WHERE item_id = $1
      `, [itemId]);
      if (parseInt(adjustmentsCheck.rows[0].count) > 0) {
        references.push(`${adjustmentsCheck.rows[0].count} inventory adjustment(s)`);
      }

      // Check inventory issues
      const issuesCheck = await query(`
        SELECT COUNT(*) as count FROM inventory_issues WHERE item_id = $1
      `, [itemId]);
      if (parseInt(issuesCheck.rows[0].count) > 0) {
        references.push(`${issuesCheck.rows[0].count} inventory issue(s)`);
      }

      return {
        hasReferences: references.length > 0,
        references
      };
    } catch (error) {
      console.error('Error checking item dependencies:', error);
      throw error;
    }
  }

  /**
   * Get item categories
   */
  async getItemCategories() {
    try {
      const result = await query(`
        SELECT id, name, description, parent_category_id, is_active
        FROM item_categories
        WHERE is_active = true
        ORDER BY name
      `);

      return result.rows;
    } catch (error) {
      console.error('Failed to get item categories:', error);
      throw new Error(`Failed to get item categories: ${error.message}`);
    }
  }

  /**
   * Create item category
   */
  async createItemCategory(categoryData, userId) {
    try {
      const result = await query(`
        INSERT INTO item_categories (name, description, parent_category_id, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        categoryData.name,
        categoryData.description,
        categoryData.parent_category_id,
        userId
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Failed to create item category:', error);
      throw new Error(`Failed to create item category: ${error.message}`);
    }
  }

  /**
   * Helper method to get changes between old and new item data
   */
  getChanges(oldItem, newItem) {
    const changes = {};
    const fields = ['name', 'description', 'category_id', 'unit_of_measure', 'item_type', 
                   'min_stock_level', 'max_stock_level', 'reorder_point', 'standard_cost', 
                   'estimated_price', 'price_currency', 'brand', 'model', 'is_returnable',
                   'last_purchase_price', 'supplier_id', 'lead_time_days', 'shelf_life_days', 
                   'weight_kg', 'dimensions_cm', 'specifications', 'attachments', 'is_active'];

    fields.forEach(field => {
      if (oldItem[field] !== newItem[field]) {
        changes[field] = {
          old: oldItem[field],
          new: newItem[field]
        };
      }
    });

    return changes;
  }

  /**
   * Search items by brand/model with enhanced filtering
   */
  async searchItemsByBrandModel(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      // Add brand filter
      if (filters.brand) {
        paramCount++;
        whereClause += ` AND i.brand ILIKE $${paramCount}`;
        params.push(`%${filters.brand}%`);
      }

      // Add model filter
      if (filters.model) {
        paramCount++;
        whereClause += ` AND i.model ILIKE $${paramCount}`;
        params.push(`%${filters.model}%`);
      }

      // Add general search filter
      if (filters.search) {
        paramCount++;
        whereClause += ` AND (i.item_code ILIKE $${paramCount} OR i.name ILIKE $${paramCount} OR i.brand ILIKE $${paramCount} OR i.model ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT i.*, ic.name as category_name, s.name as supplier_name,
               COUNT(*) OVER() as total_count
        FROM items i
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        LEFT JOIN suppliers s ON i.supplier_id = s.id
        ${whereClause}
        ORDER BY i.brand, i.model, i.name
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        items: result.rows,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        page,
        limit,
        totalPages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      };
    } catch (error) {
      console.error('Failed to search items by brand/model:', error);
      throw new Error(`Failed to search items by brand/model: ${error.message}`);
    }
  }

  /**
   * Get all unique brands
   */
  async getAllBrands() {
    try {
      const result = await query(`
        SELECT DISTINCT brand, COUNT(*) as item_count
        FROM items 
        WHERE brand IS NOT NULL AND brand != ''
        GROUP BY brand
        ORDER BY brand
      `);

      return result.rows;
    } catch (error) {
      console.error('Failed to get brands:', error);
      throw new Error(`Failed to get brands: ${error.message}`);
    }
  }

  /**
   * Get all models for a specific brand
   */
  async getModelsByBrand(brand) {
    try {
      const result = await query(`
        SELECT DISTINCT model, COUNT(*) as item_count
        FROM items 
        WHERE brand = $1 AND model IS NOT NULL AND model != ''
        GROUP BY model
        ORDER BY model
      `, [brand]);

      return result.rows;
    } catch (error) {
      console.error('Failed to get models by brand:', error);
      throw new Error(`Failed to get models by brand: ${error.message}`);
    }
  }

  /**
   * Bulk update brand/model information
   */
  async bulkUpdateBrandModel(items, userId) {
    try {
      const updatedItems = [];
      let updatedCount = 0;

      for (const itemData of items) {
        const { itemId, brand, model, estimated_price, price_currency } = itemData;

        const result = await query(`
          UPDATE items SET
            brand = COALESCE($1, brand),
            model = COALESCE($2, model),
            estimated_price = COALESCE($3, estimated_price),
            price_currency = COALESCE($4, price_currency),
            updated_at = NOW()
          WHERE id = $5
          RETURNING *
        `, [brand, model, estimated_price, price_currency, itemId]);

        if (result.rows.length > 0) {
          updatedItems.push(result.rows[0]);
          updatedCount++;

          // Publish domain event for each updated item
          await domainEventService.publishEvent(
            'INVENTORY.ITEM.BRAND_MODEL_UPDATED',
            result.rows[0].id.toString(),
            'item',
            {
              item_id: result.rows[0].id,
              item_code: result.rows[0].item_code,
              name: result.rows[0].name,
              brand: result.rows[0].brand,
              model: result.rows[0].model,
              estimated_price: result.rows[0].estimated_price,
              price_currency: result.rows[0].price_currency
            },
            { updated_by: userId }
          );
        }
      }

      return {
        updatedCount,
        updatedItems
      };
    } catch (error) {
      console.error('Failed to bulk update brand/model:', error);
      throw new Error(`Failed to bulk update brand/model: ${error.message}`);
    }
  }
}

export default new ItemService();
