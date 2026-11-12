import express from 'express';
import { body, param } from 'express-validator';
import controller from '../../controllers/procurement/purchaseOrderController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const lineValidation = [
  body('lines').isArray().withMessage('Lines must be an array'),
  body('lines.*.item_name').notEmpty().withMessage('Item name is required'),
  body('lines.*.quantity').isFloat({ min: 0.001 }).withMessage('Quantity must be greater than 0'),
  body('lines.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be non-negative')
];

const createDirectValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('supplier_id').isInt().withMessage('Supplier ID is required and must be an integer'),
  body('currency').optional().isString(),
  body('site_id').optional().isInt(),
  body('warehouse_id').optional().isInt(),
  ...lineValidation
];

const createFromReqValidation = [
  param('requisitionId').isInt().withMessage('Requisition ID must be an integer'),
  body('title').notEmpty().withMessage('Title is required'),
  body('supplier_id').isInt().withMessage('Supplier ID is required and must be an integer'),
  ...lineValidation
];

const updateValidation = [
  param('id').isInt().withMessage('PO id must be an integer'),
  body('title').optional().isString(),
  body('description').optional().isString(),
  body('supplier_id').optional().isInt(),
  body('site_id').optional().isInt(),
  body('warehouse_id').optional().isInt(),
  body('currency').optional().isString(),
  body('promised_date').optional().isString(),
  ...lineValidation
];

router.post('/purchase-orders',
  createDirectValidation,
  hasPermission('procurement.purchase_order.create'),
  controller.createDirect
);

router.post('/purchase-orders/from-requisition/:requisitionId',
  createFromReqValidation,
  hasPermission('procurement.purchase_order.create'),
  controller.createFromRequisition
);

router.get('/purchase-orders/export',
  hasPermission('procurement.purchase_order.read'),
  controller.export
);

router.get('/purchase-orders',
  hasPermission('procurement.purchase_order.read'),
  controller.list
);

router.get('/purchase-orders/:id',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.read'),
  controller.getById
);

router.get('/purchase-orders/:id/export-xlsx',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.read'),
  controller.exportXlsx
);

router.get('/purchase-orders/:id/export-pdf',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.read'),
  controller.exportPdf
);

router.post('/purchase-orders/:id/submit',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.submit'),
  controller.submit
);

router.post('/purchase-orders/:id/approve',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.approve'),
  controller.approve
);

router.post('/purchase-orders/:id/reject',
  param('id').isInt(),
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  hasPermission('procurement.purchase_order.approve'),
  controller.reject
);

router.post('/purchase-orders/:id/issue',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.approve'),
  controller.issue
);
router.post('/purchase-orders/:id/withdraw',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.delete'),
  controller.withdraw
);

router.post('/purchase-orders/:id/cancel-issued',
  param('id').isInt(),
  body('reason').optional().isString(),
  hasPermission('procurement.purchase_order.approve'),
  controller.cancelIssued
);

router.post('/purchase-orders/:id/amend',
  param('id').isInt(),
  body('lines').isArray(),
  hasPermission('procurement.purchase_order.update'),
  controller.amendIssued
);

router.put('/purchase-orders/:id',
  updateValidation,
  hasPermission('procurement.purchase_order.update'),
  controller.update
);

router.delete('/purchase-orders/:id',
  param('id').isInt(),
  hasPermission('procurement.purchase_order.delete'),
  controller.delete
);

export default router;


