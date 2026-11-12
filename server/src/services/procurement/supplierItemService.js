import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class SupplierItemService {
  /**
   * Add item to supplier catalog
   */
  async addSupplierItem(supplierId, itemId, itemData, userId) {
    try {

      
      const result = await query(`
        INSERT INTO supplier_items (
          supplier_id, item_id, supplier_item_code, supplier_item_name,
          is_preferred, lead_time_days, minimum_order_qty, unit_price,
          currency, valid_from, valid_to, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        supplierId,
        itemId,
        itemData.supplier_item_code,
        itemData.supplier_item_name,
        itemData.is_preferred || false,
        itemData.lead_time_days || 0,
        itemData.minimum_order_qty || 1,
        itemData.unit_price || 0,
        itemData.currency || 'INR',
        itemData.valid_from || new Date(),
        itemData.valid_to,
        itemData.notes,
        userId
      ]);

      const supplierItem = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER_ITEM.ADDED',
        supplierItem.id.toString(),
        'supplier_item',
        {
          supplier_item_id: supplierItem.id,
          supplier_id: supplierItem.supplier_id,
          item_id: supplierItem.item_id,
          supplier_item_code: supplierItem.supplier_item_code,
          unit_price: supplierItem.unit_price
        },
        { created_by: userId }
      );

      return supplierItem;
    } catch (error) {
      console.error('Failed to add supplier item:', error);
      throw new Error(`Failed to add supplier item: ${error.message}`);
    }
  }

  /**
   * Get supplier items by supplier ID
   */
  async getSupplierItems(supplierId, filters = {}) {
    try {
      let whereClause = 'WHERE si.supplier_id = $1';
      const params = [supplierId];
      let paramCount = 1;

      if (filters.is_preferred !== undefined) {
        paramCount++;
        whereClause += ` AND si.is_preferred = $${paramCount}`;
        params.push(filters.is_preferred);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (si.supplier_item_code ILIKE $${paramCount} OR si.supplier_item_name ILIKE $${paramCount} OR i.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      const result = await query(`
        SELECT si.*, i.item_code, i.name as item_name, i.unit_of_measure,
               ic.name as category_name
        FROM supplier_items si
        LEFT JOIN items i ON si.item_id = i.id
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        ${whereClause}
        ORDER BY si.is_preferred DESC, si.supplier_item_name
      `, params);

      return result.rows;
    } catch (error) {
      console.error('Failed to get supplier items:', error);
      throw new Error(`Failed to get supplier items: ${error.message}`);
    }
  }

  /**
   * Get item suppliers by item ID
   */
  async getItemSuppliers(itemId) {
    try {
      const result = await query(`
        SELECT si.*, s.supplier_code, s.name as supplier_name, s.status as supplier_status
        FROM supplier_items si
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.item_id = $1
        ORDER BY si.is_preferred DESC, si.unit_price ASC
      `, [itemId]);

      return result.rows;
    } catch (error) {
      console.error('Failed to get item suppliers:', error);
      throw new Error(`Failed to get item suppliers: ${error.message}`);
    }
  }

  /**
   * Update supplier item
   */
  async updateSupplierItem(supplierItemId, updateData, userId) {
    try {
      const oldSupplierItem = await this.getSupplierItemById(supplierItemId);

      const result = await query(`
        UPDATE supplier_items SET
          supplier_item_code = COALESCE($1, supplier_item_code),
          supplier_item_name = COALESCE($2, supplier_item_name),
          is_preferred = COALESCE($3, is_preferred),
          lead_time_days = COALESCE($4, lead_time_days),
          minimum_order_qty = COALESCE($5, minimum_order_qty),
          unit_price = COALESCE($6, unit_price),
          currency = COALESCE($7, currency),
          valid_from = COALESCE($8, valid_from),
          valid_to = COALESCE($9, valid_to),
          notes = COALESCE($10, notes)
        WHERE id = $11
        RETURNING *
      `, [
        updateData.supplier_item_code,
        updateData.supplier_item_name,
        updateData.is_preferred,
        updateData.lead_time_days,
        updateData.minimum_order_qty,
        updateData.unit_price,
        updateData.currency,
        updateData.valid_from,
        updateData.valid_to,
        updateData.notes,
        supplierItemId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Supplier item not found');
      }

      const updatedSupplierItem = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER_ITEM.UPDATED',
        updatedSupplierItem.id.toString(),
        'supplier_item',
        {
          supplier_item_id: updatedSupplierItem.id,
          supplier_id: updatedSupplierItem.supplier_id,
          item_id: updatedSupplierItem.item_id,
          changes: this.getChanges(oldSupplierItem, updatedSupplierItem)
        },
        { updated_by: userId }
      );

      return updatedSupplierItem;
    } catch (error) {
      console.error('Failed to update supplier item:', error);
      throw new Error(`Failed to update supplier item: ${error.message}`);
    }
  }

  /**
   * Remove item from supplier catalog
   */
  async removeSupplierItem(supplierItemId, userId) {
    try {
      const result = await query(`
        DELETE FROM supplier_items WHERE id = $1 RETURNING *
      `, [supplierItemId]);

      if (result.rows.length === 0) {
        throw new Error('Supplier item not found');
      }

      const removedSupplierItem = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.SUPPLIER_ITEM.REMOVED',
        removedSupplierItem.id.toString(),
        'supplier_item',
        {
          supplier_item_id: removedSupplierItem.id,
          supplier_id: removedSupplierItem.supplier_id,
          item_id: removedSupplierItem.item_id
        },
        { removed_by: userId }
      );

      return removedSupplierItem;
    } catch (error) {
      console.error('Failed to remove supplier item:', error);
      throw new Error(`Failed to remove supplier item: ${error.message}`);
    }
  }

  /**
   * Get all supplier items with pagination and filters
   */
  async getAllSupplierItems(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.supplier_id) {
        paramCount++;
        whereClause += ` AND si.supplier_id = $${paramCount}`;
        params.push(filters.supplier_id);
      }

      if (filters.item_id) {
        paramCount++;
        whereClause += ` AND si.item_id = $${paramCount}`;
        params.push(filters.item_id);
      }

      if (filters.is_preferred !== undefined) {
        paramCount++;
        whereClause += ` AND si.is_preferred = $${paramCount}`;
        params.push(filters.is_preferred);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (si.supplier_item_code ILIKE $${paramCount} OR si.supplier_item_name ILIKE $${paramCount} OR i.name ILIKE $${paramCount} OR s.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM supplier_items si
        LEFT JOIN items i ON si.item_id = i.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        ${whereClause}
      `, params);

      const total = parseInt(countResult.rows[0].total);
      const offset = (page - 1) * limit;

      // Get paginated results
      const result = await query(`
        SELECT si.*, i.item_code, i.name as item_name, i.unit_of_measure,
               s.supplier_code, s.name as supplier_name,
               ic.name as category_name
        FROM supplier_items si
        LEFT JOIN items i ON si.item_id = i.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        LEFT JOIN item_categories ic ON i.category_id = ic.id
        ${whereClause}
        ORDER BY si.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...params, limit, offset]);

      return {
        supplierItems: result.rows,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Failed to get all supplier items:', error);
      throw new Error(`Failed to get all supplier items: ${error.message}`);
    }
  }

  /**
   * Get supplier item by ID
   */
  async getSupplierItemById(supplierItemId) {
    try {
      const result = await query(`
        SELECT si.*, i.item_code, i.name as item_name, i.unit_of_measure,
               s.supplier_code, s.name as supplier_name
        FROM supplier_items si
        LEFT JOIN items i ON si.item_id = i.id
        LEFT JOIN suppliers s ON si.supplier_id = s.id
        WHERE si.id = $1
      `, [supplierItemId]);

      if (result.rows.length === 0) {
        throw new Error('Supplier item not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get supplier item:', error);
      throw new Error(`Failed to get supplier item: ${error.message}`);
    }
  }

  /**
   * Helper method to get changes between old and new supplier item data
   */
  getChanges(oldItem, newItem) {
    const changes = {};
    const fields = ['supplier_item_code', 'supplier_item_name', 'is_preferred', 
                   'lead_time_days', 'minimum_order_qty', 'unit_price', 
                   'currency', 'valid_from', 'valid_to', 'notes'];

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
}

export default new SupplierItemService();
