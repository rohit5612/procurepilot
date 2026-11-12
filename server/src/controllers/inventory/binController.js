/**
 * Bin Controller
 * Handles HTTP requests for warehouse bin operations
 */

import binService from '../../services/inventory/binService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class BinController {
  /**
   * Get all bins with filtering and pagination
   */
  async getAllBins(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { page = 1, limit = 20, search, warehouse_id, bin_type, status } = req.query;
      const filters = { search, warehouse_id, bin_type, status };

      const result = await binService.getAllBins(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get bin by ID
   */
  async getBinById(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const bin = await binService.getBinById(id);
      
      res.json({
        success: true,
        data: bin
      });
    } catch (error) {
      if (error.message === 'Bin not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new bin
   */
  async createBin(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'create')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const binData = req.body;
      const bin = await binService.createBin(binData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: bin,
        message: 'Bin created successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update bin
   */
  async updateBin(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'update')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const binData = req.body;
      const bin = await binService.updateBin(id, binData, req.user.id);
      
      res.json({
        success: true,
        data: bin,
        message: 'Bin updated successfully'
      });
    } catch (error) {
      if (error.message === 'Bin not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete bin
   */
  async deleteBin(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'delete')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const bin = await binService.deleteBin(id, req.user.id);
      
      res.json({
        success: true,
        data: bin,
        message: 'Bin deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Bin not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get bins by warehouse
   */
  async getBinsByWarehouse(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const bins = await binService.getBinsByWarehouse(warehouseId);
      
      res.json({
        success: true,
        data: bins
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get bin hierarchy
   */
  async getBinHierarchy(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'bin_management', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { warehouseId } = req.params;
      const hierarchy = await binService.getBinHierarchy(warehouseId);
      
      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new BinController();
