import express from 'express';
import activityLogController from '../../controllers/system/activityLogController.js';
import { authMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get activity logs (requires read permission)
router.get('/', roleLevel(1), activityLogController.getActivityLogs);

// Get activity statistics
router.get('/stats', roleLevel(1), activityLogController.getActivityStats);

// Get top active users
router.get('/top-users', roleLevel(1), activityLogController.getTopActiveUsers);

// Cleanup old activity logs (admin only; typically used via a scheduled job)
router.delete('/cleanup', roleLevel(0), activityLogController.cleanupOldLogs);

export default router;

