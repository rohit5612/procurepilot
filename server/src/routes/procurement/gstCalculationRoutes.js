import express from 'express';
import gstCalculationController from '../../controllers/procurement/gstCalculationController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';

const router = express.Router();

// Apply authentication middleware
router.use(authMiddleware);

// Calculate GST breakdown for PO lines
router.post('/calculate-gst', gstCalculationController.calculateGstForLines);

export default router;

