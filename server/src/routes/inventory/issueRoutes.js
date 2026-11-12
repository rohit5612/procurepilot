import express from 'express';
import IssueController from '../../controllers/inventory/issueController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

router.use(authMiddleware);

router.post('/issues', hasPermission('inventory.issue.create'), (req, res) => IssueController.create(req, res));
router.post('/issues/:id/post', hasPermission('inventory.issue.update'), (req, res) => IssueController.post(req, res));
router.get('/issues', hasPermission('inventory.issue.read'), (req, res) => IssueController.list(req, res));
router.get('/issues/export', hasPermission('inventory.issue.read'), (req, res) => IssueController.export(req, res));
router.get('/issues/:id/export-xlsx', hasPermission('inventory.issue.read'), (req, res) => IssueController.exportXlsx(req, res));
router.get('/issues/:id', hasPermission('inventory.issue.read'), (req, res) => IssueController.getById(req, res));
router.put('/issues/:id', hasPermission('inventory.issue.update'), (req, res) => IssueController.update(req, res));
router.post('/issues/:id/withdraw', hasPermission('inventory.issue.delete'), (req, res) => IssueController.withdraw(req, res));
router.delete('/issues/:id', hasPermission('inventory.issue.delete'), (req, res) => IssueController.delete(req, res));

export default router;


