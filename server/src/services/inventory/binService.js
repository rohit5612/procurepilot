/**
 * Bin Service
 * Handles warehouse bin operations and nested bin management
 */

import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class BinService {
  /**
   * Get all bins with optional filtering
   */
  async getAllBins(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.warehouse_id) {
        paramCount++;
        whereClause += ` AND b.warehouse_id = $${paramCount}`;
        params.push(filters.warehouse_id);
      }

      if (filters.bin_type) {
        paramCount++;
        whereClause += ` AND b.bin_type = $${paramCount}`;
        params.push(filters.bin_type);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND b.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (b.bin_code ILIKE $${paramCount} OR b.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const sqlQuery = `
        SELECT 
          b.*,
          w.name as warehouse_name,
          w.warehouse_code as warehouse_code,
          pb.bin_code as parent_bin_code,
          pb.name as parent_bin_name
        FROM bins b
        LEFT JOIN warehouses w ON b.warehouse_id = w.id
        LEFT JOIN bins pb ON b.parent_bin_id = pb.id
        ${whereClause}
        ORDER BY b.warehouse_id, b.bin_code
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await query(sqlQuery, params);
      
      // Get total count
      const countSqlQuery = `
        SELECT COUNT(*) as total
        FROM bins b
        ${whereClause}
      `;
      const countResult = await query(countSqlQuery, params.slice(0, -2));
      
      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get bins: ${error.message}`);
    }
  }

  /**
   * Get bin by ID
   */
  async getBinById(binId) {
    try {
      const sqlQuery = `
        SELECT 
          b.*,
          w.name as warehouse_name,
          w.warehouse_code as warehouse_code,
          pb.bin_code as parent_bin_code,
          pb.name as parent_bin_name
        FROM bins b
        LEFT JOIN warehouses w ON b.warehouse_id = w.id
        LEFT JOIN bins pb ON b.parent_bin_id = pb.id
        WHERE b.id = $1
      `;
      
      const result = await query(sqlQuery, [binId]);
      
      if (result.rows.length === 0) {
        throw new Error('Bin not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get bin: ${error.message}`);
    }
  }

  /**
   * Create new bin
   */
  async createBin(binData, userId) {
    try {
      const sqlQuery = `
        INSERT INTO bins (
          bin_code, name, description, warehouse_id, parent_bin_id,
          bin_type, status, capacity_volume, capacity_weight,
          temperature_zone, is_default_receiving, is_default_shipping,
          is_restricted, restriction_reason, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;
      
      const values = [
        binData.bin_code,
        binData.name,
        binData.description,
        binData.warehouse_id,
        binData.parent_bin_id || null,
        binData.bin_type || 'STORAGE',
        binData.status || 'ACTIVE',
        binData.capacity_volume || null,
        binData.capacity_weight || null,
        binData.temperature_zone || 'AMBIENT',
        binData.is_default_receiving || false,
        binData.is_default_shipping || false,
        binData.is_restricted || false,
        binData.restriction_reason || null,
        userId
      ];
      
      const result = await query(sqlQuery, values);
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.BIN.CREATED', result.rows[0].id, 'bin', {
        bin_id: result.rows[0].id,
        warehouse_id: binData.warehouse_id,
        bin_code: binData.bin_code,
        created_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create bin: ${error.message}`);
    }
  }

  /**
   * Update bin
   */
  async updateBin(binId, binData, userId) {
    try {
      const sqlQuery = `
        UPDATE bins SET
          bin_code = $1,
          name = $2,
          description = $3,
          warehouse_id = $4,
          parent_bin_id = $5,
          bin_type = $6,
          status = $7,
          capacity_volume = $8,
          capacity_weight = $9,
          temperature_zone = $10,
          is_default_receiving = $11,
          is_default_shipping = $12,
          is_restricted = $13,
          restriction_reason = $14,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $15
        WHERE id = $16
        RETURNING *
      `;
      
      const values = [
        binData.bin_code,
        binData.name,
        binData.description,
        binData.warehouse_id,
        binData.parent_bin_id || null,
        binData.bin_type,
        binData.status,
        binData.capacity_volume || null,
        binData.capacity_weight || null,
        binData.temperature_zone,
        binData.is_default_receiving || false,
        binData.is_default_shipping || false,
        binData.is_restricted || false,
        binData.restriction_reason || null,
        userId,
        binId
      ];
      
      const result = await query(sqlQuery, values);
      
      if (result.rows.length === 0) {
        throw new Error('Bin not found');
      }
      
      // Publish domain event
      try {
        await domainEventService.publishEvent('INVENTORY.BIN.UPDATED', binId, 'bin', {
          bin_id: binId,
          warehouse_id: binData.warehouse_id,
          bin_code: binData.bin_code,
          updated_by: userId
        });
      } catch (eventError) {
        console.error('Domain event error:', eventError);
        // Continue even if domain event fails
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update bin: ${error.message}`);
    }
  }

  /**
   * Delete bin
   */
  async deleteBin(binId, userId) {
    try {
      // Check if bin has child bins
      const childQuery = 'SELECT COUNT(*) as count FROM bins WHERE parent_bin_id = $1';
      const childResult = await query(childQuery, [binId]);
      
      if (parseInt(childResult.rows[0].count) > 0) {
        throw new Error('Cannot delete bin with child bins');
      }
      
      const sqlQuery = 'DELETE FROM bins WHERE id = $1 RETURNING *';
      const result = await query(sqlQuery, [binId]);
      
      if (result.rows.length === 0) {
        throw new Error('Bin not found');
      }
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.BIN.DELETED', binId, 'bin', {
        bin_id: binId,
        warehouse_id: result.rows[0].warehouse_id,
        bin_code: result.rows[0].bin_code,
        deleted_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to delete bin: ${error.message}`);
    }
  }

  /**
   * Get bins by warehouse
   */
  async getBinsByWarehouse(warehouseId) {
    try {
      const sqlQuery = `
        SELECT 
          b.*,
          pb.bin_code as parent_bin_code,
          pb.name as parent_bin_name
        FROM bins b
        LEFT JOIN bins pb ON b.parent_bin_id = pb.id
        WHERE b.warehouse_id = $1
        ORDER BY b.bin_code
      `;
      
      const result = await query(sqlQuery, [warehouseId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get warehouse bins: ${error.message}`);
    }
  }

  /**
   * Get bin hierarchy (nested bins)
   */
  async getBinHierarchy(warehouseId) {
    try {
      const sqlQuery = `
        WITH RECURSIVE bin_tree AS (
          SELECT 
            id, bin_code, name, parent_bin_id, bin_type, status,
            0 as level,
            ARRAY[bin_code] as path
          FROM bins 
          WHERE warehouse_id = $1 AND parent_bin_id IS NULL
          
          UNION ALL
          
          SELECT 
            b.id, b.bin_code, b.name, b.parent_bin_id, b.bin_type, b.status,
            bt.level + 1,
            bt.path || b.bin_code
          FROM bins b
          INNER JOIN bin_tree bt ON b.parent_bin_id = bt.id
        )
        SELECT * FROM bin_tree
        ORDER BY path
      `;
      
      const result = await query(sqlQuery, [warehouseId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get bin hierarchy: ${error.message}`);
    }
  }
}

export default new BinService();
