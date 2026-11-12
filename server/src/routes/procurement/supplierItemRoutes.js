import express from 'express';
import supplierItemController from '../../controllers/procurement/supplierItemController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Supplier Items Routes
router.get('/supplier-items', hasPermission('procurement.supplier_management.read'), supplierItemController.getAllSupplierItems);
router.post('/supplier-items', hasPermission('procurement.supplier_management.create'), supplierItemController.addSupplierItem);
router.post('/suppliers/:supplierId/items', hasPermission('procurement.supplier_management.create'), supplierItemController.addSupplierItem);
router.get('/suppliers/:supplierId/items', hasPermission('procurement.supplier_management.read'), supplierItemController.getSupplierItems);
router.get('/items/:itemId/suppliers', hasPermission('procurement.supplier_management.read'), supplierItemController.getItemSuppliers);
router.get('/supplier-items/:supplierItemId', hasPermission('procurement.supplier_management.read'), supplierItemController.getSupplierItemById);
router.put('/supplier-items/:supplierItemId', hasPermission('procurement.supplier_management.update'), supplierItemController.updateSupplierItem);
router.delete('/supplier-items/:supplierItemId', hasPermission('procurement.supplier_management.delete'), supplierItemController.removeSupplierItem);

export default router;
