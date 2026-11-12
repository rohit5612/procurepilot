import warehouseService from '../../services/inventory/warehouseService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class WarehouseController {
  /**
   * Create a new warehouse
   */
  async createWarehouse(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const warehouseData = req.body;
      const userId = req.user.id;

      const warehouse = await warehouseService.createWarehouse(warehouseData, userId);

      res.status(201).json({
        success: true,
        message: 'Warehouse created successfully',
        data: warehouse
      });
    } catch (error) {
      console.error('Error creating warehouse:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;

      const warehouse = await warehouseService.getWarehouseById(warehouseId);

      res.status(200).json({
        success: true,
        data: warehouse
      });
    } catch (error) {
      console.error('Error getting warehouse:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all warehouses
   */
  async getWarehouses(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const filters = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await warehouseService.getWarehouses(filters, page, limit);

      res.status(200).json({
        success: true,
        data: result.warehouses,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting warehouses:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedWarehouse = await warehouseService.updateWarehouse(warehouseId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Warehouse updated successfully',
        data: updatedWarehouse
      });
    } catch (error) {
      console.error('Error updating warehouse:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Toggle warehouse status (active/inactive)
   */
  async toggleWarehouseStatus(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const updatedWarehouse = await warehouseService.toggleWarehouseStatus(warehouseId, status, userId);

      res.status(200).json({
        success: true,
        message: `Warehouse ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data: updatedWarehouse
      });
    } catch (error) {
      console.error('Error toggling warehouse status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete warehouse
   */
  async deleteWarehouse(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const userId = req.user.id;

      const deletedWarehouse = await warehouseService.deleteWarehouse(warehouseId, userId);

      res.status(200).json({
        success: true,
        message: 'Warehouse deleted successfully',
        data: deletedWarehouse
      });
    } catch (error) {
      console.error('Error deleting warehouse:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create warehouse zone
   */
  async createWarehouseZone(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const zoneData = req.body;
      const userId = req.user.id;

      const zone = await warehouseService.createWarehouseZone(warehouseId, zoneData, userId);

      res.status(201).json({
        success: true,
        message: 'Warehouse zone created successfully',
        data: zone
      });
    } catch (error) {
      console.error('Error creating warehouse zone:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get warehouse zones
   */
  async getWarehouseZones(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const filters = req.query;

      const zones = await warehouseService.getWarehouseZones(warehouseId, filters);

      res.status(200).json({
        success: true,
        data: zones
      });
    } catch (error) {
      console.error('Error getting warehouse zones:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create warehouse bin
   */
  async createWarehouseBin(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { zoneId } = req.params;
      const binData = req.body;
      const userId = req.user.id;

      const bin = await warehouseService.createWarehouseBin(zoneId, binData, userId);

      res.status(201).json({
        success: true,
        message: 'Warehouse bin created successfully',
        data: bin
      });
    } catch (error) {
      console.error('Error creating warehouse bin:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get warehouse bins
   */
  async getWarehouseBins(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const filters = req.query;

      const bins = await warehouseService.getWarehouseBins(warehouseId, filters);

      res.status(200).json({
        success: true,
        data: bins
      });
    } catch (error) {
      console.error('Error getting warehouse bins:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get default receiving bin
   */
  async getDefaultReceivingBin(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;

      const bin = await warehouseService.getDefaultReceivingBin(warehouseId);

      res.status(200).json({
        success: true,
        data: bin
      });
    } catch (error) {
      console.error('Error getting default receiving bin:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update warehouse bin
   */
  async updateWarehouseBin(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { binId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedBin = await warehouseService.updateWarehouseBin(binId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Warehouse bin updated successfully',
        data: updatedBin
      });
    } catch (error) {
      console.error('Error updating warehouse bin:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get warehouse bin by ID
   */
  async getWarehouseBinById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'warehouse_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { binId } = req.params;

      const bin = await warehouseService.getWarehouseBinById(binId);

      res.status(200).json({
        success: true,
        data: bin
      });
    } catch (error) {
      console.error('Error getting warehouse bin:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }


}

export default new WarehouseController();
