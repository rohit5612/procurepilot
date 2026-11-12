import express from 'express';
import auditLogController from '../../controllers/system/auditLogController.js';
import { authMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get audit logs (requires read permission)
router.get('/', roleLevel(1), auditLogController.getAuditLogs);

// Get audit statistics
router.get('/stats', roleLevel(1), auditLogController.getAuditStats);

// Get audit log by ID
router.get('/:id', roleLevel(1), auditLogController.getAuditLogById);

export default router;

