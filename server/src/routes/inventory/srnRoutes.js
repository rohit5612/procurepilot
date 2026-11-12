import express from 'express';
import SrnController from '../../controllers/inventory/srnController.js';
import { upload as srnUpload, attach as srnAttach, get as srnGet } from '../../controllers/inventory/srnAttachmentController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/srn', hasPermission('inventory.issue.update'), (req, res) => SrnController.create(req, res));
router.post('/srn/:id/post', hasPermission('inventory.issue.update'), (req, res) => SrnController.post(req, res));
router.get('/srn', hasPermission('inventory.issue.read'), (req, res) => SrnController.list(req, res));
router.get('/srn/export', hasPermission('inventory.issue.read'), (req, res) => SrnController.export(req, res));
router.get('/srn/:id', hasPermission('inventory.issue.read'), (req, res) => SrnController.getById(req, res));
router.put('/srn/:id', hasPermission('inventory.issue.update'), (req, res) => SrnController.update(req, res));
router.post('/srn/:id/withdraw', hasPermission('inventory.issue.update'), (req, res) => SrnController.withdraw(req, res));
router.delete('/srn/:id', hasPermission('inventory.issue.update'), (req, res) => SrnController.delete(req, res));

// Attachment (PDF) endpoints
router.post('/srn/:id/attachment', hasPermission('inventory.issue.update'), srnUpload.single('file'), (req, res) => srnAttach(req, res));
router.get('/srn/:id/attachment', hasPermission('inventory.issue.read'), (req, res) => srnGet(req, res));

export default router;


