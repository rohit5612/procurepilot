import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class PriceListService {
  /**
   * Create a new price list
   */
  async createPriceList(priceListData, userId) {
    try {
      const result = await query(`
        INSERT INTO price_lists (
          name, description, supplier_id, currency, is_active, valid_from, valid_to, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        priceListData.name,
        priceListData.description,
        priceListData.supplier_id || null,
        priceListData.currency || 'INR',
        priceListData.is_active !== undefined ? priceListData.is_active : true,
        priceListData.valid_from || new Date(),
        priceListData.valid_to,
        userId
      ]);

      const priceList = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.PRICE_LIST.CREATED',
        priceList.id.toString(),
        'price_list',
        {
          price_list_id: priceList.id,
          name: priceList.name,
          currency: priceList.currency
        },
        { created_by: userId }
      );

      return priceList;
    } catch (error) {
      console.error('Failed to create price list:', error);
      throw new Error(`Failed to create price list: ${error.message}`);
    }
  }

  /**
   * Get price list by ID
   */
  async getPriceListById(priceListId) {
    try {
      // Get price list details
      const priceListResult = await query(`
        SELECT pl.*, s.name as supplier_name, s.supplier_code
        FROM price_lists pl
        LEFT JOIN suppliers s ON pl.supplier_id = s.id
        WHERE pl.id = $1
      `, [priceListId]);

      if (priceListResult.rows.length === 0) {
        throw new Error('Price list not found');
      }

      const priceList = priceListResult.rows[0];

      // Get item prices for this price list
      const itemPricesResult = await query(`
        SELECT ip.*, i.name as item_name, i.item_code
        FROM item_prices ip
        LEFT JOIN items i ON ip.item_id = i.id
        WHERE ip.price_list_id = $1
        ORDER BY ip.created_at DESC
      `, [priceListId]);

      // Add item prices to the price list
      priceList.item_prices = itemPricesResult.rows;

      return priceList;
    } catch (error) {
      console.error('Failed to get price list:', error);
      throw new Error(`Failed to get price list: ${error.message}`);
    }
  }

  /**
   * Get all price lists with pagination and filters
   */
  async getPriceLists(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.currency) {
        paramCount++;
        whereClause += ` AND currency = $${paramCount}`;
        params.push(filters.currency);
      }

      if (filters.supplier_id) {
        paramCount++;
        whereClause += ` AND supplier_id = $${paramCount}`;
        params.push(filters.supplier_id);
      }

      if (filters.is_active !== undefined) {
        paramCount++;
        whereClause += ` AND is_active = $${paramCount}`;
        params.push(filters.is_active);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT pl.*, s.name as supplier_name, s.supplier_code, COUNT(*) OVER() as total_count
        FROM price_lists pl
        LEFT JOIN suppliers s ON pl.supplier_id = s.id
        ${whereClause}
        ORDER BY pl.created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        priceLists: result.rows,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        page,
        limit,
        totalPages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      };
    } catch (error) {
      console.error('Failed to get price lists:', error);
      throw new Error(`Failed to get price lists: ${error.message}`);
    }
  }

  /**
   * Update price list
   */
  async updatePriceList(priceListId, updateData, userId) {
    try {
      const oldPriceList = await this.getPriceListById(priceListId);

      const result = await query(`
        UPDATE price_lists SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          supplier_id = COALESCE($3, supplier_id),
          currency = COALESCE($4, currency),
          is_active = COALESCE($5, is_active),
          valid_from = COALESCE($6, valid_from),
          valid_to = COALESCE($7, valid_to)
        WHERE id = $8
        RETURNING *
      `, [
        updateData.name,
        updateData.description,
        updateData.supplier_id,
        updateData.currency,
        updateData.is_active,
        updateData.valid_from,
        updateData.valid_to,
        priceListId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Price list not found');
      }

      const updatedPriceList = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.PRICE_LIST.UPDATED',
        updatedPriceList.id.toString(),
        'price_list',
        {
          price_list_id: updatedPriceList.id,
          name: updatedPriceList.name,
          changes: this.getChanges(oldPriceList, updatedPriceList)
        },
        { updated_by: userId }
      );

      return updatedPriceList;
    } catch (error) {
      console.error('Failed to update price list:', error);
      throw new Error(`Failed to update price list: ${error.message}`);
    }
  }

  /**
   * Delete price list (hard delete)
   */
  async deletePriceList(priceListId, userId) {
    try {
      const result = await query(`
        DELETE FROM price_lists WHERE id = $1 RETURNING *
      `, [priceListId]);

      if (result.rows.length === 0) {
        throw new Error('Price list not found');
      }

      const deletedPriceList = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.PRICE_LIST.DELETED',
        deletedPriceList.id.toString(),
        'price_list',
        {
          price_list_id: deletedPriceList.id,
          name: deletedPriceList.name
        },
        { deleted_by: userId }
      );

      return deletedPriceList;
    } catch (error) {
      console.error('Failed to delete price list:', error);
      throw new Error(`Failed to delete price list: ${error.message}`);
    }
  }

  /**
   * Add item price to price list
   */
  async addItemPrice(priceListId, itemPriceData, userId) {
    try {
      const result = await query(`
        INSERT INTO item_prices (
          price_list_id, item_id, supplier_id, price_type, unit_price,
          currency, min_quantity, max_quantity, valid_from, valid_to, is_active,
          gst_rate, lead_time_days, supplier_item_code, supplier_item_name, mrp
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
        )
        RETURNING *
      `, [
        priceListId,
        itemPriceData.item_id,
        itemPriceData.supplier_id,
        itemPriceData.price_type || 'PURCHASE',
        itemPriceData.unit_price,
        itemPriceData.currency || 'INR',
        itemPriceData.min_quantity || 1,
        itemPriceData.max_quantity,
        itemPriceData.valid_from || new Date(),
        itemPriceData.valid_to,
        itemPriceData.is_active !== undefined ? itemPriceData.is_active : true,
        itemPriceData.gst_rate || 0,
        itemPriceData.lead_time_days || 0,
        itemPriceData.supplier_item_code || null,
        itemPriceData.supplier_item_name || null,
        itemPriceData.mrp || 0
      ]);

      const itemPrice = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.ITEM_PRICE.ADDED',
        itemPrice.id.toString(),
        'item_price',
        {
          item_price_id: itemPrice.id,
          price_list_id: itemPrice.price_list_id,
          item_id: itemPrice.item_id,
          supplier_id: itemPrice.supplier_id,
          unit_price: itemPrice.unit_price,
          price_type: itemPrice.price_type
        },
        { created_by: userId }
      );

      return itemPrice;
    } catch (error) {
      console.error('Failed to add item price:', error);
      throw new Error(`Failed to add item price: ${error.message}`);
    }
  }

  /**
   * Get item prices by price list ID
   */
  async getItemPrices(priceListId, filters = {}) {
    try {
      let whereClause = 'WHERE ip.price_list_id = $1';
      const params = [priceListId];
      let paramCount = 1;

      if (filters.price_type) {
        paramCount++;
        whereClause += ` AND ip.price_type = $${paramCount}`;
        params.push(filters.price_type);
      }

      if (filters.supplier_id) {
        paramCount++;
        whereClause += ` AND ip.supplier_id = $${paramCount}`;
        params.push(filters.supplier_id);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (i.item_code ILIKE $${paramCount} OR i.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      const result = await query(`
        SELECT ip.*, i.item_code, i.name as item_name, i.unit_of_measure,
               s.supplier_code, s.name as supplier_name,
               pl.name as price_list_name
        FROM item_prices ip
        LEFT JOIN items i ON ip.item_id = i.id
        LEFT JOIN suppliers s ON ip.supplier_id = s.id
        LEFT JOIN price_lists pl ON ip.price_list_id = pl.id
        ${whereClause}
        ORDER BY i.name, ip.min_quantity
      `, params);

      return result.rows;
    } catch (error) {
      console.error('Failed to get item prices:', error);
      throw new Error(`Failed to get item prices: ${error.message}`);
    }
  }

  /**
   * Lookup price for supplier+item using supplier's applied price list.
   */
  async getAppliedPriceForSupplierItem(supplierId, itemId) {
    try {
      const res = await query(`
        SELECT ip.*
        FROM suppliers s
        JOIN item_prices ip ON ip.price_list_id = s.applied_price_list_id AND ip.item_id = $2 AND ip.supplier_id = $1
        WHERE s.id = $1
        ORDER BY ip.valid_from DESC, ip.created_at DESC
        LIMIT 1
      `, [supplierId, itemId]);
      return res.rows[0] || null;
    } catch (error) {
      console.error('Failed to lookup applied price:', error);
      throw new Error(`Failed to lookup applied price: ${error.message}`);
    }
  }

  /**
   * Update item price
   */
  async updateItemPrice(itemPriceId, updateData, userId) {
    try {
      const oldItemPrice = await this.getItemPriceById(itemPriceId);

      const result = await query(`
        UPDATE item_prices SET
          price_type = COALESCE($1, price_type),
          unit_price = COALESCE($2, unit_price),
          currency = COALESCE($3, currency),
          min_quantity = COALESCE($4, min_quantity),
          max_quantity = COALESCE($5, max_quantity),
          valid_from = COALESCE($6, valid_from),
          valid_to = COALESCE($7, valid_to),
          is_active = COALESCE($8, is_active),
          gst_rate = COALESCE($9, gst_rate),
          lead_time_days = COALESCE($10, lead_time_days),
          supplier_item_code = COALESCE($11, supplier_item_code),
          supplier_item_name = COALESCE($12, supplier_item_name),
          mrp = COALESCE($13, mrp)
        WHERE id = $14
        RETURNING *
      `, [
        updateData.price_type,
        updateData.unit_price,
        updateData.currency,
        updateData.min_quantity,
        updateData.max_quantity,
        updateData.valid_from,
        updateData.valid_to,
        updateData.is_active,
        updateData.gst_rate,
        updateData.lead_time_days,
        updateData.supplier_item_code,
        updateData.supplier_item_name,
        updateData.mrp,
        itemPriceId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Item price not found');
      }

      const updatedItemPrice = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'PROCUREMENT.ITEM_PRICE.UPDATED',
        updatedItemPrice.id.toString(),
        'item_price',
        {
          item_price_id: updatedItemPrice.id,
          price_list_id: updatedItemPrice.price_list_id,
          item_id: updatedItemPrice.item_id,
          changes: this.getPriceChanges(oldItemPrice, updatedItemPrice)
        },
        { updated_by: userId }
      );

      return updatedItemPrice;
    } catch (error) {
      console.error('Failed to update item price:', error);
      throw new Error(`Failed to update item price: ${error.message}`);
    }
  }

  /**
   * Get item price by ID
   */
  async getItemPriceById(itemPriceId) {
    try {
      const result = await query(`
        SELECT ip.*, i.item_code, i.name as item_name, i.unit_of_measure,
               s.supplier_code, s.name as supplier_name,
               pl.name as price_list_name
        FROM item_prices ip
        LEFT JOIN items i ON ip.item_id = i.id
        LEFT JOIN suppliers s ON ip.supplier_id = s.id
        LEFT JOIN price_lists pl ON ip.price_list_id = pl.id
        WHERE ip.id = $1
      `, [itemPriceId]);

      if (result.rows.length === 0) {
        throw new Error('Item price not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get item price:', error);
      throw new Error(`Failed to get item price: ${error.message}`);
    }
  }

  /**
   * Delete item price
   */
  async deleteItemPrice(itemPriceId, userId) {
    try {
      const result = await query(`DELETE FROM item_prices WHERE id = $1 RETURNING *`, [itemPriceId]);
      if (result.rows.length === 0) {
        throw new Error('Item price not found');
      }
      const deleted = result.rows[0];
      await domainEventService.publishEvent(
        'PROCUREMENT.ITEM_PRICE.DELETED',
        deleted.id.toString(),
        'item_price',
        { item_price_id: deleted.id, price_list_id: deleted.price_list_id, item_id: deleted.item_id },
        { deleted_by: userId }
      );
      return deleted;
    } catch (error) {
      console.error('Failed to delete item price:', error);
      throw new Error(`Failed to delete item price: ${error.message}`);
    }
  }

  /**
   * Helper method to get changes between old and new price list data
   */
  getChanges(oldPriceList, newPriceList) {
    const changes = {};
    const fields = ['name', 'description', 'currency', 'is_active', 'valid_from', 'valid_to'];

    fields.forEach(field => {
      if (oldPriceList[field] !== newPriceList[field]) {
        changes[field] = {
          old: oldPriceList[field],
          new: newPriceList[field]
        };
      }
    });

    return changes;
  }

  /**
   * Helper method to get changes between old and new item price data
   */
  getPriceChanges(oldItemPrice, newItemPrice) {
    const changes = {};
    const fields = ['price_type', 'unit_price', 'currency', 'min_quantity', 'max_quantity', 'valid_from', 'valid_to', 'is_active'];

    fields.forEach(field => {
      if (oldItemPrice[field] !== newItemPrice[field]) {
        changes[field] = {
          old: oldItemPrice[field],
          new: newItemPrice[field]
        };
      }
    });

    return changes;
  }
}

export default new PriceListService();
