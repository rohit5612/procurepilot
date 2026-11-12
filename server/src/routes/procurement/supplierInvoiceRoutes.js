import express from 'express';
import { param, body } from 'express-validator';
import controller from '../../controllers/procurement/supplierInvoiceController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/supplier-invoices', hasPermission('procurement.supplier_invoice.read'), controller.list);
router.get('/supplier-invoices/:id', param('id').isInt(), hasPermission('procurement.supplier_invoice.read'), controller.getById);
router.post(
  '/supplier-invoices',
  body('invoice_number').notEmpty(),
  body('supplier_id').isInt(),
  hasPermission('procurement.supplier_invoice.create'),
  controller.capture
);
router.post(
  '/supplier-invoices/:id/rematch',
  param('id').isInt(),
  hasPermission('procurement.supplier_invoice.update'),
  controller.rematch
);
router.post(
  '/supplier-invoices/:id/handoff-finance',
  param('id').isInt(),
  hasPermission('procurement.supplier_invoice.approve'),
  controller.handoff
);

export default router;
