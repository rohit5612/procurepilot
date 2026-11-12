import { clusterService } from '../../services/system/clusterService.js';

/**
 * Controller for clusters management
 */

export const clusterController = {
  /**
   * Get all clusters
   */
  async getAll(req, res) {
    try {
      const { circle_id, search } = req.query;
      
      const clusters = await clusterService.getAll({ circle_id, search });
      
      res.json({
        success: true,
        data: clusters,
        count: clusters.length
      });
    } catch (error) {
      console.error('Error fetching clusters:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clusters',
        error: error.message
      });
    }
  },

  /**
   * Get cluster by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const cluster = await clusterService.getById(id);
      
      res.json({
        success: true,
        data: cluster
      });
    } catch (error) {
      console.error('Error fetching cluster:', error);
      const status = error.message === 'Cluster not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Create new cluster
   */
  async create(req, res) {
    try {
      const clusterData = req.body;
      
      const cluster = await clusterService.create(clusterData);
      
      res.status(201).json({
        success: true,
        message: 'Cluster created successfully',
        data: cluster
      });
    } catch (error) {
      console.error('Error creating cluster:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create cluster',
        error: error.message
      });
    }
  },

  /**
   * Update cluster
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const clusterData = req.body;
      
      const cluster = await clusterService.update(id, clusterData);
      
      res.json({
        success: true,
        message: 'Cluster updated successfully',
        data: cluster
      });
    } catch (error) {
      console.error('Error updating cluster:', error);
      const status = error.message === 'Cluster not found' ? 404 : 400;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Delete cluster
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      await clusterService.delete(id);
      
      res.json({
        success: true,
        message: 'Cluster deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting cluster:', error);
      const status = error.message === 'Cluster not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Get clusters for a specific circle
   */
  async getByCircle(req, res) {
    try {
      const { circleId } = req.params;
      
      const clusters = await clusterService.getByCircle(circleId);
      
      res.json({
        success: true,
        data: clusters,
        count: clusters.length
      });
    } catch (error) {
      console.error('Error fetching clusters by circle:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clusters',
        error: error.message
      });
    }
  }
};

