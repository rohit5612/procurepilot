import express from 'express';
import { authMiddleware, roleLevel } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';
import policyController from '../../controllers/procurepilot/policyController.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/catalog', policyController.getCatalog.bind(policyController));

router.get(
  '/me',
  hasPermission('procurepilot.ai_buy.read'),
  policyController.getMyPolicy.bind(policyController)
);

router.post(
  '/evaluate',
  hasPermission('procurepilot.ai_buy.read'),
  policyController.evaluate.bind(policyController)
);

router.get(
  '/roles',
  hasPermission('procurepilot.policy_admin.read'),
  roleLevel(2),
  policyController.listRolePolicies.bind(policyController)
);

router.get(
  '/spend-audit',
  hasPermission('procurepilot.policy_admin.read'),
  roleLevel(2),
  policyController.spendAudit.bind(policyController)
);

router.put(
  '/roles/:roleLevel',
  hasPermission('procurepilot.policy_admin.update'),
  roleLevel(1),
  policyController.updateRolePolicy.bind(policyController)
);

router.put(
  '/users/:userId',
  hasPermission('procurepilot.policy_admin.update'),
  roleLevel(1),
  policyController.updateUserPolicy.bind(policyController)
);

export default router;
