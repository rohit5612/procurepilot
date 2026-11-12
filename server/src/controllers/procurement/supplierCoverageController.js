import { supplierCoverageService } from '../../services/procurement/supplierCoverageService.js';

/**
 * Controller for supplier circle/cluster coverage
 */

export const supplierCoverageController = {
  /**
   * List all supplier coverage (used by admin UI)
   */
  async listAll(req, res) {
    try {
      const rows = await supplierCoverageService.listAll();
      res.json({ success: true, data: rows });
    } catch (error) {
      console.error('Error listing supplier coverage:', error);
      res.status(500).json({ success: false, message: 'Failed to load supplier coverage' });
    }
  },
  /**
   * Get supplier's circle coverage
   */
  async getSupplierCircles(req, res) {
    try {
      const { supplierId } = req.params;
      
      const circles = await supplierCoverageService.getSupplierCircles(supplierId);
      
      res.json({
        success: true,
        data: circles
      });
    } catch (error) {
      console.error('Error fetching supplier circles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch supplier circles',
        error: error.message
      });
    }
  },

  /**
   * Get supplier's cluster coverage
   */
  async getSupplierClusters(req, res) {
    try {
      const { supplierId } = req.params;
      
      const clusters = await supplierCoverageService.getSupplierClusters(supplierId);
      
      res.json({
        success: true,
        data: clusters
      });
    } catch (error) {
      console.error('Error fetching supplier clusters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch supplier clusters',
        error: error.message
      });
    }
  },

  /**
   * Update supplier's circle coverage
   */
  async updateSupplierCircles(req, res) {
    try {
      const { supplierId } = req.params;
      const { circle_ids } = req.body;
      
      const circles = await supplierCoverageService.setSupplierCircles(
        supplierId,
        circle_ids || []
      );
      
      res.json({
        success: true,
        message: 'Supplier circle coverage updated',
        data: circles
      });
    } catch (error) {
      console.error('Error updating supplier circles:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update supplier circles',
        error: error.message
      });
    }
  },

  /**
   * Update supplier's cluster coverage
   */
  async updateSupplierClusters(req, res) {
    try {
      const { supplierId } = req.params;
      const { cluster_ids } = req.body;
      
      const clusters = await supplierCoverageService.setSupplierClusters(
        supplierId,
        cluster_ids || []
      );
      
      res.json({
        success: true,
        message: 'Supplier cluster coverage updated',
        data: clusters
      });
    } catch (error) {
      console.error('Error updating supplier clusters:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update supplier clusters',
        error: error.message
      });
    }
  }
};

