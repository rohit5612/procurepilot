import { query, transaction } from '../../database/connection.js';
import redisManager, { CacheKeys } from '../../config/redis.js';
import bcrypt from 'bcryptjs';

const MODULE_REGISTRY_API_CACHE_PATTERN = 'api:v1:system:moduleRegistry:*';

async function logModuleEvent(clientOrNull, moduleId, action, actorId, payload = null, results = null, errorMessage = null) {
  const client = clientOrNull && clientOrNull.query ? clientOrNull : null;
  const params = [moduleId, action, actorId, payload ? JSON.stringify(payload) : null, results ? JSON.stringify(results) : null, errorMessage];
  const directInsertSql = `INSERT INTO module_registration_logs (module_id, action, actor_id, payload, results, error_message)
                           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)`;
  try {
    if (client) await client.query(directInsertSql, params);
    else await query(directInsertSql, params);
  } catch (e2) {
    // If table missing, create it and retry once
    try {
      const createSql = `CREATE TABLE IF NOT EXISTS module_registration_logs (
        id SERIAL PRIMARY KEY,
        module_id INTEGER REFERENCES modules(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        actor_id INTEGER REFERENCES users(id),
        payload JSONB,
        results JSONB,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`;
      if (client) await client.query(createSql);
      else await query(createSql);
      if (client) await client.query(directInsertSql, params);
      else await query(directInsertSql, params);
    } catch (_) {
      // swallow to avoid breaking primary flow
    }
  }
}

export async function listDepartments() {
  const { rows } = await query(`SELECT id, name FROM departments WHERE is_active = TRUE ORDER BY name`);
  return rows;
}

export async function listModules() {
  const { rows } = await query(
    `SELECT m.*, (
       SELECT jsonb_agg(jsonb_build_object(
         'id', f.id,
         'name', f.name,
         'display_name', f.display_name,
         'route', f.route_path,
         'available_permissions', f.available_permissions,
         'available_data_scopes', f.available_data_scopes,
         'default_permissions', f.default_permissions,
         'default_data_scope', f.default_data_scope,
         'is_active', f.is_active,
         'order', f.feature_order
       ) ORDER BY f.feature_order, f.name)
       FROM features f WHERE f.module_id = m.id AND f.is_active = TRUE
     ) AS features
     FROM modules m
     ORDER BY m.module_order, m.name`
  );
  return rows;
}

