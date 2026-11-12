import express from 'express';
import errorLogController from '../../controllers/system/errorLogController.js';
import { authMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get error logs (requires read permission)
router.get('/', roleLevel(1), errorLogController.getErrorLogs);

// Get error statistics
router.get('/stats', roleLevel(1), errorLogController.getErrorStats);

// Resolve an error (requires update permission)
router.patch('/:id/resolve', roleLevel(2), errorLogController.resolveError);

export default router;

