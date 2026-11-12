/**
 * Unit of Measure Routes
 * API routes for unit of measure management
 */

import express from 'express';
import unitOfMeasureController from '../../controllers/inventory/unitOfMeasureController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Unit of Measure Routes
router.get('/units-of-measure', hasPermission('inventory.item_master.read'), unitOfMeasureController.getAllUnitsOfMeasure);
router.get('/units-of-measure/:id', hasPermission('inventory.item_master.read'), unitOfMeasureController.getUnitOfMeasureById);
router.post('/units-of-measure', hasPermission('inventory.item_master.create'), unitOfMeasureController.createUnitOfMeasure);
router.put('/units-of-measure/:id', hasPermission('inventory.item_master.update'), unitOfMeasureController.updateUnitOfMeasure);
router.delete('/units-of-measure/:id', hasPermission('inventory.item_master.delete'), unitOfMeasureController.deleteUnitOfMeasure);

// Special UoM routes
router.get('/units-of-measure/type/:type', hasPermission('inventory.item_master.read'), unitOfMeasureController.getUnitsOfMeasureByType);
router.get('/units-of-measure/base', hasPermission('inventory.item_master.read'), unitOfMeasureController.getBaseUnitsOfMeasure);
router.post('/units-of-measure/convert', hasPermission('inventory.item_master.read'), unitOfMeasureController.convertUnit);
router.get('/units-of-measure/convert/:from_uom_id/:to_uom_id', hasPermission('inventory.item_master.read'), unitOfMeasureController.getConversionPath);

export default router;
