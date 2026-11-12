import express from 'express';
import userAppealController from '../../controllers/users/userAppealController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Public routes (no authentication required)
router.post('/submit/:userId', userAppealController.submitAppeal);
router.get('/check/:userId', userAppealController.checkPendingAppeal);

// Admin routes (authentication and permissions required)
router.use(authMiddleware);

router.get('/', hasPermission('user_management.appeals.read'), userAppealController.getAllAppeals);
router.get('/stats', hasPermission('user_management.appeals.read'), userAppealController.getAppealStats);
router.get('/:appealId', hasPermission('user_management.appeals.read'), userAppealController.getAppealById);
router.patch('/:appealId/review', hasPermission('user_management.appeals.approve'), userAppealController.reviewAppeal);

export default router;
