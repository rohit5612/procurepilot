import priceListService from '../../services/procurement/priceListService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class PriceListController {
  /**
   * Create a new price list
   */
  async createPriceList(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const priceListData = req.body;
      const userId = req.user.id;

      const priceList = await priceListService.createPriceList(priceListData, userId);

      res.status(201).json({
        success: true,
        message: 'Price list created successfully',
        data: priceList
      });
    } catch (error) {
      console.error('Error creating price list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get price list by ID
   */
  async getPriceListById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { priceListId } = req.params;

      const priceList = await priceListService.getPriceListById(priceListId);

      res.status(200).json({
        success: true,
        data: priceList
      });
    } catch (error) {
      console.error('Error getting price list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all price lists
   */
  async getPriceLists(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const filters = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await priceListService.getPriceLists(filters, page, limit);

      res.status(200).json({
        success: true,
        data: result.priceLists,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting price lists:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update price list
   */
  async updatePriceList(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { priceListId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedPriceList = await priceListService.updatePriceList(priceListId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Price list updated successfully',
        data: updatedPriceList
      });
    } catch (error) {
      console.error('Error updating price list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete price list
   */
  async deletePriceList(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { priceListId } = req.params;
      const userId = req.user.id;

      const deletedPriceList = await priceListService.deletePriceList(priceListId, userId);

      res.status(200).json({
        success: true,
        message: 'Price list deleted successfully',
        data: deletedPriceList
      });
    } catch (error) {
      console.error('Error deleting price list:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add item price to price list
   */
  async addItemPrice(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { priceListId } = req.params;
      const itemPriceData = req.body;
      const userId = req.user.id;

      const itemPrice = await priceListService.addItemPrice(priceListId, itemPriceData, userId);

      res.status(201).json({
        success: true,
        message: 'Item price added successfully',
        data: itemPrice
      });
    } catch (error) {
      console.error('Error adding item price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add item price (standalone route)
   */
  async addItemPriceStandalone(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const itemPriceData = req.body;
      const userId = req.user.id;

      if (!itemPriceData.price_list_id) {
        return res.status(400).json({
          success: false,
          error: 'Price list ID is required'
        });
      }

      const itemPrice = await priceListService.addItemPrice(itemPriceData.price_list_id, itemPriceData, userId);

      res.status(201).json({
        success: true,
        message: 'Item price added successfully',
        data: itemPrice
      });
    } catch (error) {
      console.error('Error adding item price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item prices by price list ID
   */
  async getItemPrices(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { priceListId } = req.params;
      const filters = req.query;

      const itemPrices = await priceListService.getItemPrices(priceListId, filters);

      res.status(200).json({
        success: true,
        data: itemPrices
      });
    } catch (error) {
      console.error('Error getting item prices:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update item price
   */
  async updateItemPrice(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemPriceId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedItemPrice = await priceListService.updateItemPrice(itemPriceId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Item price updated successfully',
        data: updatedItemPrice
      });
    } catch (error) {
      console.error('Error updating item price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete item price
   */
  async deleteItemPrice(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemPriceId } = req.params;
      const userId = req.user.id;

      const deleted = await priceListService.deleteItemPrice(itemPriceId, userId);

      res.status(200).json({
        success: true,
        message: 'Item price deleted successfully',
        data: deleted
      });
    } catch (error) {
      console.error('Error deleting item price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item price by ID
   */
  async getItemPriceById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemPriceId } = req.params;

      const itemPrice = await priceListService.getItemPriceById(itemPriceId);

      res.status(200).json({
        success: true,
        data: itemPrice
      });
    } catch (error) {
      console.error('Error getting item price:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


}

export default new PriceListController();
