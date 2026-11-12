import express from 'express';
import controller from '../../controllers/inventory/stockController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/stock/on-hand', hasPermission('inventory.stock_control.read'), controller.getOnHand);
router.get('/stock/valuation', hasPermission('inventory.stock_valuation.read'), controller.getValuation);
router.get('/stock/movements', hasPermission('inventory.stock_movement.read'), (req, res) => controller.getTransactions(req, res));

export default router;


