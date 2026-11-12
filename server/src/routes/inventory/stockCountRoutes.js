import express from 'express';
import controller from '../../controllers/inventory/stockCountController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/stock-counts', hasPermission('inventory.stock_count.create'), (req, res) => controller.create(req, res));
router.post('/stock-counts/:id/post', hasPermission('inventory.stock_count.update'), (req, res) => controller.post(req, res));
router.get('/stock-counts', hasPermission('inventory.stock_count.read'), (req, res) => controller.list(req, res));
router.get('/stock-counts/:id', hasPermission('inventory.stock_count.read'), (req, res) => controller.getById(req, res));
router.patch('/stock-counts/:id/lines/:lineId', hasPermission('inventory.stock_count.update'), (req, res) => controller.updateLine(req, res));
router.patch('/stock-counts/:id', hasPermission('inventory.stock_count.update'), (req, res) => controller.updateHeader(req, res));

export default router;



