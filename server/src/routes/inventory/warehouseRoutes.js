import express from 'express';
import warehouseController from '../../controllers/inventory/warehouseController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Warehouse Routes
router.post('/warehouses', hasPermission('inventory.warehouse_management.create'), warehouseController.createWarehouse);
router.get('/warehouses', hasPermission('inventory.warehouse_management.read'), warehouseController.getWarehouses);
router.get('/warehouses/:warehouseId', hasPermission('inventory.warehouse_management.read'), warehouseController.getWarehouseById);
router.put('/warehouses/:warehouseId', hasPermission('inventory.warehouse_management.update'), warehouseController.updateWarehouse);
router.patch('/warehouses/:warehouseId/toggle-status', hasPermission('inventory.warehouse_management.update'), warehouseController.toggleWarehouseStatus);
router.delete('/warehouses/:warehouseId', hasPermission('inventory.warehouse_management.delete'), warehouseController.deleteWarehouse);

// Warehouse Zones Routes
router.post('/warehouses/:warehouseId/zones', hasPermission('inventory.warehouse_management.create'), warehouseController.createWarehouseZone);
router.get('/warehouses/:warehouseId/zones', hasPermission('inventory.warehouse_management.read'), warehouseController.getWarehouseZones);

// Warehouse Bins Routes (for zone-based bin management)
router.post('/zones/:zoneId/bins', hasPermission('inventory.bin_management.create'), warehouseController.createWarehouseBin);
router.get('/warehouses/:warehouseId/bins', hasPermission('inventory.bin_management.read'), warehouseController.getWarehouseBins);
router.get('/warehouses/:warehouseId/default-receiving-bin', hasPermission('inventory.bin_management.read'), warehouseController.getDefaultReceivingBin);

export default router;
