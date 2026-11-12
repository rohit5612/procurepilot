import express from 'express';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import paypalController from '../../controllers/procurepilot/paypalController.js';

const router = express.Router();

router.get('/config', authMiddleware, paypalController.config.bind(paypalController));
router.use(authMiddleware);
router.use(hasPermission('procurepilot.ai_buy.read'));

router.post('/orders', paypalController.createOrder.bind(paypalController));
router.post('/capture', paypalController.captureOrder.bind(paypalController));

export default router;
