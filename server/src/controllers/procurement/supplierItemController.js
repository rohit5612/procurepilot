import supplierItemService from '../../services/procurement/supplierItemService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class SupplierItemController {
  /**
   * Add item to supplier catalog
   */
  async addSupplierItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      // Handle both URL params and request body for supplierId
      const supplierId = req.params.supplierId || req.body.supplier_id;
      const { item_id, supplier_id, ...itemData } = req.body;
      const userId = req.user.id;



      if (!supplierId) {
        return res.status(400).json({
          success: false,
          error: 'Supplier ID is required'
        });
      }

      if (!item_id) {
        return res.status(400).json({
          success: false,
          error: 'Item ID is required'
        });
      }

      const supplierItem = await supplierItemService.addSupplierItem(supplierId, item_id, itemData, userId);

      res.status(201).json({
        success: true,
        message: 'Item added to supplier catalog successfully',
        data: supplierItem
      });
    } catch (error) {
      console.error('Error adding supplier item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get supplier items
   */
  async getSupplierItems(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;
      const filters = req.query;

      const supplierItems = await supplierItemService.getSupplierItems(supplierId, filters);

      res.status(200).json({
        success: true,
        data: supplierItems
      });
    } catch (error) {
      console.error('Error getting supplier items:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all supplier items with pagination and filters
   */
  async getAllSupplierItems(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const filters = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await supplierItemService.getAllSupplierItems(filters, page, limit);

      res.status(200).json({
        success: true,
        data: result.supplierItems,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting all supplier items:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item suppliers
   */
  async getItemSuppliers(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemId } = req.params;

      const itemSuppliers = await supplierItemService.getItemSuppliers(itemId);

      res.status(200).json({
        success: true,
        data: itemSuppliers
      });
    } catch (error) {
      console.error('Error getting item suppliers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update supplier item
   */
  async updateSupplierItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierItemId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedSupplierItem = await supplierItemService.updateSupplierItem(supplierItemId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Supplier item updated successfully',
        data: updatedSupplierItem
      });
    } catch (error) {
      console.error('Error updating supplier item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Remove supplier item
   */
  async removeSupplierItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierItemId } = req.params;
      const userId = req.user.id;

      const removedSupplierItem = await supplierItemService.removeSupplierItem(supplierItemId, userId);

      res.status(200).json({
        success: true,
        message: 'Item removed from supplier catalog successfully',
        data: removedSupplierItem
      });
    } catch (error) {
      console.error('Error removing supplier item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get supplier item by ID
   */
  async getSupplierItemById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierItemId } = req.params;

      const supplierItem = await supplierItemService.getSupplierItemById(supplierItemId);

      res.status(200).json({
        success: true,
        data: supplierItem
      });
    } catch (error) {
      console.error('Error getting supplier item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


}

export default new SupplierItemController();
