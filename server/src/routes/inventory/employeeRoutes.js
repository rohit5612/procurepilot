import express from 'express';
import employeeController from '../../controllers/inventory/employeeController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// All employee master routes require authentication
router.use(authMiddleware);

// List employees (with optional filters)
router.get(
  '/employees',
  hasPermission('inventory.employee_master.read'),
  employeeController.list
);

// Get single employee
router.get(
  '/employees/:id',
  hasPermission('inventory.employee_master.read'),
  employeeController.getById
);

export default router;

