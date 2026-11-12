import { query, getPool } from '../../database/connection.js';
import { parse } from 'csv-parse';
import fs from 'fs/promises';
import path from 'path';

class PriceListImportService {
  /**
   * Import price list from Excel/CSV file
   */
  async importPriceListFromFile(filePath, supplierId, userId, options = {}) {
    const pool = getPool();
    
    try {
      // Parse CSV file first
      const csvData = await this.parseCsvFile(filePath);
      
      if (csvData.length === 0) {
        throw new Error('CSV file is empty or invalid');
      }

      // Create price list and import log in a transaction
      let priceListId, importLogId;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Create price list entry first
        const priceListResult = await client.query(`
          INSERT INTO price_lists (
            name, description, supplier_id, currency, is_active, 
            import_source, import_filename, import_date, import_user_id,
            valid_from, created_by
          ) VALUES ($1, $2, $3, $4, true, 'excel', $5, NOW(), $6, CURRENT_DATE, $7)
          RETURNING id
        `, [
          options.priceListName || `Price List - ${new Date().toISOString().split('T')[0]}`,
          options.description || `Imported from ${path.basename(filePath)}`,
          supplierId,
          options.currency || 'INR',
          path.basename(filePath),
          userId,
          userId
        ]);

        priceListId = priceListResult.rows[0].id;

        // Now create import log entry with the price list ID
        const importLogResult = await client.query(`
          INSERT INTO price_list_import_logs (
            price_list_id, import_type, filename, total_rows, import_status, started_at, created_by
          ) VALUES ($1, $2, $3, $4, 'processing', NOW(), $5)
          RETURNING id
        `, [priceListId, 'excel', path.basename(filePath), csvData.length, userId]);

        importLogId = importLogResult.rows[0].id;

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Process each row WITHOUT a transaction - use individual queries
      let successfulImports = 0;
      let failedImports = 0;
      let skippedImports = 0;

      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        
        // Process row - each row is independent
        const result = await this.processImportRow(
          pool, importLogId, priceListId, supplierId, row, i + 1, userId
        );
        
        if (result.status === 'success') {
          successfulImports++;
        } else if (result.status === 'skipped') {
          skippedImports++;
        } else {
          failedImports++;
        }
      }

      // Update price list with import statistics
      await query(`
        UPDATE price_lists 
        SET total_items = $1, imported_items = $2, failed_items = $3
        WHERE id = $4
      `, [csvData.length, successfulImports, failedImports, priceListId]);

      // Update import log with final statistics
      await query(`
        UPDATE price_list_import_logs 
        SET successful_imports = $1, failed_imports = $2, skipped_imports = $3,
            import_status = 'completed', completed_at = NOW()
        WHERE id = $4
      `, [successfulImports, failedImports, skippedImports, importLogId]);

      return {
        success: true,
        priceListId,
        importLogId,
        statistics: {
          totalRows: csvData.length,
          successfulImports,
          failedImports,
          skippedImports
        }
      };

    } catch (error) {
      console.error('Price list import failed:', error);
      throw new Error(`Price list import failed: ${error.message}`);
    }
  }

  /**
   * Parse CSV file
   */
  async parseCsvFile(filePath) {
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      return new Promise((resolve, reject) => {
        const records = [];
        
        // Parse with custom column handling to deal with duplicate headers
        parse(fileContent, {
          columns: (header) => {
            // Rename duplicate columns: GST Rate becomes GST Rate, GST Rate_1
            const seen = {};
            return header.map(col => {
              let name = col;
              let count = 0;
              while (seen[name]) {
                count++;
                name = `${col}_${count}`;
              }
              seen[name] = true;
              return name;
            });
          },
          skip_empty_lines: true,
          trim: true
        })
        .on('data', (record) => {
          records.push(record);
        })
        .on('end', () => {
          resolve(records);
        })
        .on('error', (error) => {
          reject(error);
        });
      });
    } catch (error) {
      throw new Error(`Failed to parse CSV file: ${error.message}`);
    }
  }

  /**
   * Process individual import row
   */
  async processImportRow(pool, importLogId, priceListId, supplierId, row, rowNumber, userId) {
    try {
      // Extract data from row (KOEL Price List format)
      const itemCode = this.extractValue(row, ['Part Number', 'part_number', 'Part_Number', 'Item_Code', 'item_code']);
      const itemName = this.extractValue(row, ['Part Description', 'part_description', 'Part_Description', 'Item_Name', 'item_name']);
      const unitPrice = parseFloat(this.extractValue(row, ['Basic Rate', 'basic_rate', 'Basic_Rate', 'Unit_Price', 'unit_price']));
      
      // Handle GST Rate - KOEL CSV has two "GST Rate" columns
      // Column 4: "GST Rate" = total GST (e.g., "28%")
      // Column 7: "GST Rate_1" = SGST/CGST split (e.g., 14)
      // We want the FIRST column (total GST)
      let gstRate = 0;
      
      // Try to get the first GST Rate column (without suffix)
      let gstValue = this.extractValue(row, ['GST Rate']);
      if (gstValue) {
        if (typeof gstValue === 'string' && gstValue.includes('%')) {
          gstValue = gstValue.replace('%', '');
        }
        gstRate = parseFloat(gstValue) || 0;
      }
      
      // If not found or zero, try alternatives
      if (gstRate === 0) {
        gstValue = this.extractValue(row, ['gst_rate', 'GST_Rate', 'Total_GST_Rate']);
        if (gstValue) {
          if (typeof gstValue === 'string' && gstValue.includes('%')) {
            gstValue = gstValue.replace('%', '');
          }
          gstRate = parseFloat(gstValue) || 0;
        }
      }
      
      const leadTime = parseInt(this.extractValue(row, ['Lead_Time_Days', 'lead_time_days', 'LeadTime', 'Delivery_Days', 'delivery_days'])) || 0;
      const minOrderQty = parseFloat(this.extractValue(row, ['Min_Order_Qty', 'min_order_qty', 'MinOrderQty', 'Min_Qty', 'min_qty'])) || 1;
      
      // Additional fields from KOEL format
      const mrp = parseFloat(this.extractValue(row, ['MRP Rs.', 'mrp_rs', 'MRP_Rs', 'MRP', 'mrp'])) || 0;

      // Validate required fields
      if (!itemCode || !itemName || isNaN(unitPrice)) {
        // Log failed validation
        await query(`
          INSERT INTO price_list_import_item_logs (
            import_log_id, row_number, import_status, error_message, original_data
          ) VALUES ($1, $2, 'failed', $3, $4)
        `, [importLogId, rowNumber, `Missing required fields: itemCode=${itemCode}, itemName=${itemName}, unitPrice=${unitPrice}`, JSON.stringify(row)]);
        
        return { status: 'failed', reason: 'Missing required fields' };
      }

      // Find matching item in item master
      const itemMatch = await this.findMatchingItem(pool, itemCode, itemName);
      
      if (!itemMatch) {
        // Log as skipped - no matching item found
        await query(`
          INSERT INTO price_list_import_item_logs (
            import_log_id, row_number, item_code, item_name, unit_price, gst_rate,
            import_status, match_type, error_message, original_data
          ) VALUES ($1, $2, $3, $4, $5, $6, 'skipped', 'no_match', 'No matching item found in item master', $7)
        `, [importLogId, rowNumber, itemCode, itemName, unitPrice, gstRate, JSON.stringify(row)]);
        
        return { status: 'skipped', reason: 'No matching item found' };
      }
      
      // Insert item price
      await query(`
        INSERT INTO item_prices (
          price_list_id, item_id, supplier_id, price_type, unit_price, currency,
          min_quantity, gst_rate, lead_time_days, supplier_item_code, supplier_item_name,
          mrp, valid_from, is_active
        ) VALUES ($1, $2, $3, 'PURCHASE', $4, 'INR', $5, $6, $7, $8, $9, $10, CURRENT_DATE, true)
        ON CONFLICT (price_list_id, item_id, supplier_id, price_type, min_quantity)
        DO UPDATE SET
          unit_price = EXCLUDED.unit_price,
          gst_rate = EXCLUDED.gst_rate,
          lead_time_days = EXCLUDED.lead_time_days,
          supplier_item_code = EXCLUDED.supplier_item_code,
          supplier_item_name = EXCLUDED.supplier_item_name,
          mrp = EXCLUDED.mrp,
          updated_at = CURRENT_TIMESTAMP
      `, [
        priceListId, itemMatch.id, supplierId, unitPrice, minOrderQty,
        gstRate, leadTime, itemCode, itemName, mrp
      ]);

      // Log successful import
      await query(`
        INSERT INTO price_list_import_item_logs (
          import_log_id, row_number, item_code, item_name, unit_price, gst_rate,
          import_status, match_type, matched_item_id, original_data
        ) VALUES ($1, $2, $3, $4, $5, $6, 'success', $7, $8, $9)
      `, [importLogId, rowNumber, itemCode, itemName, unitPrice, gstRate, itemMatch.matchType, itemMatch.id, JSON.stringify(row)]);

      return { status: 'success', itemId: itemMatch.id };

    } catch (error) {
      // Log failed import
      try {
        await query(`
          INSERT INTO price_list_import_item_logs (
            import_log_id, row_number, import_status, error_message, original_data
          ) VALUES ($1, $2, 'failed', $3, $4)
        `, [importLogId, rowNumber, error.message, JSON.stringify(row)]);
      } catch (logError) {
        console.error(`Failed to log error for row ${rowNumber}:`, logError.message);
      }
      
      return { status: 'failed', error: error.message };
    }
  }

  /**
   * Find matching item in item master
   */
  async findMatchingItem(pool, itemCode, itemName) {
    // Try exact match on item_code first
    let result = await query(`
      SELECT id, item_code, name, supplier_id
      FROM items 
      WHERE item_code = $1 AND is_active = true
    `, [itemCode]);

    if (result.rows.length > 0) {
      return { ...result.rows[0], matchType: 'item_code' };
    }

    return null;
  }

  /**
   * Extract value from row with multiple possible column names
   */
  extractValue(row, possibleKeys) {
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    return null;
  }

  /**
   * Get import logs for a price list
   */
  async getImportLogs(priceListId) {
    try {
      const result = await query(`
        SELECT pil.*, u.first_name, u.last_name
        FROM price_list_import_logs pil
        LEFT JOIN users u ON pil.created_by = u.id
        WHERE pil.price_list_id = $1
        ORDER BY pil.started_at DESC
      `, [priceListId]);

      return result.rows;
    } catch (error) {
      console.error('Failed to get import logs:', error);
      throw new Error(`Failed to get import logs: ${error.message}`);
    }
  }

  /**
   * Get detailed import item logs
   */
  async getImportItemLogs(importLogId) {
    try {
      const result = await query(`
        SELECT piil.*, i.item_code as matched_item_code, i.name as matched_item_name
        FROM price_list_import_item_logs piil
        LEFT JOIN items i ON piil.matched_item_id = i.id
        WHERE piil.import_log_id = $1
        ORDER BY piil.row_number
      `, [importLogId]);

      return result.rows;
    } catch (error) {
      console.error('Failed to get import item logs:', error);
      throw new Error(`Failed to get import item logs: ${error.message}`);
    }
  }
}

export default new PriceListImportService();
