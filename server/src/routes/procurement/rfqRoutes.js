import express from 'express';
import { body, param } from 'express-validator';
import controller from '../../controllers/procurement/rfqController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/rfqs', hasPermission('procurement.request_quotation.read'), controller.list);
router.get('/rfqs/:id', param('id').isInt(), hasPermission('procurement.request_quotation.read'), controller.getById);
router.post(
  '/rfqs/from-requisition/:requisitionId',
  param('requisitionId').isInt(),
  hasPermission('procurement.request_quotation.create'),
  controller.createFromRequisition
);
router.post(
  '/rfqs/:id/invite',
  param('id').isInt(),
  body('supplier_ids').isArray({ min: 1 }),
  hasPermission('procurement.request_quotation.update'),
  controller.invite
);
router.post(
  '/rfqs/:id/quotations',
  param('id').isInt(),
  body('supplier_id').isInt(),
  hasPermission('procurement.request_quotation.update'),
  controller.submitQuotation
);
router.get('/rfqs/:id/compare', param('id').isInt(), hasPermission('procurement.request_quotation.read'), controller.compare);
router.post(
  '/rfqs/:id/award',
  param('id').isInt(),
  body('quotation_id').isInt(),
  hasPermission('procurement.request_quotation.approve'),
  controller.award
);

export default router;
