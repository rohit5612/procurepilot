import express from 'express';
import reportController from '../../controllers/reports/reportController.js';
import { authMiddleware } from '../../middleware/auth/authMiddleware.js';
import { hasPermission } from '../../middleware/auth/permissionMiddleware.js';

const router = express.Router();

// All report endpoints require authentication
router.use(authMiddleware);

// For now, reuse a generic read permission; in practice you'll gate via role management.
// You can refine this later (e.g., separate permissions per report group).
router.post(
  '/run',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.run(req, res)
);

router.post(
  '/export',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.export(req, res)
);

router.get(
  '/presets',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.listPresets(req, res)
);

router.post(
  '/presets',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.savePreset(req, res)
);

router.delete(
  '/presets/:id',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.deletePreset(req, res)
);

router.put(
  '/presets/:id',
  hasPermission('reports.reports.read'),
  (req, res) => reportController.updatePreset(req, res)
);

export default router;


