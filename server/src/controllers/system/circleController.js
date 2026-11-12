import { circleService } from '../../services/system/circleService.js';

/**
 * Controller for telecom circles management
 */

export const circleController = {
  /**
   * Get all circles
   */
  async getAll(req, res) {
    try {
      const { region, search } = req.query;
      
      const circles = await circleService.getAll({ region, search });
      
      res.json({
        success: true,
        data: circles,
        count: circles.length
      });
    } catch (error) {
      console.error('Error fetching circles:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch circles',
        error: error.message
      });
    }
  },

  /**
   * Get circle by ID
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      
      const circle = await circleService.getById(id);
      
      res.json({
        success: true,
        data: circle
      });
    } catch (error) {
      console.error('Error fetching circle:', error);
      const status = error.message === 'Circle not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Create new circle
   */
  async create(req, res) {
    try {
      const circleData = req.body;
      
      const circle = await circleService.create(circleData);
      
      res.status(201).json({
        success: true,
        message: 'Circle created successfully',
        data: circle
      });
    } catch (error) {
      console.error('Error creating circle:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to create circle',
        error: error.message
      });
    }
  },

  /**
   * Update circle
   */
  async update(req, res) {
    try {
      const { id } = req.params;
      const circleData = req.body;
      
      const circle = await circleService.update(id, circleData);
      
      res.json({
        success: true,
        message: 'Circle updated successfully',
        data: circle
      });
    } catch (error) {
      console.error('Error updating circle:', error);
      const status = error.message === 'Circle not found' ? 404 : 400;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Delete circle
   */
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      await circleService.delete(id);
      
      res.json({
        success: true,
        message: 'Circle deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting circle:', error);
      const status = error.message === 'Circle not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  },

  /**
   * Get list of regions
   */
  async getRegions(req, res) {
    try {
      const regions = await circleService.getRegions();
      
      res.json({
        success: true,
        data: regions
      });
    } catch (error) {
      console.error('Error fetching regions:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch regions',
        error: error.message
      });
    }
  }
};

