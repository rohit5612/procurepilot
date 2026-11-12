/**
 * Requisition Routes
 * Routes for requisition management
 */

import express from 'express';
import requisitionController from '../../controllers/procurement/requisitionController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { canViewRequisition } from '../../middleware/auth/requisitionAccess.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import { body, param, query } from 'express-validator';
import { upload as prUpload, attach as attachController, get as getController } from '../../controllers/procurement/requisitionAttachmentController.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware);

// Validation middleware
const createRequisitionValidation = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').optional(),
  body('requester_id').optional().isInt().withMessage('Requester ID must be an integer'),
  body('department_id').isInt().withMessage('Department ID is required and must be an integer'),
  body('project_id').optional({ nullable: true }).isString().withMessage('Project ID must be a string'),
  body('site_id').optional().isInt().withMessage('Site ID must be an integer'),
  body('needed_by_date').optional().isISO8601().withMessage('Needed by date must be a valid date'),
  body('lines').isArray().withMessage('Lines must be an array'),
  body('lines.*.item_name').notEmpty().withMessage('Item name is required'),
  body('lines.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be a positive number'),
  body('lines.*.unit_of_measure').optional().isString().withMessage('Unit of measure must be a string'),
  body('lines.*.unit_price').optional().isFloat({ min: 0 }).withMessage('Unit price must be non-negative'),
  body('lines.*.specifications').optional().isString().withMessage('Specifications must be a string'),
  body('lines.*.brand').optional().isString().withMessage('Brand must be a string'),
  body('lines.*.model').optional().isString().withMessage('Model must be a string'),
  body('lines.*.needed_by_date').optional().isISO8601().withMessage('Line needed by date must be a valid date')
];

const updateRequisitionValidation = [
  param('id').isInt().withMessage('Requisition ID must be an integer'),
  body('title').optional().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional(),
  body('needed_by_date').optional().isISO8601().withMessage('Needed by date must be a valid date'),
  body('project_id').optional({ nullable: true }).isString().withMessage('Project ID must be a string'),
  body('site_id').optional().isInt().withMessage('Site ID must be an integer'),
  body('lines').optional().isArray().withMessage('Lines must be an array')
];

const approveRequisitionValidation = [
  param('id').isInt().withMessage('Requisition ID must be an integer'),
  body('line_approvals').optional().isArray().withMessage('Line approvals must be an array'),
  body('line_approvals.*.line_id').optional().isInt().withMessage('Line ID must be an integer'),
  body('line_approvals.*.approved_quantity').optional().isFloat({ min: 0.001 }).withMessage('Approved quantity must be greater than 0'),
  body('line_approvals.*.approved_unit_price').optional().isFloat({ min: 0 }).withMessage('Approved unit price must be non-negative')
];

const rejectRequisitionValidation = [
  param('id').isInt().withMessage('Requisition ID must be an integer'),
  body('rejection_reason').notEmpty().withMessage('Rejection reason is required')
];

const requisitionIdValidation = [
  param('id').isInt().withMessage('Requisition ID must be an integer')
];

const searchItemsValidation = [
  query('search').isLength({ min: 2 }).withMessage('Search term must be at least 2 characters long')
];

// Routes

/**
 * @route   POST /api/procurement/requisitions
 * @desc    Create a new requisition
 * @access  Private - procurement.purchase_requisition.create
 */
router.post('/requisitions',
  createRequisitionValidation,
  hasPermission('procurement.purchase_requisition.create'),
  requisitionController.createRequisition
);

/**
 * @route   GET /api/procurement/requisitions
 * @desc    Get all requisitions with filtering and pagination
 * @access  Private - procurement.purchase_requisition.read
 */
router.get('/requisitions',
  hasPermission('procurement.purchase_requisition.read'),
  requisitionController.getRequisitions
);

/**
 * @route   GET /api/procurement/requisitions/export
 * @desc    Export requisitions as CSV using current filters
 * @access  Private - procurement.purchase_requisition.read
 */
router.get('/requisitions/export',
  hasPermission('procurement.purchase_requisition.read'),
  requisitionController.exportRequisitions
);

