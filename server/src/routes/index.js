import express from 'express';
import authRoutes from './auth/authRoutes.js';
import departmentRoutes from './departments/departmentRoutes.js';
import roleRoutes from './roles/roleRoutes.js';
import userRoutes from './users/userRoutes.js';
import userApprovalRoutes from './users/userApprovalRoutes.js';
import userAppealRoutes from './users/userAppealRoutes.js';
import permissionRoutes from './permissions/permissionRoutes.js';
import circleRoutes from './system/circleRoutes.js';
import clusterRoutes from './system/clusterRoutes.js';
import workflowRoutes from './system/workflowRoutes.js';
import transactionCategoryRoutes from './inventory/transactionCategoryRoutes.js';
import { testEmailService, getEmailServiceStatus } from '../controllers/test/emailTestController.js';
import supplierItemRoutes from './procurement/supplierItemRoutes.js';
import priceListRoutes from './procurement/priceListRoutes.js';
import priceListImportRoutes from './procurement/priceListImportRoutes.js';
import gstCalculationRoutes from './procurement/gstCalculationRoutes.js';
import supplierRoutes from './procurement/supplierRoutes.js';
import analyticsRoutes from './procurement/analyticsRoutes.js';
import supplierCoverageRoutes from './procurement/supplierCoverageRoutes.js';
import requisitionRoutes from './procurement/requisitionRoutes.js';
import purchaseOrderRoutes from './procurement/purchaseOrderRoutes.js';
import goodsReceiptRoutes from './procurement/goodsReceiptRoutes.js';
import rfqRoutes from './procurement/rfqRoutes.js';
import supplierInvoiceRoutes from './procurement/supplierInvoiceRoutes.js';
import storeReturnRoutes from './procurement/storeReturnRoutes.js';
import warehouseRoutes from './inventory/warehouseRoutes.js';
import itemRoutes from './inventory/itemRoutes.js';
import binRoutes from './inventory/binRoutes.js';
import itemCategoryRoutes from './inventory/itemCategoryRoutes.js';
import unitOfMeasureRoutes from './inventory/unitOfMeasureRoutes.js';
import siteRoutes from './inventory/siteRoutes.js';
import policyRoutes from './procurepilot/policyRoutes.js';
import aiBuyRoutes from './procurepilot/aiBuyRoutes.js';
import paypalRoutes from './procurepilot/paypalRoutes.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'ProcurePilot API v1.0.0',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      departments: '/api/departments',
      roles: '/api/roles',
      users: '/api/users',
      userApproval: '/api/user-approval',
      userAppeals: '/api/user-appeals',
      permissions: '/api/permissions',
      workflows: '/api/system/workflows',
      circles: '/api/system/circles',
      clusters: '/api/system/clusters',
      procurement: '/api/procurement',
      inventory: '/api/inventory',
      procurepilot: '/api/procurepilot'
    }
  });
});

router.use('/procurepilot/policy', policyRoutes);
router.use('/procurepilot/ai-buy', aiBuyRoutes);
router.use('/procurepilot/paypal', paypalRoutes);

router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/roles', roleRoutes);
router.use('/users', userRoutes);
router.use('/user-approval', userApprovalRoutes);
router.use('/user-appeals', userAppealRoutes);
router.use('/permissions', permissionRoutes);
router.use('/system/circles', circleRoutes);
router.use('/system/clusters', clusterRoutes);
router.use('/system/workflows', workflowRoutes);
router.use('/inventory', transactionCategoryRoutes);
router.use('/procurement', supplierItemRoutes);
router.use('/procurement', priceListRoutes);
router.use('/procurement', priceListImportRoutes);
router.use('/procurement', gstCalculationRoutes);
router.use('/procurement', supplierRoutes);
router.use('/procurement', supplierCoverageRoutes);
router.use('/procurement', requisitionRoutes);
router.use('/procurement', purchaseOrderRoutes);
router.use('/procurement', goodsReceiptRoutes);
router.use('/procurement', rfqRoutes);
router.use('/procurement', supplierInvoiceRoutes);
router.use('/procurement', storeReturnRoutes);
router.use('/procurement', analyticsRoutes);
router.use('/inventory', binRoutes);
router.use('/inventory', warehouseRoutes);
router.use('/inventory', itemRoutes);
router.use('/inventory', itemCategoryRoutes);
router.use('/inventory', unitOfMeasureRoutes);
router.use('/inventory', siteRoutes);

router.get('/test/email/status', getEmailServiceStatus);
router.post('/test/email/send', testEmailService);

export default router;
