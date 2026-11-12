import express from 'express';
import itemController, { itemUpload, importItemsCsv } from '../../controllers/inventory/itemController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Items Routes
router.post('/items', hasPermission('inventory.item_master.create'), itemController.createItem);
router.get('/items', hasPermission('inventory.item_master.read'), itemController.getItems);
router.get('/items/export-csv', hasPermission('inventory.item_master.read'), itemController.exportItemsCsv);
router.post('/items/import-csv', hasPermission('inventory.item_master.update'), itemUpload.single('file'), importItemsCsv);
router.get('/items/:itemId', hasPermission('inventory.item_master.read'), itemController.getItemById);
router.get('/items/code/:itemCode', hasPermission('inventory.item_master.read'), itemController.getItemByCode);
router.put('/items/:itemId', hasPermission('inventory.item_master.update'), itemController.updateItem);
router.patch('/items/:itemId/toggle-status', hasPermission('inventory.item_master.update'), itemController.toggleItemStatus);
router.delete('/items/:itemId', hasPermission('inventory.item_master.delete'), itemController.deleteItem);

// Brand/Model specific routes
router.get('/items/search/brand-model', hasPermission('inventory.item_master.read'), itemController.searchItemsByBrandModel);
router.get('/items/brands', hasPermission('inventory.item_master.read'), itemController.getAllBrands);
router.get('/items/brands/:brand/models', hasPermission('inventory.item_master.read'), itemController.getModelsByBrand);
router.post('/items/bulk-update-brand-model', hasPermission('inventory.item_master.update'), itemController.bulkUpdateBrandModel);

// Item Categories Routes - Moved to dedicated itemCategoryRoutes.js
// router.get('/item-categories', hasPermission('inventory.item_master.read'), itemController.getItemCategories);
// router.post('/item-categories', hasPermission('inventory.item_master.create'), itemController.createItemCategory);

export default router;
