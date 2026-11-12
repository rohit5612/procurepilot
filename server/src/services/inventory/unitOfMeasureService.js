/**
 * Unit of Measure Service
 * Handles unit of measure operations and conversion management
 */

import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class UnitOfMeasureService {
  /**
   * Get all units of measure with optional filtering
   */
  async getAllUnitsOfMeasure(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.uom_type) {
        paramCount++;
        whereClause += ` AND uom.uom_type = $${paramCount}`;
        params.push(filters.uom_type);
      }

      if (filters.is_active !== undefined) {
        paramCount++;
        whereClause += ` AND uom.is_active = $${paramCount}`;
        params.push(filters.is_active);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (uom.uom_code ILIKE $${paramCount} OR uom.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.is_base_unit !== undefined) {
        paramCount++;
        whereClause += ` AND uom.is_base_unit = $${paramCount}`;
        params.push(filters.is_base_unit);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const sqlQuery = `
        SELECT 
          uom.*,
          buom.uom_code as base_uom_code,
          buom.name as base_uom_name
        FROM units_of_measure uom
        LEFT JOIN units_of_measure buom ON uom.base_uom_id = buom.id
        ${whereClause}
        ORDER BY uom.sort_order, uom.uom_code
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await query(sqlQuery, params);
      
      // Get total count
      const countSqlQuery = `
        SELECT COUNT(*) as total
        FROM units_of_measure uom
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
      throw new Error(`Failed to get units of measure: ${error.message}`);
    }
  }

  /**
   * Get unit of measure by ID
   */
  async getUnitOfMeasureById(uomId) {
    try {
      const sqlQuery = `
        SELECT 
          uom.*,
          buom.uom_code as base_uom_code,
          buom.name as base_uom_name
        FROM units_of_measure uom
        LEFT JOIN units_of_measure buom ON uom.base_uom_id = buom.id
        WHERE uom.id = $1
      `;
      
      const result = await query(sqlQuery, [uomId]);
      
      if (result.rows.length === 0) {
        throw new Error('Unit of measure not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get unit of measure: ${error.message}`);
    }
  }

  /**
   * Create new unit of measure
   */
  async createUnitOfMeasure(uomData, userId) {
    try {
      const sqlQuery = `
        INSERT INTO units_of_measure (
          uom_code, name, description, uom_type, base_uom_id,
          conversion_factor, is_base_unit, is_active, sort_order, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const values = [
        uomData.uom_code,
        uomData.name,
        uomData.description,
        uomData.uom_type || 'UNIT',
        uomData.base_uom_id || null,
        uomData.conversion_factor || 1.0,
        uomData.is_base_unit || false,
        uomData.is_active !== undefined ? uomData.is_active : true,
        uomData.sort_order || 0,
        userId
      ];
      
      const result = await query(sqlQuery, values);
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.UOM.CREATED', result.rows[0].id, 'uom', {
        uom_id: result.rows[0].id,
        uom_code: uomData.uom_code,
        created_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create unit of measure: ${error.message}`);
    }
  }

  /**
   * Update unit of measure
   */
  async updateUnitOfMeasure(uomId, uomData, userId) {
    try {
      const sqlQuery = `
        UPDATE units_of_measure SET
          uom_code = $1,
          name = $2,
          description = $3,
          uom_type = $4,
          base_uom_id = $5,
          conversion_factor = $6,
          is_base_unit = $7,
          is_active = $8,
          sort_order = $9,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $10
        WHERE id = $11
        RETURNING *
      `;
      
      const values = [
        uomData.uom_code,
        uomData.name,
        uomData.description,
        uomData.uom_type,
        uomData.base_uom_id || null,
        uomData.conversion_factor || 1.0,
        uomData.is_base_unit || false,
        uomData.is_active !== undefined ? uomData.is_active : true,
        uomData.sort_order || 0,
        userId,
        uomId
      ];
      
      const result = await query(sqlQuery, values);
      
      if (result.rows.length === 0) {
        throw new Error('Unit of measure not found');
      }
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.UOM.UPDATED', uomId, 'uom', {
        uom_id: uomId,
        uom_code: uomData.uom_code,
        updated_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update unit of measure: ${error.message}`);
    }
  }

  /**
   * Delete unit of measure
   */
  async deleteUnitOfMeasure(uomId, userId) {
    try {
      // Check if UoM is used by items
      const itemQuery = 'SELECT COUNT(*) as count FROM items WHERE uom_id = $1 OR base_uom_id = $1';
      const itemResult = await query(itemQuery, [uomId]);
      
      if (parseInt(itemResult.rows[0].count) > 0) {
        throw new Error('Cannot delete unit of measure used by items');
      }
      
      // Check if UoM is used as base UoM by other UoMs
      const baseQuery = 'SELECT COUNT(*) as count FROM units_of_measure WHERE base_uom_id = $1';
      const baseResult = await query(baseQuery, [uomId]);
      
      if (parseInt(baseResult.rows[0].count) > 0) {
        throw new Error('Cannot delete unit of measure used as base unit by other units');
      }
      
      const query = 'DELETE FROM units_of_measure WHERE id = $1 RETURNING *';
      const result = await query(sqlQuery, [uomId]);
      
      if (result.rows.length === 0) {
        throw new Error('Unit of measure not found');
      }
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.UOM.DELETED', uomId, 'uom', {
        uom_id: uomId,
        uom_code: result.rows[0].uom_code,
        deleted_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to delete unit of measure: ${error.message}`);
    }
  }

  /**
   * Get units of measure by type
   */
  async getUnitsOfMeasureByType(uomType) {
    try {
      const sqlQuery = `
        SELECT 
          uom.*,
          buom.uom_code as base_uom_code,
          buom.name as base_uom_name
        FROM units_of_measure uom
        LEFT JOIN units_of_measure buom ON uom.base_uom_id = buom.id
        WHERE uom.uom_type = $1 AND uom.is_active = true
        ORDER BY uom.sort_order, uom.uom_code
      `;
      
      const result = await query(sqlQuery, [uomType]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get units of measure by type: ${error.message}`);
    }
  }

  /**
   * Get base units of measure
   */
  async getBaseUnitsOfMeasure() {
    try {
      const sqlQuery = `
        SELECT * FROM units_of_measure 
        WHERE is_base_unit = true AND is_active = true
        ORDER BY sort_order, uom_code
      `;
      
      const result = await query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get base units of measure: ${error.message}`);
    }
  }

  /**
   * Convert between units of measure
   */
  async convertUnit(fromUomId, toUomId, quantity) {
    try {
      // Get both UoMs
      const fromUom = await this.getUnitOfMeasureById(fromUomId);
      const toUom = await this.getUnitOfMeasureById(toUomId);
      
      // If same UoM, return original quantity
      if (fromUomId === toUomId) {
        return quantity;
      }
      
      // If both have same base UoM, convert through base
      if (fromUom.base_uom_id === toUom.base_uom_id) {
        const fromToBase = fromUom.conversion_factor;
        const baseToTo = 1 / toUom.conversion_factor;
        return quantity * fromToBase * baseToTo;
      }
      
      // If different base UoMs, cannot convert
      throw new Error('Cannot convert between different base unit types');
    } catch (error) {
      throw new Error(`Failed to convert unit: ${error.message}`);
    }
  }

  /**
   * Get conversion path between units
   */
  async getConversionPath(fromUomId, toUomId) {
    try {
      const fromUom = await this.getUnitOfMeasureById(fromUomId);
      const toUom = await this.getUnitOfMeasureById(toUomId);
      
      if (fromUom.base_uom_id === toUom.base_uom_id) {
        return {
          from: fromUom,
          to: toUom,
          base: await this.getUnitOfMeasureById(fromUom.base_uom_id),
          conversion_factor: fromUom.conversion_factor / toUom.conversion_factor
        };
      }
      
      return null; // No conversion path
    } catch (error) {
      throw new Error(`Failed to get conversion path: ${error.message}`);
    }
  }
}

export default new UnitOfMeasureService();
