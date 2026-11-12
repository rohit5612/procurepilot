import express from 'express';
import controller from '../../controllers/system/transactionCategoryController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

// Expose under inventory masters
router.get('/transaction-categories', hasPermission('inventory.transaction_categories.read'), controller.list);
router.get('/transaction-categories/:id', hasPermission('inventory.transaction_categories.read'), controller.getById);
router.post('/transaction-categories', hasPermission('inventory.transaction_categories.create'), controller.create);
router.put('/transaction-categories/:id', hasPermission('inventory.transaction_categories.update'), controller.update);
router.delete('/transaction-categories/:id', hasPermission('inventory.transaction_categories.delete'), controller.remove);

export default router;


