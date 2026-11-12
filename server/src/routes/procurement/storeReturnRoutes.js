import express from 'express';
import { param, body } from 'express-validator';
import controller from '../../controllers/procurement/storeReturnController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/store-returns', hasPermission('procurement.store_return_note.read'), controller.list);
router.get('/store-returns/:id', param('id').isInt(), hasPermission('procurement.store_return_note.read'), controller.getById);
router.post(
  '/store-returns/from-grn/:grnId',
  param('grnId').isInt(),
  body('lines').isArray({ min: 1 }),
  hasPermission('procurement.store_return_note.create'),
  controller.createFromGrn
);
router.post(
  '/store-returns/:id/post',
  param('id').isInt(),
  hasPermission('procurement.store_return_note.approve'),
  controller.post
);

export default router;
