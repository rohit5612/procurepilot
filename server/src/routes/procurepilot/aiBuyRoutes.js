import express from 'express';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import aiBuyController from '../../controllers/procurepilot/aiBuyController.js';

const router = express.Router();

router.use(authMiddleware);
router.use(hasPermission('procurepilot.ai_buy.read'));

router.get('/status', aiBuyController.status.bind(aiBuyController));
router.get('/activity', aiBuyController.activity.bind(aiBuyController));
router.post('/extract', aiBuyController.extract.bind(aiBuyController));
router.post('/compare', aiBuyController.compare.bind(aiBuyController));
router.post(
  '/submit-pr',
  hasPermission('procurepilot.ai_buy.submit'),
  aiBuyController.submitRequisition.bind(aiBuyController)
);

export default router;
