import siteService from '../../services/inventory/siteService.js';

const siteController = {
  // Get all sites
  async getSites(req, res) {
    try {
      const sites = await siteService.getSites();
      res.json({
        success: true,
        message: 'Sites retrieved successfully',
        data: sites
      });
    } catch (error) {
      console.error('Error getting sites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sites',
        error: error.message
      });
    }
  },

  // Get site by ID
  async getSiteById(req, res) {
    try {
      const { id } = req.params;
      const site = await siteService.getSiteById(id);
      
      if (!site) {
        return res.status(404).json({
          success: false,
          message: 'Site not found'
        });
      }

      res.json({
        success: true,
        message: 'Site retrieved successfully',
        data: site
      });
    } catch (error) {
      console.error('Error getting site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve site',
        error: error.message
      });
    }
  },

  // Create new site
  async createSite(req, res) {
    try {
      const siteData = req.body;
      const newSite = await siteService.createSite(siteData, req.user.id);
      
      res.status(201).json({
        success: true,
        message: 'Site created successfully',
        data: newSite
      });
    } catch (error) {
      console.error('Error creating site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create site',
        error: error.message
      });
    }
  },

  // Update site
  async updateSite(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const updatedSite = await siteService.updateSite(id, updateData, req.user.id);
      
      if (!updatedSite) {
        return res.status(404).json({
          success: false,
          message: 'Site not found'
        });
      }

      res.json({
        success: true,
        message: 'Site updated successfully',
        data: updatedSite
      });
    } catch (error) {
      console.error('Error updating site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update site',
        error: error.message
      });
    }
  },

  // Toggle site status
  async toggleSiteStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      
      if (!status || !['ACTIVE', 'INACTIVE'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be ACTIVE or INACTIVE'
        });
      }

      const updatedSite = await siteService.updateSite(id, { status }, req.user.id);
      
      if (!updatedSite) {
        return res.status(404).json({
          success: false,
          message: 'Site not found'
        });
      }

      res.json({
        success: true,
        message: `Site ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data: updatedSite
      });
    } catch (error) {
      console.error('Error toggling site status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle site status',
        error: error.message
      });
    }
  },

  // Delete site
  async deleteSite(req, res) {
    try {
      const { id } = req.params;
      const { hardDelete = true } = req.query; // Get hardDelete from query params, default to true
      
      const deleted = await siteService.deleteSite(id, req.user.id, hardDelete === 'true');
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Site not found'
        });
      }

      const deleteType = hardDelete === 'true' ? 'permanently deleted' : 'deactivated';
      
      res.json({
        success: true,
        message: `Site ${deleteType} successfully`
      });
    } catch (error) {
      console.error('Error deleting site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete site',
        error: error.message
      });
    }
  }
};

export default siteController;
