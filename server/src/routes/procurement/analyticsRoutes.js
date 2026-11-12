import express from 'express';
import analyticsController from '../../controllers/procurement/analyticsController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Primary endpoints
router.get('/analytics/procurement/spend', hasPermission('procurement.purchase_order.read'), analyticsController.monthlySpend);
router.get('/analytics/procurement/by-department', hasPermission('procurement.purchase_order.read'), analyticsController.byDepartment);
router.get('/analytics/procurement/top-suppliers', hasPermission('procurement.purchase_order.read'), analyticsController.topSuppliers);

// Aliases to avoid client path mismatches
router.get('/analytics/spend', hasPermission('procurement.purchase_order.read'), analyticsController.monthlySpend);
router.get('/analytics/by-department', hasPermission('procurement.purchase_order.read'), analyticsController.byDepartment);
router.get('/analytics/top-suppliers', hasPermission('procurement.purchase_order.read'), analyticsController.topSuppliers);

export default router;


