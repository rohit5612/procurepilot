import express from 'express';
import siteController from '../../controllers/inventory/siteController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all sites
router.get('/sites', hasPermission('inventory.site_master.read'), siteController.getSites);

// Get site by ID
router.get('/sites/:id', hasPermission('inventory.site_master.read'), siteController.getSiteById);

// Create new site
router.post('/sites', hasPermission('inventory.site_master.create'), siteController.createSite);

// Update site
router.put('/sites/:id', hasPermission('inventory.site_master.update'), siteController.updateSite);

// Toggle site status
router.patch('/sites/:id/toggle-status', hasPermission('inventory.site_master.update'), siteController.toggleSiteStatus);

// Delete site
router.delete('/sites/:id', hasPermission('inventory.site_master.delete'), siteController.deleteSite);

export default router;
