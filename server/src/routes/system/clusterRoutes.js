import express from 'express';
import { clusterController } from '../../controllers/system/clusterController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/system/clusters
 * @desc    Get all clusters
 * @access  Authenticated users
 */
router.get('/', clusterController.getAll);

/**
 * @route   GET /api/system/clusters/circle/:circleId
 * @desc    Get clusters for a specific circle
 * @access  Authenticated users
 */
router.get('/circle/:circleId', clusterController.getByCircle);

/**
 * @route   GET /api/system/clusters/:id
 * @desc    Get cluster by ID
 * @access  Authenticated users
 */
router.get('/:id', clusterController.getById);

/**
 * @route   POST /api/system/clusters
 * @desc    Create new cluster
 * @access  System Admin only
 */
router.post('/', hasPermission('system.settings.create'), clusterController.create);

/**
 * @route   PUT /api/system/clusters/:id
 * @desc    Update cluster
 * @access  System Admin only
 */
router.put('/:id', hasPermission('system.settings.update'), clusterController.update);

/**
 * @route   DELETE /api/system/clusters/:id
 * @desc    Delete cluster
 * @access  System Admin only
 */
router.delete('/:id', hasPermission('system.settings.delete'), clusterController.delete);

export default router;

