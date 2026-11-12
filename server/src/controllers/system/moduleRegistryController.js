import * as service from '../../services/system/moduleRegistryService.js';
import { query } from '../../database/connection.js';
import redisManager from '../../config/redis.js';
import { buildCacheKey, cacheGetOrSet } from '../../utils/cache.js';

const MODULES_TTL_SECONDS = 300;      // 5 minutes
const DEPARTMENTS_TTL_SECONDS = 900;  // 15 minutes

export async function listModules(req, res, next) {
  try {
    const cacheKey = buildCacheKey('system:moduleRegistry:modules', {});
    const { value: modules } = await cacheGetOrSet(redisManager, cacheKey, MODULES_TTL_SECONDS, () =>
      service.listModules()
    );
    res.json({ success: true, modules });
  } catch (err) {
    next(err);
  }
}

export async function listDepartments(req, res, next) {
  try {
    const cacheKey = buildCacheKey('system:moduleRegistry:departments', {});
    const { value: departments } = await cacheGetOrSet(
      redisManager,
      cacheKey,
      DEPARTMENTS_TTL_SECONDS,
      () => service.listDepartments()
    );
    res.json({ success: true, departments });
  } catch (err) {
    next(err);
  }
}

export async function listModuleLogs(req, res, next) {
  try {
    const { limit = 50 } = req.query;
    const { rows } = await query(
      `SELECT id, module_id, action, actor_id, payload, results, error_message, created_at
       FROM module_registration_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [Math.min(Number(limit) || 50, 500)]
    );
    res.json({ success: true, logs: rows });
  } catch (err) {
    next(err);
  }
}

export async function listPropagationRuns(req, res, next) {
  try {
    const { limit = 50 } = req.query;
    const { rows } = await query(
      `SELECT id, module_id, actor_id, applied_at, diffs, reverted
       FROM propagation_runs
       ORDER BY applied_at DESC
       LIMIT $1`,
      [Math.min(Number(limit) || 50, 500)]
    );
    res.json({ success: true, runs: rows });
  } catch (err) {
    next(err);
  }
}

export async function validateModule(req, res, next) {
  try {
    const validation = await service.validateModule(req.body || {});
    res.json({ success: true, validation });
  } catch (err) {
    next(err);
  }
}

export async function registerModule(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const result = await service.registerModule({ actorId, payload: req.body || {} });
    res.status(201).json({ success: true, message: 'Module registered', ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateModule(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { moduleId } = req.params;
    const result = await service.updateModule({ moduleId, actorId, payload: req.body || {} });
    res.json({ success: true, message: 'Module updated', ...result });
  } catch (err) {
    next(err);
  }
}

export async function addFeature(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { moduleId } = req.params;
    const result = await service.addFeature({ moduleId, actorId, payload: req.body || {} });
    res.status(201).json({ success: true, message: 'Feature added', ...result });
  } catch (err) {
    next(err);
  }
}

export async function updateFeature(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { moduleId, featureId } = req.params;
    const result = await service.updateFeature({ moduleId, featureId, actorId, payload: req.body || {} });
    res.json({ success: true, message: 'Feature updated', ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteFeature(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const { moduleId, featureId } = req.params;
    const result = await service.deleteFeature({ moduleId, featureId, actorId });
    res.json({ success: true, message: 'Feature deleted', ...result });
  } catch (err) {
    next(err);
  }
}

export async function activateModule(req, res, next) {
  try {
    const { moduleId } = req.params;
    await service.setModuleActive(moduleId, true);
    res.json({ success: true, message: 'Module activated' });
  } catch (err) {
    next(err);
  }
}

export async function deactivateModule(req, res, next) {
  try {
    const { moduleId } = req.params;
    await service.setModuleActive(moduleId, false);
    res.json({ success: true, message: 'Module deactivated' });
  } catch (err) {
    next(err);
  }
}

export async function assignModuleToDepartments(req, res, next) {
  try {
    const { moduleId } = req.params;
    const { departmentIds } = req.body;
    const actorId = req.user?.id || null;

    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return res.status(400).json({ success: false, message: 'departmentIds required' });
    }

    await service.assignModuleToDepartments(moduleId, departmentIds, actorId);
    res.json({ success: true, message: 'Module assigned to departments' });
  } catch (err) {
    next(err);
  }
}

export async function propagateModuleToTemplates(req, res, next) {
  try {
    const { moduleId } = req.params;
    const actorId = req.user?.id || null;
    const { dryRun = true } = req.body || {};
    const result = await service.propagateModuleToTemplates(moduleId, actorId, { dryRun });
    res.json({ success: true, message: dryRun ? 'Dry-run successful' : 'Propagation applied', ...result });
  } catch (err) {
    next(err);
  }
}

export async function rollbackPropagation(req, res, next) {
  try {
    const { moduleId } = req.params;
    const actorId = req.user?.id || null;
    const result = await service.rollbackPropagation(moduleId, actorId);
    res.json({ success: true, message: 'Rollback complete', ...result });
  } catch (err) {
    next(err);
  }
}

export async function deleteModule(req, res, next) {
  try {
    const { moduleId } = req.params;
    const { password } = req.body || {};
    const actorId = req.user?.id || null;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Password required for deletion' });
    }

    const result = await service.deleteModule({ moduleId, actorId, password });
    if (!result.deleted) {
      const status = result.reason === 'not_found' ? 404 : 400;
      return res.status(status).json({ success: false, message: 'Module not found or could not be deleted', ...result });
    }
    res.json({ success: true, message: 'Module deleted', ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err?.message || 'Deletion failed' });
  }
}
