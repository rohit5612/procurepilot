import express from 'express';
import supplierController from '../../controllers/procurement/supplierController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Suppliers Routes
router.post('/suppliers', hasPermission('procurement.supplier_management.create'), supplierController.createSupplier);
router.get('/suppliers', hasPermission('procurement.supplier_management.read'), supplierController.getSuppliers);
router.get('/suppliers/:supplierId', hasPermission('procurement.supplier_management.read'), supplierController.getSupplierById);
router.get('/suppliers/code/:supplierCode', hasPermission('procurement.supplier_management.read'), supplierController.getSupplierByCode);
router.put('/suppliers/:supplierId', hasPermission('procurement.supplier_management.update'), supplierController.updateSupplier);
router.patch('/suppliers/:supplierId/toggle-status', hasPermission('procurement.supplier_management.update'), supplierController.toggleSupplierStatus);
router.delete('/suppliers/:supplierId', hasPermission('procurement.supplier_management.delete'), supplierController.deleteSupplier);

// Supplier Contacts Routes
router.get('/suppliers/:supplierId/contacts', hasPermission('procurement.supplier_management.read'), supplierController.getSupplierContacts);
router.post('/suppliers/:supplierId/contacts', hasPermission('procurement.supplier_management.create'), supplierController.addSupplierContact);

// Applied Price List
router.get('/suppliers/:supplierId/applied-price-list', hasPermission('procurement.supplier_management.read'), supplierController.getAppliedPriceList);
router.put('/suppliers/:supplierId/applied-price-list', hasPermission('procurement.supplier_management.update'), supplierController.setAppliedPriceList);
router.put('/supplier-contacts/:contactId', hasPermission('procurement.supplier_management.update'), supplierController.updateSupplierContact);
router.delete('/supplier-contacts/:contactId', hasPermission('procurement.supplier_management.delete'), supplierController.deleteSupplierContact);

export default router;