export async function validateModule({ name, features }) {
  const errors = [];
  if (!name || typeof name !== 'string' || !/^[a-z][a-z0-9-_]{2,}$/.test(name)) {
    errors.push({ field: 'name', message: 'Module name is required (lowercase, letters/digits/-/_, min 3 chars)' });
  }
  if (!Array.isArray(features) || features.length === 0) {
    errors.push({ field: 'features', message: 'At least one feature is required' });
  }
  if (errors.every(e => e.field !== 'name')) {
    const nameRes = await query('SELECT 1 FROM modules WHERE name = $1 LIMIT 1', [name]);
    if (nameRes.rowCount > 0) errors.push({ field: 'name', message: 'Module name already exists' });
  }
  if (Array.isArray(features) && features.length > 0) {
    const names = features.map(f => f?.name?.trim()).filter(Boolean);
    const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
    if (dupNames.length) errors.push({ field: 'features', message: `Duplicate feature names: ${[...new Set(dupNames)].join(', ')}` });
    for (let i = 0; i < features.length; i += 1) {
      const f = features[i] || {};
      const label = `features[${i}]`;
      if (!f.name || !/^[a-z][a-z0-9-_]{2,}$/.test(f.name)) {
        errors.push({ field: label + '.name', message: 'Feature name is required (lowercase, letters/digits/-/_, min 3 chars)' });
      }
      if (!f.displayName || String(f.displayName).trim().length < 3) {
        errors.push({ field: label + '.displayName', message: 'Feature display name is required (min 3 chars)' });
      }
      if (!f.route || typeof f.route !== 'string' || !f.route.startsWith('/')) {
        errors.push({ field: label + '.route', message: 'Feature route is required and must start with /' });
      } else if (name && !f.route.startsWith(`/${name}/`)) {
        errors.push({ field: label + '.route', message: `Feature route should start with /${name}/` });
      }
    }
    const candidateRoutes = features.map(f => f?.route).filter(r => typeof r === 'string' && r.startsWith('/'));
    if (candidateRoutes.length) {
      const placeholders = candidateRoutes.map((_, i) => `$${i + 1}`).join(',');
      const routeRes = await query(`SELECT route_path FROM features WHERE is_active = TRUE AND route_path IN (${placeholders})`, candidateRoutes);
      if (routeRes.rowCount > 0) {
        const conflicts = routeRes.rows.map(r => r.route_path);
        errors.push({ field: 'routes', message: `Route conflicts detected: ${conflicts.join(', ')}` });
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function registerModule({ actorId, payload }) {
  const { name, displayName, description, version, icon, color, isCore, deploy, assignToDepartments, features } = payload;
  const result = await transaction(async (client) => {
    const modRes = await client.query(
      `INSERT INTO modules (name, display_name, description, version, is_active, is_core, icon, color, created_by)
       VALUES ($1, $2, $3, COALESCE($4,'1.0.0'), $5, COALESCE($6,false), $7, $8, $9)
       RETURNING id`,
      [name, displayName, description || null, version || '1.0.0', !!deploy, isCore, icon || null, color || null, actorId]
    );
    const moduleId = modRes.rows[0].id;
    for (const feat of (features || [])) {
      await client.query(
        `INSERT INTO features (
           module_id, name, display_name, description, is_active, feature_order,
           available_permissions, available_data_scopes, default_permissions, default_data_scope,
           icon, route_path
         ) VALUES (
           $1,$2,$3,$4, TRUE, COALESCE($5,0),
           COALESCE($6::jsonb, '[]'::jsonb), COALESCE($7::jsonb, '[]'::jsonb), COALESCE($8::jsonb, '[]'::jsonb), COALESCE($9,'department'),
           $10, $11
         )`,
        [moduleId, feat.name, feat.displayName, feat.description || null, feat.order || 0, JSON.stringify(feat.availablePermissions || []), JSON.stringify(feat.availableDataScopes || []), JSON.stringify(feat.defaultPermissions || []), feat.defaultScope || 'department', feat.icon || null, feat.route || null]
      );
    }
    if (deploy) {
      if (assignToDepartments === 'all') {
        await client.query(`INSERT INTO department_modules (department_id, module_id, granted_by)
                            SELECT d.id, $1, $2 FROM departments d
                            ON CONFLICT (department_id, module_id) DO NOTHING`, [moduleId, actorId]);
      } else if (Array.isArray(assignToDepartments) && assignToDepartments.length > 0) {
        for (const deptId of assignToDepartments) {
          await client.query(`INSERT INTO department_modules (department_id, module_id, granted_by)
                              VALUES ($1, $2, $3)
                              ON CONFLICT (department_id, module_id) DO UPDATE SET is_active = TRUE, granted_at = NOW()`, [deptId, moduleId, actorId]);
        }
      }
    }
    await logModuleEvent(client, moduleId, 'register', actorId, payload, { moduleId });
    return { moduleId };
  });
  try {
    if (payload.deploy) {
      if (payload.assignToDepartments === 'all') await redisManager.delPattern('modules:*');
      else if (Array.isArray(payload.assignToDepartments)) for (const deptId of payload.assignToDepartments) await redisManager.del(CacheKeys.departmentModules(deptId));
    }
  } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return result;
}

export async function updateModule({ moduleId, actorId, payload }) {
  const fields = ['displayName', 'description', 'version', 'icon', 'color'];
  const map = { displayName: 'display_name', description: 'description', version: 'version', icon: 'icon', color: 'color' };
  const sets = []; const values = []; let i = 1;
  for (const f of fields) if (payload[f] !== undefined) { sets.push(`${map[f]} = $${i++}`); values.push(payload[f]); }
  if (sets.length === 0) return { moduleId: Number(moduleId), updated: false };
  values.push(moduleId);
  await query(`UPDATE modules SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${i}`, values);
  try { await redisManager.delPattern('modules:*'); } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  await logModuleEvent(null, moduleId, 'update', actorId, payload, { updated: true });
  return { moduleId: Number(moduleId), updated: true };
}

export async function setModuleActive(moduleId, isActive) {
  await query('UPDATE modules SET is_active = $2, updated_at = NOW() WHERE id = $1', [moduleId, isActive]);
  try { await redisManager.delPattern('modules:*'); } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  await logModuleEvent(null, moduleId, isActive ? 'activate' : 'deactivate', null, null, { isActive });
}

export async function assignModuleToDepartments(moduleId, departmentIds, actorId) {
  const result = await transaction(async (client) => {
    for (const deptId of departmentIds) {
      await client.query(
        `INSERT INTO department_modules (department_id, module_id, granted_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (department_id, module_id) DO UPDATE SET is_active = TRUE, granted_at = NOW()`,
        [deptId, moduleId, actorId]
      );
    }
    await logModuleEvent(client, moduleId, 'assign_departments', actorId, { departmentIds });
  });

  try {
    for (const deptId of departmentIds) {
      await redisManager.del(CacheKeys.departmentModules(deptId));
    }
  } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}

  return result;
}

export async function propagateModuleToTemplates(moduleId, actorId, { dryRun = true } = {}) {
  const modRes = await query('SELECT id, name, is_core FROM modules WHERE id = $1', [moduleId]);
  if (modRes.rowCount === 0) throw new Error('Module not found');
  const module = modRes.rows[0];
  if (module.name === 'user_management') throw new Error('Propagation to core user_management is restricted');
  const featRes = await query('SELECT id, name, default_permissions, default_data_scope FROM features WHERE module_id = $1 AND is_active = TRUE', [moduleId]);
  const features = featRes.rows;
  const tplRes = await query("SELECT id, name, role_level FROM roles WHERE role_type = 'template' AND is_active = TRUE ORDER BY role_level");
  const templates = tplRes.rows;
  const diffs = [];
  for (const tpl of templates) {
    for (const feat of features) {
      const rpRes = await query('SELECT id, permissions, data_scope FROM role_permissions WHERE role_id = $1 AND feature_id = $2', [tpl.id, feat.id]);
      const hasRP = rpRes.rowCount > 0;
      const currentPerms = hasRP ? rpRes.rows[0].permissions || [] : [];
      const desired = Array.isArray(feat.default_permissions) ? feat.default_permissions : [];
      const toAdd = desired.filter(p => !currentPerms.includes(p));
      const scope = hasRP ? (rpRes.rows[0].data_scope || feat.default_data_scope) : feat.default_data_scope;
      if (toAdd.length > 0 || !hasRP) diffs.push({ roleId: tpl.id, roleName: tpl.name, roleLevel: tpl.role_level, featureId: feat.id, featureName: feat.name, addPermissions: toAdd, setScope: scope, createRow: !hasRP });
    }
  }
  if (dryRun) { await logModuleEvent(null, moduleId, 'propagate_dry_run', actorId, null, { changes: diffs.length }); return { dryRun: true, templatesAffected: templates.length, changes: diffs.length, diffs }; }
  const run = await transaction(async (client) => {
    await client.query(`CREATE TABLE IF NOT EXISTS propagation_runs (
      id SERIAL PRIMARY KEY,
      module_id INTEGER NOT NULL,
      actor_id INTEGER,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      diffs JSONB NOT NULL,
      reverted BOOLEAN DEFAULT FALSE
    )`);
    for (const d of diffs) {
      if (d.createRow) {
        await client.query(
          `INSERT INTO role_permissions (role_id, feature_id, permissions, data_scope)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (role_id, feature_id) DO UPDATE SET
             permissions = COALESCE(role_permissions.permissions,'[]'::jsonb) || $3::jsonb,
             data_scope = role_permissions.data_scope`,
          [d.roleId, d.featureId, JSON.stringify(d.addPermissions), d.setScope]
        );
      } else if (d.addPermissions.length > 0) {
        await client.query(
          `UPDATE role_permissions SET permissions = COALESCE(permissions,'[]'::jsonb) || $1::jsonb
           WHERE role_id = $2 AND feature_id = $3`,
          [JSON.stringify(d.addPermissions), d.roleId, d.featureId]
        );
      }
    }
    const runRes = await client.query('INSERT INTO propagation_runs (module_id, actor_id, diffs) VALUES ($1, $2, $3::jsonb) RETURNING id', [moduleId, actorId, JSON.stringify(diffs)]);
    await logModuleEvent(client, moduleId, 'propagate_apply', actorId, null, { runId: runRes.rows[0].id, changes: diffs.length });
    return { runId: runRes.rows[0].id };
  });
  try {
    await redisManager.delPattern('perm:*');
    await redisManager.delPattern('modules:*');
    await redisManager.delPattern('role:*');
    await redisManager.delPattern('roles:*');
    await redisManager.delPattern('rolePerm:*');
  } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return { dryRun: false, ...run, changes: diffs.length };
}

export async function rollbackPropagation(moduleId, actorId) {
  // Ensure table exists then fetch last run
  await query(`CREATE TABLE IF NOT EXISTS propagation_runs (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL,
    actor_id INTEGER,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    diffs JSONB NOT NULL,
    reverted BOOLEAN DEFAULT FALSE
  )`);
  const runRes = await query('SELECT id, diffs FROM propagation_runs WHERE module_id = $1 AND reverted = FALSE ORDER BY applied_at DESC LIMIT 1', [moduleId]);
  if (runRes.rowCount === 0) return { rolledBack: false, reason: 'no_runs' };
  const run = runRes.rows[0]; const diffs = run.diffs || [];
  await transaction(async (client) => {
    for (const d of diffs) {
      const arr = Array.isArray(d.addPermissions) ? d.addPermissions : [];
      if (arr.length > 0) {
        await client.query(
          `UPDATE role_permissions SET permissions = (
             SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
             FROM (
               SELECT elem FROM jsonb_array_elements_text(COALESCE(permissions,'[]'::jsonb)) elem
               WHERE elem NOT IN (SELECT jsonb_array_elements_text($1::jsonb))
             ) s
           ) WHERE role_id = $2 AND feature_id = $3`,
          [JSON.stringify(arr), d.roleId, d.featureId]
        );
      }
    }
    await client.query('UPDATE propagation_runs SET reverted = TRUE WHERE id = $1', [run.id]);
    await logModuleEvent(client, moduleId, 'propagate_rollback', actorId, null, { runId: run.id });
  });
  try {
    await redisManager.delPattern('perm:*');
    await redisManager.delPattern('role:*');
    await redisManager.delPattern('roles:*');
    await redisManager.delPattern('rolePerm:*');
  } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return { rolledBack: true, runId: run.id };
}

export async function deleteModule({ moduleId, actorId, password }) {
  // Fetch module and protect core/user_management
  const modRes = await query('SELECT id, name, is_core FROM modules WHERE id = $1', [moduleId]);
  if (modRes.rowCount === 0) {
    return { deleted: false, reason: 'not_found' };
  }
  const mod = modRes.rows[0];
  if (mod.is_core || mod.name === 'user_management') {
    throw new Error('Core modules cannot be deleted');
  }

  // Verify actor is superuser and password matches
  const userRes = await query('SELECT id, password_hash FROM users WHERE id = $1 AND is_superuser = TRUE', [actorId]);
  if (userRes.rowCount === 0) {
    throw new Error('Superuser required');
  }
  const ok = await bcrypt.compare(password, userRes.rows[0].password_hash);
  if (!ok) {
    throw new Error('Invalid password');
  }

  // Delete in transaction: remove dependents then module
  const txResult = await transaction(async (client) => {
    try {
      await client.query('DELETE FROM department_modules WHERE module_id = $1', [moduleId]);
    } catch (e) {
      throw new Error(`delete department_modules failed: ${e.message}`);
    }

    try {
      await client.query('DELETE FROM role_permissions WHERE feature_id IN (SELECT id FROM features WHERE module_id = $1)', [moduleId]);
    } catch (e) {
      throw new Error(`delete role_permissions failed: ${e.message}`);
    }

    try {
      await client.query('DELETE FROM features WHERE module_id = $1', [moduleId]);
    } catch (e) {
      throw new Error(`delete features failed: ${e.message}`);
    }

    try {
      await client.query('DELETE FROM propagation_runs WHERE module_id = $1', [moduleId]);
    } catch (e) {
      // ignore if table doesn't exist
      if (!/relation "?propagation_runs"? does not exist/i.test(String(e?.message || ''))) {}
    }

    try {
      await client.query('DELETE FROM modules WHERE id = $1', [moduleId]);
    } catch (e) {
      throw new Error(`delete module failed: ${e.message}`);
    }

    const exists = await client.query('SELECT 1 FROM modules WHERE id = $1', [moduleId]);
    const rem = await client.query('SELECT id FROM modules ORDER BY module_order, name');
    const out = { deleted: exists.rowCount === 0, remainingModuleIds: rem.rows.map(r => r.id) };
    return out;
  });

  try {
    await redisManager.delPattern('modules:*');
  } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}

  // Log outside the transaction with null module reference to avoid FK issues
  try { await logModuleEvent(null, null, 'delete', actorId, { moduleId }, { deleted: txResult.deleted }); } catch (_) {}

  return txResult;
}

export async function addFeature({ moduleId, actorId, payload }) {
  const { name, displayName, route, description = null, order = 0, icon = null, defaultPermissions = [], defaultScope = 'department', availablePermissions = ['create','read','update','delete'], availableDataScopes = ['own','department','all'] } = payload;
  if (!name || !/^[a-z][a-z0-9-_]{2,}$/.test(name)) throw new Error('Invalid feature name');
  if (!displayName || String(displayName).trim().length < 3) throw new Error('Invalid display name');
  const modRes = await query('SELECT name FROM modules WHERE id = $1', [moduleId]);
  if (modRes.rowCount === 0) throw new Error('Module not found');
  const modName = modRes.rows[0].name;
  const variant = `/${modName}/`;
  const hyphenVariant = `/${modName.replace(/_/g, '-')}/`;
  if (!route || !(route.startsWith(variant) || route.startsWith(hyphenVariant))) throw new Error(`Route must start with ${variant} or ${hyphenVariant}`);
  const conflicting = await query('SELECT 1 FROM features WHERE module_id = $1 AND name = $2', [moduleId, name]);
  if (conflicting.rowCount > 0) throw new Error('Feature name already exists in module');
  const routeTaken = await query('SELECT 1 FROM features WHERE route_path = $1', [route]);
  if (routeTaken.rowCount > 0) throw new Error('Route already in use');
  const res = await query(
    `INSERT INTO features (
      module_id, name, display_name, description, is_active, feature_order,
      available_permissions, available_data_scopes, default_permissions, default_data_scope, icon, route_path
    ) VALUES (
      $1,$2,$3,$4, TRUE, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10, $11
    ) RETURNING id`,
    [moduleId, name, displayName, description, order, JSON.stringify(availablePermissions), JSON.stringify(availableDataScopes), JSON.stringify(defaultPermissions), defaultScope, icon, route]
  );
  await logModuleEvent(null, moduleId, 'feature_add', actorId, payload, { featureId: res.rows[0].id });
  try { await redisManager.delPattern('modules:*'); } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return { featureId: res.rows[0].id };
}

export async function updateFeature({ moduleId, featureId, actorId, payload }) {
  const fields = ['displayName','description','order','icon','route','defaultPermissions','defaultScope'];
  const map = { displayName: 'display_name', description: 'description', order: 'feature_order', icon: 'icon', route: 'route_path', defaultPermissions: 'default_permissions', defaultScope: 'default_data_scope' };
  const sets = []; const values = []; let i = 1;
  if (payload.route) {
    const route = payload.route;
    if (typeof route !== 'string' || !route.startsWith('/')) throw new Error('Route must start with /');
    // Ensure route not used by another feature
    const rt = await query('SELECT 1 FROM features WHERE route_path = $1 AND id <> $2', [route, featureId]);
    if (rt.rowCount > 0) throw new Error('Route already in use');
  }
  for (const f of fields) if (payload[f] !== undefined) { values.push(f === 'defaultPermissions' ? JSON.stringify(payload[f]) : payload[f]); sets.push(`${map[f]} = $${i++}`); }
  if (sets.length === 0) return { featureId: Number(featureId), updated: false };
  values.push(moduleId, featureId);
  await query(`UPDATE features SET ${sets.join(', ')}, updated_at = NOW() WHERE module_id = $${i++} AND id = $${i}`, values);
  await logModuleEvent(null, moduleId, 'feature_update', actorId, { featureId, payload }, { updated: true });
  try { await redisManager.delPattern('modules:*'); } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return { featureId: Number(featureId), updated: true };
}

export async function deleteFeature({ moduleId, featureId, actorId }) {
  const ids = { moduleId: Number(moduleId), featureId: Number(featureId) };
  let deleted = false;
  let remainingFeatureIds = [];
  await transaction(async (client) => {
    await client.query('DELETE FROM role_permissions WHERE feature_id = $1', [ids.featureId]);
    const res = await client.query('DELETE FROM features WHERE id = $1 AND module_id = $2 RETURNING id', [ids.featureId, ids.moduleId]);
    deleted = res.rowCount > 0;
    const rem = await client.query('SELECT id FROM features WHERE module_id = $1 ORDER BY id', [ids.moduleId]);
    remainingFeatureIds = rem.rows.map(r => r.id);
    await logModuleEvent(client, ids.moduleId, 'feature_delete', actorId, { featureId: ids.featureId }, { deleted, remainingFeatureIds });
  });
  try { await redisManager.delPattern('modules:*'); } catch (_) {}
  try { await redisManager.delPattern(MODULE_REGISTRY_API_CACHE_PATTERN); } catch (_) {}
  return { deleted, remainingFeatureIds };
}
