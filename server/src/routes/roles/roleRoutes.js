import express from 'express';
import roleController from '../../controllers/roles/roleController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import {
  createRoleValidation,
  updateRoleValidation,
  duplicateRoleValidation,
  roleIdValidation,
  departmentIdValidation,
  roleQueryValidation
} from '../../middleware/validation/roleValidation.js';

const router = express.Router();

// All role routes require authentication
router.use(authMiddleware);

// Get all roles with optional department filtering
// Requires: user_management.role_management.read
router.get('/',
  roleQueryValidation,
  hasPermission('user_management.role_management.read'),
  roleController.getAllRoles
);

// Get role statistics
// Requires: user_management.role_management.read
router.get('/statistics',
  hasPermission('user_management.role_management.read'),
  roleController.getRoleStatistics
);

// Get available permissions
// Requires: user_management.role_management.read
router.get('/permissions/available',
  hasPermission('user_management.role_management.read'),
  roleController.getAvailablePermissions
);

// Get available features for a department
// Requires: user_management.role_management.read
router.get('/features/:departmentId',
  departmentIdValidation,
  hasPermission('user_management.role_management.read'),
  roleController.getAvailableFeatures
);

// Get roles by department
// Requires: user_management.role_management.read
router.get('/department/:departmentId',
  departmentIdValidation,
  hasPermission('user_management.role_management.read'),
  roleController.getRolesByDepartment
);

// Get role by ID
// Requires: user_management.role_management.read
router.get('/:id',
  roleIdValidation,
  hasPermission('user_management.role_management.read'),
  roleController.getRoleById
);

// Create new role
// Requires: user_management.role_management.create OR superuser
router.post('/',
  createRoleValidation,
  (req, res, next) => {
    // Allow superuser or users with create permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.role_management.create')(req, res, next);
  },
  roleController.createRole
);

// Update role
// Requires: user_management.role_management.update OR superuser
router.put('/:id',
  updateRoleValidation,
  (req, res, next) => {
    // Allow superuser or users with update permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.role_management.update')(req, res, next);
  },
  roleController.updateRole
);

// Duplicate role
// Requires: user_management.role_management.create OR superuser
router.post('/:id/duplicate',
  duplicateRoleValidation,
  (req, res, next) => {
    // Allow superuser or users with create permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.role_management.create')(req, res, next);
  },
  roleController.duplicateRole
);

// Set default role for department
// Requires: user_management.role_management.update OR superuser
router.put('/:id/default',
  roleIdValidation,
  (req, res, next) => {
    // Allow superuser or users with update permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.role_management.update')(req, res, next);
  },
  roleController.setDefaultRole
);

// Delete role (soft delete)
// Requires: user_management.role_management.delete OR superuser
router.delete('/:id',
  roleIdValidation,
  (req, res, next) => {
    // Allow superuser or users with delete permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.role_management.delete')(req, res, next);
  },
  roleController.deleteRole
);

export default router;
