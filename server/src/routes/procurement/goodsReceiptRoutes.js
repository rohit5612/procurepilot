import express from 'express';
import { body, param } from 'express-validator';
import controller from '../../controllers/procurement/goodsReceiptController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

const lineValidation = [
  body('lines').isArray().withMessage('Lines must be an array'),
  body('lines.*.item_name').notEmpty().withMessage('Item name is required'),
  body('lines.*.received_qty').isFloat({ min: 0 }).withMessage('Received qty must be >= 0'),
  body('lines.*.accepted_qty').isFloat({ min: 0 }).withMessage('Accepted qty must be >= 0'),
  body('lines.*.rejected_qty').optional().isFloat({ min: 0 }),
  body('lines.*.unit_price').optional().isFloat({ min: 0 })
];

router.post('/goods-receipts',
  body('purchase_order_id').isInt().withMessage('Purchase order id is required'),
  body('supplier_id').isInt().withMessage('Supplier id is required'),
  body('remarks').trim().notEmpty().withMessage('Remarks is required'),
  ...lineValidation,
  hasPermission('procurement.goods_receipt.create'),
  controller.create
);

router.put('/goods-receipts/:id',
  param('id').isInt(),
  ...lineValidation,
  hasPermission('procurement.goods_receipt.update'),
  controller.update
);

router.post('/goods-receipts/:id/submit',
  param('id').isInt(),
  hasPermission('procurement.goods_receipt.submit'),
  controller.submit
);

router.post('/goods-receipts/:id/post',
  param('id').isInt(),
  hasPermission('procurement.goods_receipt.approve'),
  controller.post
);
router.post('/goods-receipts/:id/withdraw',
  param('id').isInt(),
  hasPermission('procurement.goods_receipt.delete'),
  controller.withdraw
);

router.get('/goods-receipts/export',
  hasPermission('procurement.goods_receipt.read'),
  controller.export
);

router.get('/goods-receipts/:id/export-xlsx',
  param('id').isInt().withMessage('GRN id must be an integer'),
  hasPermission('procurement.goods_receipt.read'),
  controller.exportXlsx
);

router.get('/goods-receipts',
  hasPermission('procurement.goods_receipt.read'),
  controller.list
);

router.get('/goods-receipts/:id',
  param('id').isInt(),
  hasPermission('procurement.goods_receipt.read'),
  controller.getById
);

router.delete('/goods-receipts/:id',
  param('id').isInt(),
  hasPermission('procurement.goods_receipt.delete'),
  controller.delete
);

export default router;



