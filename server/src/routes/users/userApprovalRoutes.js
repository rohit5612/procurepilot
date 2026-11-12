import express from 'express';
import userApprovalController from '../../controllers/users/userApprovalController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { body } from 'express-validator';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Validation middleware
const approveUserValidation = [
  body('approvedBy').isInt().withMessage('Approved by user ID is required')
];

const rejectUserValidation = [
  body('rejectedBy').isInt().withMessage('Rejected by user ID is required'),
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required')
];

// Routes
router.get('/all', userApprovalController.getAllUsers);
router.get('/pending', userApprovalController.getPendingUsers);
router.get('/stats', userApprovalController.getApprovalStats);
router.post('/approve/:userId', approveUserValidation, userApprovalController.approveUser);
router.post('/reject/:userId', rejectUserValidation, userApprovalController.rejectUser);

export default router;
