import express from 'express';
import AdjustmentController from '../../controllers/inventory/adjustmentController.js';
import { upload as adjustmentUpload, attach as adjustmentAttach, get as adjustmentGet } from '../../controllers/inventory/adjustmentAttachmentController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/adjustments', hasPermission('inventory.adjustment.create'), (req, res) => AdjustmentController.create(req, res));
router.post('/adjustments/:id/post', hasPermission('inventory.adjustment.update'), (req, res) => AdjustmentController.post(req, res));
router.get('/adjustments', hasPermission('inventory.adjustment.read'), (req, res) => AdjustmentController.list(req, res));
router.get('/adjustments/export', hasPermission('inventory.adjustment.read'), (req, res) => AdjustmentController.export(req, res));
router.get('/adjustments/:id', hasPermission('inventory.adjustment.read'), (req, res) => AdjustmentController.getById(req, res));
router.put('/adjustments/:id', hasPermission('inventory.adjustment.update'), (req, res) => AdjustmentController.update(req, res));
router.post('/adjustments/:id/withdraw', hasPermission('inventory.adjustment.delete'), (req, res) => AdjustmentController.withdraw(req, res));
router.delete('/adjustments/:id', hasPermission('inventory.adjustment.delete'), (req, res) => AdjustmentController.delete(req, res));

// Attachment (PDF) endpoints
router.post('/adjustments/:id/attachment', hasPermission('inventory.adjustment.update'), adjustmentUpload.single('file'), (req, res) => adjustmentAttach(req, res));
router.get('/adjustments/:id/attachment', hasPermission('inventory.adjustment.read'), (req, res) => adjustmentGet(req, res));

export default router;


