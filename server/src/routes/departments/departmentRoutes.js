import express from 'express';
import departmentController from '../../controllers/departments/departmentController.js';
import { authMiddleware, superuserMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import {
  createDepartmentValidation,
  updateDepartmentValidation,
  assignModulesValidation,
  departmentIdValidation
} from '../../middleware/validation/departmentValidation.js';

const router = express.Router();

// All department routes require authentication
router.use(authMiddleware);

// Get all departments
// Requires: user_management.department_management.read
router.get('/',
  hasPermission('user_management.department_management.read'),
  departmentController.getAllDepartments
);

// Get department statistics
// Requires: user_management.department_management.read
router.get('/statistics',
  hasPermission('user_management.department_management.read'),
  departmentController.getDepartmentStatistics
);

// Get available modules for assignment
// Requires: user_management.department_management.read
router.get('/modules',
  hasPermission('user_management.department_management.read'),
  departmentController.getAvailableModules
);

// Get department by ID
// Requires: user_management.department_management.read
router.get('/:id',
  departmentIdValidation,
  hasPermission('user_management.department_management.read'),
  departmentController.getDepartmentById
);

// Create new department
// Requires: user_management.department_management.create OR superuser
router.post('/',
  createDepartmentValidation,
  (req, res, next) => {
    // Allow superuser or users with create permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.department_management.create')(req, res, next);
  },
  departmentController.createDepartment
);

// Update department
// Requires: user_management.department_management.update OR superuser
router.put('/:id',
  updateDepartmentValidation,
  (req, res, next) => {
    // Allow superuser or users with update permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.department_management.update')(req, res, next);
  },
  departmentController.updateDepartment
);

// Assign modules to department
// Requires: user_management.department_management.update OR superuser
router.post('/:id/modules',
  assignModulesValidation,
  (req, res, next) => {
    // Allow superuser or users with update permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.department_management.update')(req, res, next);
  },
  departmentController.assignModules
);

// Deactivate department (soft delete)
// Requires: user_management.department_management.delete OR superuser
router.delete('/:id',
  departmentIdValidation,
  (req, res, next) => {
    // Allow superuser or users with delete permission
    if (req.user.isSuperuser) {
      return next();
    }
    return hasPermission('user_management.department_management.delete')(req, res, next);
  },
  departmentController.deactivateDepartment
);

export default router;
