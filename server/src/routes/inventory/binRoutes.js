/**
 * Bin Routes
 * API routes for warehouse bin management
 */

import express from 'express';
import binController from '../../controllers/inventory/binController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Bin Routes
router.get('/bins', hasPermission('inventory.bin_management.read'), binController.getAllBins);
router.get('/bins/:id', hasPermission('inventory.bin_management.read'), binController.getBinById);
router.post('/bins', hasPermission('inventory.bin_management.create'), binController.createBin);
router.put('/bins/:id', hasPermission('inventory.bin_management.update'), binController.updateBin);
router.delete('/bins/:id', hasPermission('inventory.bin_management.delete'), binController.deleteBin);

// Warehouse-specific bin routes
router.get('/warehouses/:warehouseId/bins', hasPermission('inventory.bin_management.read'), binController.getBinsByWarehouse);
router.get('/warehouses/:warehouseId/bins/hierarchy', hasPermission('inventory.bin_management.read'), binController.getBinHierarchy);

export default router;
