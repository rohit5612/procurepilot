import express from 'express';
import userController from '../../controllers/users/userController.js';
import userAssignmentController from '../../controllers/users/userAssignmentController.js';
import userValidation from '../../middleware/validation/userValidation.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission, hasModuleAccess } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Public routes (no authentication required) - must be before authMiddleware
router.get('/:userId/status/public', userController.getUserStatusPublic);

// Apply authentication to all routes
router.use(authMiddleware);

// Check assignment status (available to all authenticated users)
router.get('/assignment-status', userController.checkAssignmentStatus);

// Basic user info endpoint (available to all authenticated users for approval tasks)
router.get('/basic/:userId', userController.getBasicUserInfo);

// User Directory Routes
router.get('/directory', hasPermission('user_management.user_directory.read'), userController.getUserDirectory);

// User Status Management
router.patch('/:userId/status', hasPermission('user_management.user_directory.update'), userController.updateUserStatus);

// Archived users routes (must come before parameterized routes)
router.get(
  '/archived',
  hasPermission('user_management.archived_users.read'),
  userController.getArchivedUsers
);
router.get(
  '/archived/stats',
  hasPermission('user_management.archived_users.read'),
  userController.getArchivedUsersStats
);

// User Directory Routes
router.get(
  '/',
  hasPermission('user_management.user_directory.read'),
  userValidation.validateUserSearch(),
  userController.getAllUsers
);

router.get(
  '/statistics',
  hasPermission('user_management.user_directory.read'),
  userController.getUserStatistics
);

router.get(
  '/:userId',
  hasPermission('user_management.user_directory.read'),
  userValidation.validateGetUserById(),
  userController.getUserById
);

router.get(
  '/:userId/history',
  hasPermission('user_management.user_directory.read'),
  userValidation.validateGetUserById(),
  userController.getUserAssignmentHistory
);

router.put(
  '/:userId/profile',
  hasPermission('user_management.user_directory.update'),
  userValidation.validateUserProfileUpdate(),
  userController.updateUserProfile
);

router.put(
  '/:userId/deactivate',
  hasPermission('user_management.user_directory.delete'),
  userValidation.validateUserDeactivation(),
  userController.deactivateUser
);

// Permanent Delete Route (Superuser only)
router.delete(
  '/:userId',
  hasPermission('user_management.user_directory.delete'),
  userController.deleteUser
);

// User Approval Routes (Superuser only)
router.get(
  '/pending/approval',
  hasPermission('user_management.user_approval.read'),
  userController.getPendingUsers
);

router.put(
  '/:userId/approve',
  hasPermission('user_management.user_approval.approve'),
  userValidation.validateUserApproval(),
  userController.approveUser
);

router.put(
  '/:userId/reject',
  hasPermission('user_management.user_approval.approve'),
  userValidation.validateUserRejection(),
  userController.rejectUser
);

router.post(
  '/bulk/approve',
  hasPermission('user_management.user_approval.bulk_action'),
  userValidation.validateBulkUserApproval(),
  userController.bulkApproveUsers
);

// User Assignment Routes (User Assignment Management)
router.get(
  '/assignment/available',
  hasPermission('user_management.user_assignment.read'),
  userAssignmentController.getAvailableUsers
);

router.get(
  '/assignment/statistics',
  hasPermission('user_management.user_assignment.read'),
  userAssignmentController.getAssignmentStatistics
);

router.get(
  '/assignment/templates/:departmentId',
  hasPermission('user_management.user_assignment.read'),
  userValidation.validateDepartmentId(),
  userAssignmentController.getAssignmentTemplates
);

router.get(
  '/assignment/:assignmentId',
  hasPermission('user_management.user_assignment.read'),
  userValidation.validateAssignmentId(),
  userAssignmentController.getAssignmentDetails
);

router.post(
  '/assignment/assign',
  hasPermission('user_management.user_assignment.create'),
  userValidation.validateUserAssignment(),
  userAssignmentController.assignUserRole
);

router.put(
  '/assignment/:userId/transfer',
  hasPermission('user_management.user_assignment.update'),
  userValidation.validateUserTransfer(),
  userAssignmentController.transferUser
);

router.put(
  '/assignment/:userId/unassign',
  hasPermission('user_management.user_assignment.delete'),
  userValidation.validateUserUnassignment(),
  userAssignmentController.unassignUser
);

router.post(
  '/assignment/bulk',
  hasPermission('user_management.user_assignment.bulk_action'),
  userValidation.validateBulkUserAssignment(),
  userAssignmentController.bulkAssignUsers
);

export default router;
