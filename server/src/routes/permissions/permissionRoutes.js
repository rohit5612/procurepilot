/**
 * Permission Routes - Phase 4 Implementation
 * Routes for permission management, caching, and system utilities
 */

import express from 'express';
import { PermissionController } from '../../controllers/permissions/permissionController.js';
import { authMiddleware, superuserMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

/**
 * @route   GET /api/permissions/stats
 * @desc    Get permission system statistics
 * @access  Superuser only
 */
router.get('/stats',
  authMiddleware,
  superuserMiddleware,
  PermissionController.getPermissionStats
);

/**
 * @route   POST /api/permissions/refresh/all
 * @desc    Refresh all permissions cache
 * @access  Superuser only
 */
router.post('/refresh/all',
  authMiddleware,
  superuserMiddleware,
  PermissionController.refreshAllPermissions
);

/**
 * @route   POST /api/permissions/refresh/user/:userId
 * @desc    Refresh specific user permissions
 * @access  Superuser or User Management permission
 */
router.post('/refresh/user/:userId',
  authMiddleware,
  hasPermission('user_management.user_directory.update'),
  PermissionController.refreshUserPermissions
);

/**
 * @route   POST /api/permissions/refresh/self
 * @desc    Refresh permissions for the authenticated user
 * @access  Authenticated user
 */
router.post('/refresh/self',
  authMiddleware,
  PermissionController.refreshSelfPermissions
);

/**
 * @route   GET /api/permissions/check/:userId
 * @desc    Check specific user permission
 * @access  Superuser or User Management read permission
 * @query   module, feature, action, resourceId (optional)
 */
router.get('/check/:userId',
  authMiddleware,
  hasPermission('user_management.user_directory.read'),
  PermissionController.checkUserPermission
);

/**
 * @route   GET /api/permissions/modules/:userId
 * @desc    Get user's available modules
 * @access  Superuser or User Management read permission
 */
router.get('/modules/:userId',
  authMiddleware,
  hasPermission('user_management.user_directory.read'),
  PermissionController.getUserModules
);

/**
 * @route   POST /api/permissions/bulk-check
 * @desc    Bulk permission check for multiple users and resources
 * @access  Superuser or User Management read permission
 */
router.post('/bulk-check',
  authMiddleware,
  hasPermission('user_management.user_directory.read'),
  PermissionController.bulkPermissionCheck
);

/**
 * @route   DELETE /api/permissions/cache
 * @desc    Clear cache entries
 * @access  Superuser only
 * @query   pattern, userId, or type
 */
router.delete('/cache',
  authMiddleware,
  superuserMiddleware,
  PermissionController.clearCache
);

export default router;
