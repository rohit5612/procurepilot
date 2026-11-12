import express from 'express';
import TransferController from '../../controllers/inventory/transferController.js';
import { upload as transferUpload, attach as transferAttach, get as transferGet } from '../../controllers/inventory/transferAttachmentController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/transfers', hasPermission('inventory.transfer.create'), (req, res) => TransferController.create(req, res));
router.post('/transfers/:id/post', hasPermission('inventory.transfer.update'), (req, res) => TransferController.post(req, res));
router.get('/transfers', hasPermission('inventory.transfer.read'), (req, res) => TransferController.list(req, res));
router.get('/transfers/export', hasPermission('inventory.transfer.read'), (req, res) => TransferController.export(req, res));
router.get('/transfers/:id', hasPermission('inventory.transfer.read'), (req, res) => TransferController.getById(req, res));
router.put('/transfers/:id', hasPermission('inventory.transfer.update'), (req, res) => TransferController.update(req, res));
router.post('/transfers/:id/withdraw', hasPermission('inventory.transfer.delete'), (req, res) => TransferController.withdraw(req, res));
router.delete('/transfers/:id', hasPermission('inventory.transfer.delete'), (req, res) => TransferController.delete(req, res));

// Attachment (PDF) endpoints
router.post('/transfers/:id/attachment', hasPermission('inventory.transfer.update'), transferUpload.single('file'), (req, res) => transferAttach(req, res));
router.get('/transfers/:id/attachment', hasPermission('inventory.transfer.read'), (req, res) => transferGet(req, res));

export default router;


