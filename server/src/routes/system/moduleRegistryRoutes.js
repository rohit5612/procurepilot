import express from 'express';
import { authMiddleware as authenticate, superuserMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import * as moduleRegistryController from '../../controllers/system/moduleRegistryController.js';

const router = express.Router();

// Get departments for assignment (restricted to role management perms)
router.get('/departments', authenticate, hasPermission('user_management.role_management.read'), moduleRegistryController.listDepartments);

// Audit views (superadmin or level 1)
router.get('/logs', authenticate, roleLevel(1), moduleRegistryController.listModuleLogs);
router.get('/propagation-runs', authenticate, roleLevel(1), moduleRegistryController.listPropagationRuns);

// Get all modules with features
router.get('/', authenticate, hasPermission('user_management.role_management.read'), moduleRegistryController.listModules);

// Validate a new module definition (dry-run)
router.post('/validate', authenticate, hasPermission('user_management.role_management.create'), moduleRegistryController.validateModule);

// Register a new module (and optionally deploy)
router.post('/register', authenticate, hasPermission('user_management.role_management.create'), moduleRegistryController.registerModule);

// Update module metadata
router.put('/:moduleId', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.updateModule);

// Feature management
router.post('/:moduleId/features', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.addFeature);
router.put('/:moduleId/features/:featureId', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.updateFeature);
router.delete('/:moduleId/features/:featureId', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.deleteFeature);

// Activate/Deactivate module
router.put('/:moduleId/activate', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.activateModule);
router.put('/:moduleId/deactivate', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.deactivateModule);

// Assign module to departments
router.post('/:moduleId/departments', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.assignModuleToDepartments);

// Propagation
router.post('/:moduleId/propagate', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.propagateModuleToTemplates);
router.post('/:moduleId/rollback', authenticate, hasPermission('user_management.role_management.update'), moduleRegistryController.rollbackPropagation);

// Delete module (superuser only + password verification)
router.delete('/:moduleId', authenticate, superuserMiddleware, moduleRegistryController.deleteModule);

export default router;
