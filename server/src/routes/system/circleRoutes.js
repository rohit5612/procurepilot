import express from 'express';
import { circleController } from '../../controllers/system/circleController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/system/circles
 * @desc    Get all telecom circles
 * @access  Authenticated users
 */
router.get('/', circleController.getAll);

/**
 * @route   GET /api/system/circles/regions
 * @desc    Get list of regions
 * @access  Authenticated users
 */
router.get('/regions', circleController.getRegions);

/**
 * @route   GET /api/system/circles/:id
 * @desc    Get circle by ID
 * @access  Authenticated users
 */
router.get('/:id', circleController.getById);

/**
 * @route   POST /api/system/circles
 * @desc    Create new circle
 * @access  System Admin only
 */
router.post('/', hasPermission('system.settings.create'), circleController.create);

/**
 * @route   PUT /api/system/circles/:id
 * @desc    Update circle
 * @access  System Admin only
 */
router.put('/:id', hasPermission('system.settings.update'), circleController.update);

/**
 * @route   DELETE /api/system/circles/:id
 * @desc    Delete circle
 * @access  System Admin only
 */
router.delete('/:id', hasPermission('system.settings.delete'), circleController.delete);

export default router;

