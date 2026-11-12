import express from 'express';
import { authMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';
import { getAuditLogs, getActivityLogs, getErrorLogs } from '../../controllers/system/logsController.js';

const router = express.Router();

router.use(authMiddleware);

// System logs endpoints
router.get('/audit', roleLevel(1), getAuditLogs);
router.get('/activity', roleLevel(1), getActivityLogs);
router.get('/errors', roleLevel(1), getErrorLogs);

export default router;


