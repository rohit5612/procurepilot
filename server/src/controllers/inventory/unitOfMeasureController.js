/**
 * Unit of Measure Controller
 * Handles HTTP requests for unit of measure operations
 */

import unitOfMeasureService from '../../services/inventory/unitOfMeasureService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class UnitOfMeasureController {
  /**
   * Get all units of measure with filtering and pagination
   */
  async getAllUnitsOfMeasure(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { page = 1, limit = 20, search, uom_type, is_active, is_base_unit } = req.query;
      const filters = { search, uom_type, is_active, is_base_unit };

      const result = await unitOfMeasureService.getAllUnitsOfMeasure(filters, parseInt(page), parseInt(limit));
      
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
   * Get unit of measure by ID
   */
  async getUnitOfMeasureById(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const uom = await unitOfMeasureService.getUnitOfMeasureById(id);
      
      res.json({
        success: true,
        data: uom
      });
    } catch (error) {
      if (error.message === 'Unit of measure not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new unit of measure
   */
  async createUnitOfMeasure(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'create')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const uomData = req.body;
      const uom = await unitOfMeasureService.createUnitOfMeasure(uomData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: uom,
        message: 'Unit of measure created successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update unit of measure
   */
  async updateUnitOfMeasure(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'update')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const uomData = req.body;
      const uom = await unitOfMeasureService.updateUnitOfMeasure(id, uomData, req.user.id);
      
      res.json({
        success: true,
        data: uom,
        message: 'Unit of measure updated successfully'
      });
    } catch (error) {
      if (error.message === 'Unit of measure not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete unit of measure
   */
  async deleteUnitOfMeasure(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'delete')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const uom = await unitOfMeasureService.deleteUnitOfMeasure(id, req.user.id);
      
      res.json({
        success: true,
        data: uom,
        message: 'Unit of measure deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Unit of measure not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get units of measure by type
   */
  async getUnitsOfMeasureByType(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { type } = req.params;
      const uoms = await unitOfMeasureService.getUnitsOfMeasureByType(type);
      
      res.json({
        success: true,
        data: uoms
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get base units of measure
   */
  async getBaseUnitsOfMeasure(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const uoms = await unitOfMeasureService.getBaseUnitsOfMeasure();
      
      res.json({
        success: true,
        data: uoms
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Convert between units of measure
   */
  async convertUnit(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { from_uom_id, to_uom_id, quantity } = req.body;
      const convertedQuantity = await unitOfMeasureService.convertUnit(from_uom_id, to_uom_id, quantity);
      
      res.json({
        success: true,
        data: {
          from_uom_id,
          to_uom_id,
          original_quantity: quantity,
          converted_quantity: convertedQuantity
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get conversion path between units
   */
  async getConversionPath(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { from_uom_id, to_uom_id } = req.params;
      const path = await unitOfMeasureService.getConversionPath(from_uom_id, to_uom_id);
      
      res.json({
        success: true,
        data: path
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new UnitOfMeasureController();
