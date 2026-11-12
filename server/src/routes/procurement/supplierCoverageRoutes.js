import express from 'express';
import { supplierCoverageController } from '../../controllers/procurement/supplierCoverageController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @route   GET /api/procurement/supplier-coverage
 * @desc    List all supplier coverage (circles and clusters)
 * @access  Procurement users
 */
router.get(
  '/supplier-coverage',
  supplierCoverageController.listAll
);

/**
 * @route   GET /api/procurement/suppliers/:supplierId/circles
 * @desc    Get supplier's circle coverage
 * @access  Procurement users
 */
router.get(
  '/suppliers/:supplierId/circles',
  supplierCoverageController.getSupplierCircles
);

/**
 * @route   GET /api/procurement/suppliers/:supplierId/clusters
 * @desc    Get supplier's cluster coverage
 * @access  Procurement users
 */
router.get(
  '/suppliers/:supplierId/clusters',
  supplierCoverageController.getSupplierClusters
);

/**
 * @route   PUT /api/procurement/suppliers/:supplierId/circles
 * @desc    Update supplier's circle coverage
 * @access  Procurement managers
 */
router.put(
  '/suppliers/:supplierId/circles',
  hasPermission('procurement.supplier_management.update'),
  supplierCoverageController.updateSupplierCircles
);

/**
 * @route   PUT /api/procurement/suppliers/:supplierId/clusters
 * @desc    Update supplier's cluster coverage
 * @access  Procurement managers
 */
router.put(
  '/suppliers/:supplierId/clusters',
  hasPermission('procurement.supplier_management.update'),
  supplierCoverageController.updateSupplierClusters
);

export default router;

