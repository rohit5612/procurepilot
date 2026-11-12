import express from 'express';
import controller from '../../controllers/system/transactionCategoryController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/transaction-categories', controller.list);
router.get('/transaction-categories/:id', controller.getById);
router.post('/transaction-categories', hasPermission('system.settings.create'), controller.create);
router.put('/transaction-categories/:id', hasPermission('system.settings.update'), controller.update);
router.delete('/transaction-categories/:id', hasPermission('system.settings.delete'), controller.remove);

export default router;