/**
 * @route   GET /api/procurement/requisitions/stats
 * @desc    Get requisition statistics
 * @access  Private - procurement.purchase_requisition.read
 */
router.get('/requisitions/stats',
  hasPermission('procurement.purchase_requisition.read'),
  requisitionController.getRequisitionStats
);

/**
 * @route   GET /api/procurement/requisitions/search/items
 * @desc    Search items for requisition lines
 * @access  Private - procurement.purchase_requisition.create
 */
router.get('/requisitions/search/items',
  searchItemsValidation,
  hasPermission('procurement.purchase_requisition.create'),
  requisitionController.searchItems
);

/**
 * @route   GET /api/procurement/requisitions/reference-price/:itemId
 * @desc    Reference unit price from price lists / item master
 */
router.get('/requisitions/reference-price/:itemId',
  hasPermission('procurement.purchase_requisition.create'),
  requisitionController.getReferenceUnitPrice
);

/**
 * @route   GET /api/procurement/requisitions/:id/vendor-options
 * @desc    Get supplier options for requisition lines
 * @access  Private - procurement.purchase_order.create
 */
router.get('/requisitions/:id/vendor-options',
  requisitionIdValidation,
  hasPermission('procurement.purchase_order.create'),
  requisitionController.getVendorOptions
);

/**
 * @route   GET /api/procurement/requisitions/:id
 * @desc    Get requisition by ID
 * @access  Private - procurement.purchase_requisition.read
 */
router.get('/requisitions/:id',
  requisitionIdValidation,
  canViewRequisition,
  requisitionController.getRequisitionById
);

/**
 * @route   PUT /api/procurement/requisitions/:id
 * @desc    Update requisition
 * @access  Private - procurement.purchase_requisition.update
 */
router.put('/requisitions/:id',
  updateRequisitionValidation,
  hasPermission('procurement.purchase_requisition.update'),
  requisitionController.updateRequisition
);

/**
 * @route   POST /api/procurement/requisitions/:id/withdraw
 * @desc    Withdraw requisition (soft delete for drafts/submitted)
 * @access  Private - procurement.purchase_requisition.delete
 */
router.post('/requisitions/:id/withdraw',
  requisitionIdValidation,
  hasPermission('procurement.purchase_requisition.delete'),
  requisitionController.withdrawRequisition
);

/**
 * @route   POST /api/procurement/requisitions/:id/submit
 * @desc    Submit requisition for approval
 * @access  Private - procurement.purchase_requisition.submit
 */
router.post('/requisitions/:id/submit',
  requisitionIdValidation,
  hasPermission('procurement.purchase_requisition.submit'),
  requisitionController.submitRequisition
);

/**
 * @route   POST /api/procurement/requisitions/:id/approve
 * @desc    Approve requisition
 * @access  Private - procurement.purchase_requisition.approve
 */
router.post('/requisitions/:id/approve',
  approveRequisitionValidation,
  hasPermission('procurement.purchase_requisition.approve'),
  requisitionController.approveRequisition
);

/**
 * @route   POST /api/procurement/requisitions/:id/reject
 * @desc    Reject requisition
 * @access  Private - procurement.purchase_requisition.approve
 */
router.post('/requisitions/:id/reject',
  rejectRequisitionValidation,
  hasPermission('procurement.purchase_requisition.approve'),
  requisitionController.rejectRequisition
);

/**
 * @route   DELETE /api/procurement/requisitions/:id
 * @desc    Delete requisition (only if in draft status)
 * @access  Private - procurement.purchase_requisition.delete
 */
router.delete('/requisitions/:id',
  requisitionIdValidation,
  hasPermission('procurement.purchase_requisition.delete'),
  requisitionController.deleteRequisition
);

export default router;

// Attachment routes (after export to avoid interfering with default exports)
router.post('/requisitions/:id/attachment',
  param('id').isInt(),
  hasPermission('procurement.purchase_requisition.update'),
  prUpload.single('file'),
  attachController
);

router.get('/requisitions/:id/attachment',
  param('id').isInt(),
  hasPermission('procurement.purchase_requisition.read'),
  getController
);

