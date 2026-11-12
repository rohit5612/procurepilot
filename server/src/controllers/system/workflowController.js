import * as service from '../../services/system/workflowService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

export async function listDefinitions(req, res, next) {
  try { const defs = await service.listDefinitions(); res.json({ success: true, definitions: defs }); } catch (e) { next(e); }
}
export async function createDefinition(req, res, next) {
  try { const actorId = req.user?.id || null; const out = await service.createDefinition({ actorId, payload: req.body || {} }); res.status(201).json({ success: true, ...out }); } catch (e) { next(e); }
}
export async function updateDefinition(req, res, next) {
  try { const actorId = req.user?.id || null; const { definitionId } = req.params; const out = await service.updateDefinition({ definitionId, actorId, payload: req.body || {} }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}
export async function publishDefinition(req, res, next) {
  try { const actorId = req.user?.id || null; const { definitionId } = req.params; const out = await service.publishDefinition({ definitionId, actorId }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}

export async function cloneDefinition(req, res, next) {
  try { const actorId = req.user?.id || null; const { definitionId } = req.params; const out = await service.cloneDefinition({ definitionId, actorId }); res.status(201).json({ success: true, ...out }); } catch (e) { next(e); }
}

export async function deleteDefinition(req, res, next) {
  try { const { definitionId } = req.params; const out = await service.deleteDefinition({ definitionId: Number(definitionId) }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}

export async function deprecateDefinition(req, res, next) {
  try { const { definitionId } = req.params; const { deprecated } = req.body || {}; const out = await service.setDeprecated({ definitionId: Number(definitionId), deprecated: !!deprecated }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}

export async function simulateEvent(req, res, next) {
  try { const actorId = req.user?.id || null; const { featureId, event, data } = req.body || {}; const out = await service.emitWorkflowEvent({ featureId, event, data, actorId }); res.status(201).json({ success: true, ...out }); } catch (e) { next(e); }
}

// Clean submit endpoint that triggers binding via feature/event and passes entity context
export async function submitViaBinding(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    // Support your convention 'onstatuschange' (case-insensitive), map to service event 'status_change'
    let { feature_id, event = 'submit', entity_type, entity_id, data } = req.body || {};
    const normalized = String(event || 'submit').toLowerCase();
    const mappedEvent = normalized === 'onstatuschange' ? 'status_change' : normalized;
    if (!entity_type || !Number.isInteger(Number(entity_id))) {
      return res.status(400).json({ success: false, message: 'entity_type and numeric entity_id are required' });
    }
    // Auto-resolve feature_id by entity_type if not provided
    if (!feature_id) {
      let featureName = null;
      let moduleName = null;
      if (entity_type === 'inventory_issue') { featureName = 'issue'; moduleName = 'inventory'; }
      else if (entity_type === 'store_return_note') { featureName = 'srn'; moduleName = 'inventory'; }
      else if (entity_type === 'inventory_transfer') { featureName = 'transfer'; moduleName = 'inventory'; }
      else if (entity_type === 'inventory_adjustment') { featureName = 'adjustment'; moduleName = 'inventory'; }
      else if (entity_type === 'stock_count') { featureName = 'stock_count'; moduleName = 'inventory'; }
      else if (entity_type === 'requisition') { featureName = 'purchase_requisition'; moduleName = 'procurement'; }
      else if (entity_type === 'purchase_order') { featureName = 'purchase_order'; moduleName = 'procurement'; }
      else if (entity_type === 'goods_receipt') { featureName = 'goods_receipt'; moduleName = 'procurement'; }
      if (!featureName || !moduleName) return res.status(400).json({ success: false, message: 'Unsupported entity_type' });
      try {
        const sql = `SELECT f.id
                     FROM features f
                     JOIN modules m ON m.id = f.module_id
                     WHERE m.name = $1 AND f.name = $2
                     LIMIT 1`;
        const r = await service.rawQuery(sql, [moduleName, featureName]);
        feature_id = r.rows[0]?.id;
      } catch (e) {
        return res.status(500).json({ success: false, message: 'Failed to resolve feature id', error: e.message });
      }
      if (!feature_id) {
        return res.status(400).json({ success: false, message: 'Workflow feature not found for this entity. Ensure migration ran and feature exists.' });
      }
    }
    // RBAC: require submit permission on core features per entity type
    if (entity_type === 'inventory_issue') {
      const allowed = checkPermission(req.user, 'inventory', 'issue', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Issue' });
    } else if (entity_type === 'store_return_note') {
      const allowed = checkPermission(req.user, 'inventory', 'srn', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for SRN' });
    } else if (entity_type === 'inventory_transfer') {
      const allowed = checkPermission(req.user, 'inventory', 'transfer', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Transfer' });
    } else if (entity_type === 'inventory_adjustment') {
      const allowed = checkPermission(req.user, 'inventory', 'adjustment', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Adjustment' });
    } else if (entity_type === 'stock_count') {
      const allowed = checkPermission(req.user, 'inventory', 'stock_count', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Stock Count' });
    } else if (entity_type === 'requisition') {
      const allowed = checkPermission(req.user, 'procurement', 'purchase_requisition', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Purchase Requisition' });
    } else if (entity_type === 'purchase_order') {
      const allowed = checkPermission(req.user, 'procurement', 'purchase_order', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Purchase Order' });
    } else if (entity_type === 'goods_receipt') {
      const allowed = checkPermission(req.user, 'procurement', 'goods_receipt', 'submit');
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden: missing submit permission for Goods Receipt' });
    }
    try {
      const out = await service.emitWorkflowEvent({
        featureId: Number(feature_id),
        event: mappedEvent,
        data: { ...(data || {}), entity_type, entity_id: Number(entity_id) },
        actorId,
        entityId: Number(entity_id),
        entityType: entity_type
      });
      return res.status(201).json({ success: true, ...out });
    } catch (e) {
      if (String(e.message || '').includes('no active binding')) {
        return res.status(400).json({ success: false, message: 'No active workflow binding found for this feature/event. Ensure your binding event matches one of: status_change / onstatuschange.' });
      }
      throw e;
    }
  } catch (e) { next(e); }
}

export async function listInstances(req, res, next) {
  try { const { featureId, state, from, to, page, pageSize } = req.query || {}; const out = await service.listInstances({ featureId: featureId ? Number(featureId) : undefined, state, from, to, page, pageSize }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}
export async function createInstance(req, res, next) {
  try { const actorId = req.user?.id || null; const out = await service.createInstance({ actorId, payload: req.body || {} }); res.status(201).json({ success: true, ...out }); } catch (e) { next(e); }
}
export async function getInstance(req, res, next) {
  try { const { instanceId } = req.params; const out = await service.getInstance(instanceId); res.json({ success: true, instance: out }); } catch (e) { next(e); }
}
export async function actOnInstance(req, res, next) {
  try { const actorId = req.user?.id || null; const { instanceId } = req.params; const { action, comment } = req.body || {}; const out = await service.actOnInstance({ instanceId, actorId, action, comment }); res.json({ success: true, ...out }); } catch (e) { next(e); }
}

export async function getForEntity(req, res, next) {
  try {
    const { type, id } = req.query || {};
    if (!type || !id) return res.status(400).json({ success: false, message: 'type and id are required' });
    const out = await service.getForEntity({ entityType: String(type), entityId: Number(id) });
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}

export async function getPendingAssignees(req, res, next) {
  try {
    const { type, id } = req.query || {};
    if (!type || !id) return res.status(400).json({ success: false, message: 'type and id are required' });
    const out = await service.getPendingAssignees({ entityType: String(type), entityId: Number(id) });
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}

export async function listTasks(req, res, next) {
  try {
    const { assignee, status, entity_type, page = 1, pageSize = 20 } = req.query || {};
    const userId = req.user?.id;
    
    // Parse entity_type - support comma-separated values
    const entityTypes = entity_type ? entity_type.split(',').map(t => t.trim()).filter(Boolean) : null;
    
    // Check superuser status from database to ensure accuracy
    const userCheck = await service.rawQuery(
      `SELECT u.is_superuser, MIN(r.role_level) AS role_level
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.id = $1
       GROUP BY u.is_superuser`,
      [userId]
    );
    const isSuperuser = !!userCheck.rows[0]?.is_superuser;
    const roleLevel = userCheck.rows[0]?.role_level;
    const isAdminLevel1 = Number.isInteger(roleLevel) && roleLevel <= 1;
    
    console.log('🔍 listTasks called:', { 
      assignee, status, entity_type, entityTypes, userId, isSuperuser,
      jwtSuperuser: req.user?.isSuperuser,
      queryParams: req.query 
    });
    
    let sql, params;
    
    if ((isSuperuser || isAdminLevel1) && !assignee) {
      // Superadmin/Admin L1 sees all tasks when no specific assignee is requested
      console.log('📋 Using superadmin query (all tasks)');
      
      // Build entity_type filter
      let entityTypeFilter = '';
      if (entityTypes && entityTypes.length > 0) {
        entityTypeFilter = `AND wt.entity_type = ANY($2::text[])`;
      } else {
        entityTypeFilter = 'AND ($2::text[] IS NULL OR wt.entity_type = ANY($2::text[]))';
      }
      
      sql = `
        SELECT wt.*, wi.definition_id, wi.definition_version, wi.data as instance_data,
               COALESCE(pr.entity_number, po.entity_number) AS entity_number,
               COALESCE(pr.entity_created_at, po.entity_created_at) AS entity_created_at,
               COALESCE(pr.requested_by_name, po.requested_by_name) AS requested_by_name,
               an.assignee_names
        FROM workflow_tasks wt
        JOIN workflow_instances wi ON wt.instance_id = wi.id
        LEFT JOIN LATERAL (
          SELECT r.requisition_number AS entity_number,
                 r.created_at AS entity_created_at,
                 COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username) AS requested_by_name
          FROM requisitions r
          JOIN users u ON u.id = r.requester_id
          WHERE wt.entity_type = 'requisition' AND r.id = wt.entity_id
        ) pr ON TRUE
        LEFT JOIN LATERAL (
          SELECT po.po_number AS entity_number,
                 po.created_at AS entity_created_at,
                 COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username) AS requested_by_name
          FROM purchase_orders po
          LEFT JOIN users u ON u.id = COALESCE(po.created_by, po.submitted_by)
          WHERE wt.entity_type = 'purchase_order' AND po.id = wt.entity_id
        ) po ON TRUE
        LEFT JOIN LATERAL (
          SELECT array_remove(array_agg(COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username)), NULL) AS assignee_names
          FROM unnest(wt.assignees) AS aid
          LEFT JOIN users u ON u.id = aid
        ) an ON TRUE
        WHERE 1=1
        AND ($1::text IS NULL OR wt.status = $1)
        ${entityTypeFilter}
        ORDER BY wt.created_at DESC
        LIMIT $3 OFFSET $4
      `;
      params = [
        status || null,
        entityTypes || null,
        Number(pageSize),
        (Number(page) - 1) * Number(pageSize)
      ];
    } else {
      // Regular users or when specific assignee is requested
      const targetAssignee = assignee ? Number(assignee) : userId;
      console.log('👤 Using regular user query, targetAssignee:', targetAssignee);
      
      // Build entity_type filter
      let entityTypeFilter = '';
      if (entityTypes && entityTypes.length > 0) {
        entityTypeFilter = `AND wt.entity_type = ANY($3::text[])`;
      } else {
        entityTypeFilter = 'AND ($3::text[] IS NULL OR wt.entity_type = ANY($3::text[]))';
      }
      
      sql = `
        SELECT wt.*, wi.definition_id, wi.definition_version, wi.data as instance_data,
               COALESCE(pr.entity_number, po.entity_number) AS entity_number,
               COALESCE(pr.entity_created_at, po.entity_created_at) AS entity_created_at,
               COALESCE(pr.requested_by_name, po.requested_by_name) AS requested_by_name,
               an.assignee_names
        FROM workflow_tasks wt
        JOIN workflow_instances wi ON wt.instance_id = wi.id
        LEFT JOIN LATERAL (
          SELECT r.requisition_number AS entity_number,
                 r.created_at AS entity_created_at,
                 COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username) AS requested_by_name
          FROM requisitions r
          JOIN users u ON u.id = r.requester_id
          WHERE wt.entity_type = 'requisition' AND r.id = wt.entity_id
        ) pr ON TRUE
        LEFT JOIN LATERAL (
          SELECT po.po_number AS entity_number,
                 po.created_at AS entity_created_at,
                 COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username) AS requested_by_name
          FROM purchase_orders po
          LEFT JOIN users u ON u.id = COALESCE(po.created_by, po.submitted_by)
          WHERE wt.entity_type = 'purchase_order' AND po.id = wt.entity_id
        ) po ON TRUE
        LEFT JOIN LATERAL (
          SELECT array_remove(array_agg(COALESCE(u.full_name, (u.first_name || ' ' || u.last_name), u.email, u.username)), NULL) AS assignee_names
          FROM unnest(wt.assignees) AS aid
          LEFT JOIN users u ON u.id = aid
        ) an ON TRUE
        WHERE (
          (wt.assignees IS NOT NULL AND array_length(wt.assignees, 1) > 0 AND wt.assignees @> ARRAY[$1::integer])
          OR (wt.assignees IS NULL)
        )
        AND ($2::text IS NULL OR wt.status = $2)
        ${entityTypeFilter}
        ORDER BY wt.created_at DESC
        LIMIT $4 OFFSET $5
      `;
      params = [
        targetAssignee,
        status || null,
        entityTypes || null,
        Number(pageSize),
        (Number(page) - 1) * Number(pageSize)
      ];
    }
    
    console.log('🗃️ SQL query params:', params);
    const { rows } = await service.rawQuery(sql, params);
    console.log('✅ Query result:', rows.length, 'tasks found');

    // Tighten visibility for non-super/admin-L1: only assigned via assignees or roleIds AND has approve permission
    let filtered = rows;
    if (!(isSuperuser || isAdminLevel1)) {
      // Fetch actor roles
      const ur = await service.rawQuery(`SELECT role_id FROM user_roles WHERE user_id = $1 AND is_active = true`, [userId]);
      const myRoleIds = ur.rows.map(r => Number(r.role_id));
      const hasAnyRole = (cfg) => {
        try {
          const roleIds = Array.isArray((cfg || {}).roleIds) ? (cfg.roleIds).map(Number) : [];
          return roleIds.length > 0 && myRoleIds.some(rid => roleIds.includes(rid));
        } catch (_) { return false; }
      };
      const hasApproveForEntity = (row) => {
        const et = row.entity_type;
        const tryChecks = [];
        if (et === 'inventory_issue') {
          tryChecks.push(['inventory','issue','approve']);
        } else if (et === 'store_return_note') {
          // Prefer dedicated SRN feature; fall back to Issues and legacy
          tryChecks.push(['inventory','srn','approve']);
          tryChecks.push(['inventory','issue','approve']);
        } else if (et === 'inventory_transfer') {
          tryChecks.push(['inventory','transfer','approve']);
        } else if (et === 'inventory_adjustment') {
          tryChecks.push(['inventory','adjustment','approve']);
        } else if (et === 'stock_count') {
          tryChecks.push(['inventory','stock_count','approve']);
        } else if (et === 'requisition') {
          tryChecks.push(['procurement','purchase_requisition','approve']);
        } else if (et === 'purchase_order') {
          tryChecks.push(['procurement','purchase_order','approve']);
        } else if (et === 'goods_receipt') {
          tryChecks.push(['procurement','goods_receipt','approve']);
        }
        for (const [m,f,a] of tryChecks) { if (checkPermission(req.user, m, f, a)) return true; }
        return false;
      };

      filtered = rows.filter(row => {
        const assignees = Array.isArray(row.assignees) ? row.assignees : [];
        const assigned = assignees.includes(userId) || (String(row.node_type||'') === 'approval' && hasAnyRole(row.config));
        const permOk = hasApproveForEntity(row);
        return assigned && permOk;
      });
    }

    res.json({ success: true, data: filtered });
  } catch (e) { 
    console.error('❌ listTasks error:', e.message);
    next(e); 
  }
}

export async function getTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const sql = `
      SELECT wt.*, wi.definition_id, wi.definition_version, wi.data as instance_data
      FROM workflow_tasks wt
      JOIN workflow_instances wi ON wt.instance_id = wi.id
      WHERE wt.id = $1
    `;
    const { rows } = await service.rawQuery(sql, [taskId]);
    if (rows.length === 0) throw new Error('Task not found');
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
}

export async function updateTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { config, assignees } = req.body || {};
    let sql = 'UPDATE workflow_tasks SET updated_at = NOW()';
    const params = [];
    let paramIndex = 1;

    if (config !== undefined) {
      sql += `, config = $${paramIndex}`;
      params.push(JSON.stringify(config));
      paramIndex++;
    }
    if (assignees !== undefined) {
      sql += `, assignees = $${paramIndex}`;
      params.push(assignees);
      paramIndex++;
    }

    sql += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(taskId);

    const { rows } = await service.rawQuery(sql, params);
    if (rows.length === 0) throw new Error('Task not found');
    res.json({ success: true, data: rows[0] });
  } catch (e) { next(e); }
}

export async function completeTask(req, res, next) {
  try {
    const { taskId } = req.params;
    const { action, comment } = req.body || {};
    const actorId = req.user?.id || null;

    // Permission: allow completion if actor is assignee OR is superadmin OR admin L1 OR (node role match AND approve permission)
    // Fetch task assignees
    const taskRes = await service.rawQuery(
      `SELECT assignees, entity_type, node_type, config FROM workflow_tasks WHERE id = $1`,
      [taskId]
    );
    if (taskRes.rows.length === 0) throw new Error('Task not found');
    const assignees = taskRes.rows[0].assignees || [];
    const entityType = taskRes.rows[0].entity_type || null;
    const nodeType = taskRes.rows[0].node_type || null;
    const nodeConfig = taskRes.rows[0].config || {};

    // Check privileges
    let canOverride = false;
    const supRes = await service.rawQuery('SELECT is_superuser FROM users WHERE id = $1', [actorId]);
    const isSuper = !!supRes.rows[0]?.is_superuser;
    if (!isSuper) {
      const rlRes = await service.rawQuery(
        `SELECT MIN(r.role_level) AS role_level
         FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1 AND ur.is_active = true`,
        [actorId]
      );
      canOverride = Number.isInteger(rlRes.rows[0]?.role_level) && rlRes.rows[0].role_level <= 1;
    }
    // Permission-based override: map entity_type -> inventory workflow feature name
    let canByPermission = false;
    if (entityType) {
      // Prefer existing feature permissions (no duplicate workflow features)
      const tryChecks = [];
      if (entityType === 'inventory_issue') {
        tryChecks.push(['inventory', 'issue', 'approve']);
      } else if (entityType === 'store_return_note') {
        tryChecks.push(['inventory', 'srn', 'approve']);
        tryChecks.push(['inventory', 'issue', 'approve']);
      } else if (entityType === 'inventory_transfer') {
        tryChecks.push(['inventory', 'transfer', 'approve']);
      } else if (entityType === 'inventory_adjustment') {
        tryChecks.push(['inventory', 'adjustment', 'approve']);
      } else if (entityType === 'stock_count') {
        tryChecks.push(['inventory', 'stock_count', 'approve']);
      }
      for (const [mod, feat, act] of tryChecks) {
        try {
          if (checkPermission(req.user, mod, feat, act)) { canByPermission = true; break; }
        } catch (_) {}
      }
    }

    // Role-based override: if node config targets roles and user has any of those roles
    let canByRole = false;
    if (nodeType === 'approval' && nodeConfig) {
      try {
        const roleIds = Array.isArray(nodeConfig.roleIds) ? nodeConfig.roleIds.map(Number) : [];
        if (roleIds.length > 0) {
          const ur = await service.rawQuery(`SELECT role_id FROM user_roles WHERE user_id = $1 AND is_active = true`, [actorId]);
          const userRoleIds = ur.rows.map(r => Number(r.role_id));
          canByRole = userRoleIds.some(rid => roleIds.includes(rid));
        }
      } catch (_) { canByRole = false; }
    }

    const isAssignee = Array.isArray(assignees) && assignees.includes(actorId);
    // Authorization policy: allow if any of these are true
    const allowed = isSuper || canOverride || isAssignee || canByRole || canByPermission;
    if (!allowed) {
      return res.status(403).json({ success: false, message: 'Not authorized to act on this task' });
    }

    // Update task status (idempotent handling)
    const updateSql = `
      UPDATE workflow_tasks
      SET status = 'completed', completed_by = $1, updated_at = NOW()
      WHERE id = $2 AND status = 'pending'
      RETURNING instance_id
    `;
    const updateResult = await service.rawQuery(updateSql, [actorId, taskId]);

    let instanceId;
    if (updateResult.rows.length === 0) {
      // No pending task updated; check current task state for idempotency or errors
      const checkRes = await service.rawQuery(
        `SELECT instance_id, status FROM workflow_tasks WHERE id = $1`,
        [taskId]
      );
      if (checkRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Task not found' });
      }
      const current = checkRes.rows[0];
      instanceId = current.instance_id;
      if (current.status === 'completed') {
        // Idempotent success
        return res.json({ success: true, message: 'Task already completed' });
      }
      // Task exists but not pending/complete (unexpected state)
      return res.status(409).json({ success: false, message: `Task cannot be completed from status: ${current.status}` });
    } else {
      instanceId = updateResult.rows[0].instance_id;
    }

    // Execute workflow action
    const actionResult = await service.actOnInstance({
      instanceId,
      actorId,
      action: action || 'complete',
      comment
    });

    res.json({ success: true, ...actionResult });
  } catch (e) { next(e); }
}

export async function listBindings(req, res, next) {
  try { const { featureId } = req.query; const rows = await service.listBindings({ featureId: featureId ? Number(featureId) : undefined }); res.json({ success: true, bindings: rows }); } catch (e) { next(e); }
}
export async function createBinding(req, res, next) {
  try { const actorId = req.user?.id || null; const { featureId, event, definitionId } = req.body || {}; const out = await service.createBinding({ actorId, featureId, event, definitionId }); res.status(201).json({ success: true, ...out }); } catch (e) { next(e); }
}
export async function deleteBinding(req, res, next) {
  try { const { bindingId } = req.params; const out = await service.deleteBinding(Number(bindingId)); res.json({ success: true, ...out }); } catch (e) { next(e); }
}

// Roles lookup for designer
export async function listRoles(req, res, next) {
  try {
    const { departmentId } = req.query || {};
    const params = [];
    let sql = 'SELECT id, name, display_name, role_level FROM roles WHERE is_active = true';
    if (departmentId) { sql += ' AND department_id = $1'; params.push(Number(departmentId)); }
    sql += ' ORDER BY role_level, name';
    const { rows } = await service.rawQuery(sql, params);
    res.json({ success: true, roles: rows });
  } catch (e) { next(e); }
}

// Maintenance endpoints (admin only)
export async function maintenanceReconcile(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    // Only superuser or admin L1
    const check = await service.rawQuery(`SELECT u.is_superuser, MIN(r.role_level) AS role_level
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.is_superuser`, [actorId]);
    const isSuper = !!check.rows[0]?.is_superuser;
    const lvl = check.rows[0]?.role_level;
    const isAdminL1 = Number.isInteger(lvl) && lvl <= 1;
    if (!isSuper && !isAdminL1) return res.status(403).json({ success: false, message: 'Forbidden' });

    const out = await service.reconcilePendingTasks({ dryRun: false });
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}

export async function maintenanceRebuild(req, res, next) {
  try {
    const actorId = req.user?.id || null;
    const check = await service.rawQuery(`SELECT u.is_superuser, MIN(r.role_level) AS role_level
      FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
      LEFT JOIN roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.is_superuser`, [actorId]);
    const isSuper = !!check.rows[0]?.is_superuser;
    const lvl = check.rows[0]?.role_level;
    const isAdminL1 = Number.isInteger(lvl) && lvl <= 1;
    if (!isSuper && !isAdminL1) return res.status(403).json({ success: false, message: 'Forbidden' });

    const out = await service.rebuildPendingTasksForActiveInstances({ dryRun: false });
    res.json({ success: true, data: out });
  } catch (e) { next(e); }
}


