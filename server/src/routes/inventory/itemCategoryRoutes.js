/**
 * Item Category Routes
 * API routes for item category management
 */

import express from 'express';
import itemCategoryController from '../../controllers/inventory/itemCategoryController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Item Category Routes
router.get('/item-categories', hasPermission('inventory.item_master.read'), itemCategoryController.getAllCategories);

// Special category routes (must come before parameterized routes)
router.get('/item-categories/hierarchy', hasPermission('inventory.item_master.read'), itemCategoryController.getCategoryHierarchy);
router.get('/item-categories/type/:type', hasPermission('inventory.item_master.read'), itemCategoryController.getCategoriesByType);
router.get('/item-categories/default', hasPermission('inventory.item_master.read'), itemCategoryController.getDefaultCategory);

// Parameterized routes (must come after specific routes)
router.get('/item-categories/:id', hasPermission('inventory.item_master.read'), itemCategoryController.getCategoryById);
router.post('/item-categories', hasPermission('inventory.item_master.create'), itemCategoryController.createCategory);
router.put('/item-categories/:id', hasPermission('inventory.item_master.update'), itemCategoryController.updateCategory);
router.delete('/item-categories/:id', hasPermission('inventory.item_master.delete'), itemCategoryController.deleteCategory);

export default router;
