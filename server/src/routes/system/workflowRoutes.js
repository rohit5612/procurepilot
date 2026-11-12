import express from 'express';
import { authMiddleware as authenticate, roleLevel } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import * as controller from '../../controllers/system/workflowController.js';

const router = express.Router();

// Designer access: superadmin or level 1 admins
router.get('/definitions', authenticate, roleLevel(1), controller.listDefinitions);
router.post('/definitions', authenticate, roleLevel(1), controller.createDefinition);
router.put('/definitions/:definitionId', authenticate, roleLevel(1), controller.updateDefinition);
router.post('/definitions/:definitionId/publish', authenticate, roleLevel(1), controller.publishDefinition);
router.post('/definitions/:definitionId/clone', authenticate, roleLevel(1), controller.cloneDefinition);
router.delete('/definitions/:definitionId', authenticate, roleLevel(1), controller.deleteDefinition);
router.post('/definitions/:definitionId/deprecate', authenticate, roleLevel(1), controller.deprecateDefinition);

// Instances (restricted by perms; reuse role management read for now)
router.post('/instances', authenticate, hasPermission('user_management.role_management.read'), controller.createInstance);
router.get('/instances/:instanceId', authenticate, hasPermission('user_management.role_management.read'), controller.getInstance);
router.post('/instances/:instanceId/action', authenticate, hasPermission('user_management.role_management.read'), controller.actOnInstance);
router.get('/instances', authenticate, roleLevel(1), controller.listInstances);

// Tasks - accessible to users with procurement permissions (since most tasks are procurement-related)
router.get('/tasks', authenticate, controller.listTasks);
router.get('/tasks/:taskId', authenticate, controller.getTask);
router.put('/tasks/:taskId', authenticate, controller.updateTask);
router.post('/tasks/:taskId/complete', authenticate, controller.completeTask);

// Bindings to features
router.get('/bindings', authenticate, roleLevel(1), controller.listBindings);

// Maintenance utilities
router.post('/maintenance/reconcile', authenticate, controller.maintenanceReconcile);
router.post('/maintenance/rebuild', authenticate, controller.maintenanceRebuild);
router.post('/bindings', authenticate, roleLevel(1), controller.createBinding);
router.delete('/bindings/:bindingId', authenticate, roleLevel(1), controller.deleteBinding);
router.get('/roles', authenticate, roleLevel(1), controller.listRoles);

// Simulation
router.post('/simulate', authenticate, roleLevel(1), controller.simulateEvent);

// Submit via binding (clean submit endpoint)
router.post('/submit', authenticate, controller.submitViaBinding);

// Read-only endpoints for step/assignee resolution (used by details pages and dashboards)
router.get('/for-entity', authenticate, controller.getForEntity);
router.get('/pending-assignees', authenticate, controller.getPendingAssignees);

export default router;


