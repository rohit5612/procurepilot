import { query, transaction } from '../../database/connection.js';

async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS workflow_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    graph JSONB NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // Add deprecation flag if missing
  await query(`ALTER TABLE workflow_definitions ADD COLUMN IF NOT EXISTS deprecated BOOLEAN NOT NULL DEFAULT false`);
  await query(`CREATE TABLE IF NOT EXISTS workflow_instances (
    id SERIAL PRIMARY KEY,
    definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    definition_version INTEGER NOT NULL,
    state VARCHAR(30) NOT NULL DEFAULT 'active',
    data JSONB,
    history JSONB DEFAULT '[]'::jsonb,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  // Add pointer to current node for simple progression
  await query(`ALTER TABLE workflow_instances ADD COLUMN IF NOT EXISTS current_node_id VARCHAR(100)`);
  await query(`CREATE TABLE IF NOT EXISTS workflow_bindings (
    id SERIAL PRIMARY KEY,
    feature_id INTEGER NOT NULL REFERENCES features(id) ON DELETE CASCADE,
    event VARCHAR(40) NOT NULL,
    definition_id INTEGER NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
    definition_version INTEGER NOT NULL,
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(feature_id, event)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS workflow_tasks (
    id SERIAL PRIMARY KEY,
    instance_id INTEGER NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(40) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    config JSONB,
    assignees INTEGER[],
    completed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
}
async function getDepartmentIdFromConfig({ cfg = {}, actorId, data }) {
  console.log('getDepartmentIdFromConfig called with:', { cfg, actorId, data: data ? Object.keys(data) : 'null' });
  
  const source = cfg.departmentSource || 'record.departmentId';
  console.log('Department source:', source);
  
  if (source === 'explicit' && Number.isInteger(cfg.explicitDepartmentId)) {
    console.log('Using explicit department ID:', cfg.explicitDepartmentId);
    return cfg.explicitDepartmentId;
  }
  
  if (source === 'actor.departmentId' && Number.isInteger(actorId)) {
    console.log('Looking up actor department for user:', actorId);
    const result = await query('SELECT department_id FROM user_roles WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1', [actorId]);
    const deptId = result.rows[0]?.department_id || null;
    console.log('Actor department ID:', deptId);
    return deptId;
  }
  
  // record.departmentId (prefer payload data)
  const rawDep = data && (data.departmentId ?? data.department_id);
  const parsed = rawDep !== undefined && rawDep !== null ? parseInt(rawDep, 10) : NaN;
  console.log('Checking data for department ID:', { departmentId: data?.departmentId, department_id: data?.department_id, raw: rawDep, parsed });
  
  const finalDeptId = Number.isNaN(parsed) ? null : parsed;
  console.log('Final department ID:', finalDeptId);
  return finalDeptId;
}

async function resolveAssignees({ cfg = {}, departmentId }) {
  console.log(`Resolving assignees: departmentId=${departmentId}, config=`, cfg);
  
  const inferredMode = cfg.mode || ((cfg.roleIds && cfg.roleIds.length) || cfg.roleName || (cfg.roleNames && cfg.roleNames.length) ? 'roles' : 'level');
  if (inferredMode === 'roles') {
    // Accept roleIds or roleNames for flexibility
    const roleIdsInput = Array.isArray(cfg.roleIds) ? cfg.roleIds.filter(Number.isInteger) : [];
    const roleNamesInput = Array.isArray(cfg.roleNames) ? cfg.roleNames : (cfg.roleName ? [cfg.roleName] : []);

    let roleIds = roleIdsInput;
    if (roleIds.length === 0 && roleNamesInput.length > 0) {
      const lowered = roleNamesInput.map(n => String(n).trim().toLowerCase()).filter(Boolean);
      if (lowered.length > 0) {
      const roleSql = `SELECT id FROM roles WHERE is_active = true AND lower(name) = ANY($1::text[])`;
      const res = await query(roleSql, [lowered]);
        roleIds = res.rows.map(r => r.id);
      }
    }

    if (roleIds.length === 0) {
      console.log('No role IDs resolved for roles mode');
      return [];
    }

    const sql = `SELECT DISTINCT user_id FROM user_roles WHERE is_active = true AND role_id = ANY($1::int[])`;
    const { rows } = await query(sql, [roleIds]);
    const assignees = rows.map(r => r.user_id);
    console.log(`Resolved assignees (roles/roleNames): [${assignees.join(', ')}]`);
    return assignees;
  } else {
    if (!departmentId) {
      console.log('No departmentId provided for level-mode resolution, returning empty array');
      return [];
    }
    const lvl = cfg.roleLevel;
    console.log(`Checking role level: ${lvl}, isInteger: ${Number.isInteger(lvl)}`);
    if (!Number.isInteger(lvl)) {
      console.log(`Invalid role level: ${lvl}, returning empty array`);
      return [];
    }
    const sql = `SELECT DISTINCT ur.user_id
                 FROM user_roles ur
                 JOIN roles r ON r.id = ur.role_id
                 WHERE ur.is_active = true AND r.is_active = true AND r.role_level = $1`;
    const { rows } = await query(sql, [cfg.roleLevel]);
    const assignees = rows.map(r => r.user_id);
    console.log(`Resolved assignees (roleLevel ${lvl}): [${assignees.join(', ')}]`);
    return assignees;
  }
}


function validateGraphStructure(graph, { strict = false } = {}) {
  if (!graph || typeof graph !== 'object') {
    return 'graph object is required';
  }
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  if (nodes.length === 0) {
    return 'graph must contain at least one node';
  }
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  if (graph.edges !== undefined && !Array.isArray(graph.edges)) {
    return 'graph.edges must be an array when provided';
  }

  // Basic shape checks (always on)
  const nodeIds = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== 'object') return 'each node must be an object';
    if (!n.id || typeof n.id !== 'string') return 'each node must have string id';
    if (nodeIds.has(n.id)) return `duplicate node id: ${n.id}`;
    nodeIds.add(n.id);
    if (!n.type || typeof n.type !== 'string') return `node ${n.id} missing type`;
  }
  for (const e of edges) {
    if (!e || typeof e !== 'object') return 'each edge must be an object';
    if (typeof e.from !== 'string' || typeof e.to !== 'string') return 'edge.from and edge.to must be strings';
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return `edge references unknown node: ${e.from} -> ${e.to}`;
  }

  if (!strict) return null;

  // Strict validation rules for publish
  const allowedTypes = new Set(['start', 'end', 'approval', 'decision', 'email', 'data_update', 'integration', 'delay']);
  for (const n of nodes) {
    if (!allowedTypes.has(n.type)) return `node ${n.id} has invalid type: ${n.type}`;
    if (n.type === 'approval') {
      const cfg = n.config || {};
      const mode = cfg.mode || 'level';
      if (mode === 'roles') {
        const roleIds = Array.isArray(cfg.roleIds) ? cfg.roleIds : [];
        if (roleIds.length === 0) return `node ${n.id} (approval) requires non-empty config.roleIds when mode='roles'`;
        if (!roleIds.every(v => Number.isInteger(v))) return `node ${n.id} (approval) roleIds must be integers`;
      } else {
        const lvl = cfg.roleLevel;
        const isInt = Number.isInteger(lvl);
        if (!isInt || lvl < 0 || lvl > 5) return `node ${n.id} (approval) requires config.roleLevel 0-5`;
      }
    }
  }

  const starts = nodes.filter(n => n.type === 'start');
  const ends = nodes.filter(n => n.type === 'end');
  if (starts.length !== 1) return 'graph must contain exactly one Start node';
  if (ends.length < 1) return 'graph must contain at least one End node';

  // Build adjacency and reverse adjacency
  const out = new Map();
  const inn = new Map();
  for (const id of nodeIds) { out.set(id, []); inn.set(id, []); }
  for (const e of edges) {
    out.get(e.from).push(e.to);
    inn.get(e.to).push(e.from);
  }

  const startId = starts[0].id;
  // Start has no incoming
  if ((inn.get(startId) || []).length > 0) return 'Start node must not have incoming edges';
  // Ends have no outgoing
  for (const end of ends) {
    if ((out.get(end.id) || []).length > 0) return `End node ${end.id} must not have outgoing edges`;
  }

  // Reachability from start
  const visited = new Set();
  const stack = [startId];
  while (stack.length) {
    const cur = stack.pop();
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const nxt of out.get(cur) || []) stack.push(nxt);
  }
  if (visited.size !== nodeIds.size) return 'all nodes must be reachable from Start';

  // At least one path reaches an End
  const reachableEnd = ends.some(e => visited.has(e.id));
  if (!reachableEnd) return 'at least one End must be reachable from Start';

  // Cycle detection (DFS)
  const tempMark = new Set();
  const permMark = new Set();
  function visit(nodeId) {
    if (permMark.has(nodeId)) return false;
    if (tempMark.has(nodeId)) return true; // cycle
    tempMark.add(nodeId);
    for (const nxt of out.get(nodeId) || []) {
      if (visit(nxt)) return true;
    }
    tempMark.delete(nodeId);
    permMark.add(nodeId);
    return false;
  }
  if (visit(startId)) return 'graph must be acyclic';

  return null;
}

export async function listDefinitions() {
  await ensureTables();
  const { rows } = await query('SELECT id, name, display_name, version, status, deprecated, graph, created_at, updated_at FROM workflow_definitions ORDER BY name, version DESC');
  return rows;
}

export async function createDefinition({ actorId, payload }) {
  await ensureTables();
  const { name, displayName, graph } = payload;
  if (!name || !displayName || !graph) throw new Error('name, displayName, graph required');
  // allow drafts to be saved even if not strictly valid, but ensure basic shape
  const basicErr = validateGraphStructure(graph, { strict: false });
  if (basicErr) throw new Error(`invalid graph: ${basicErr}`);
  const res = await query('INSERT INTO workflow_definitions (name, display_name, version, status, graph, created_by) VALUES ($1,$2,1,\'draft\',$3::jsonb,$4) RETURNING id', [name, displayName, JSON.stringify(graph), actorId]);
  return { definitionId: res.rows[0].id };
}

export async function updateDefinition({ definitionId, actorId, payload }) {
  await ensureTables();
  // prevent edits to published definitions
  const cur = await query('SELECT status FROM workflow_definitions WHERE id = $1', [definitionId]);
  if (cur.rowCount === 0) throw new Error('definition not found');
  if (cur.rows[0].status === 'published') throw new Error('cannot edit a published definition; clone to draft to modify');
  const fields = [];
  const values = [];
  let i = 1;
  if (payload.displayName !== undefined) { fields.push(`display_name = $${i++}`); values.push(payload.displayName); }
  if (payload.graph !== undefined) {
    const basicErr = validateGraphStructure(payload.graph, { strict: false });
    if (basicErr) throw new Error(`invalid graph: ${basicErr}`);
    fields.push(`graph = $${i++}::jsonb`); values.push(JSON.stringify(payload.graph));
  }
  if (fields.length === 0) return { updated: false };
  values.push(definitionId);
  await query(`UPDATE workflow_definitions SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`, values);
  return { updated: true };
}

export async function publishDefinition({ definitionId, actorId }) {
  await ensureTables();
  // increment version and mark published
  return transaction(async (client) => {
    const cur = await client.query('SELECT id, name, display_name, version, graph FROM workflow_definitions WHERE id = $1 FOR UPDATE', [definitionId]);
    if (cur.rowCount === 0) throw new Error('definition not found');
    const d = cur.rows[0];
    // strict graph validation
    const vErr = validateGraphStructure(d.graph, { strict: true });
    if (vErr) {
      throw new Error(`invalid graph: ${vErr}`);
    }
    const newVersion = (d.version || 1) + 1;
    await client.query('UPDATE workflow_definitions SET version = $1, status = \'published\', updated_at = NOW() WHERE id = $2', [newVersion, definitionId]);
    return { definitionId, version: newVersion, status: 'published' };
  });
}

export async function deleteDefinition({ definitionId }) {
  await ensureTables();
  // Only allow deleting drafts with no bindings or instances
  const cur = await query('SELECT status FROM workflow_definitions WHERE id = $1', [definitionId]);
  if (cur.rowCount === 0) throw new Error('definition not found');
  if (cur.rows[0].status === 'published') throw new Error('cannot delete a published definition');
  const b = await query('SELECT 1 FROM workflow_bindings WHERE definition_id = $1 LIMIT 1', [definitionId]);
  if (b.rowCount > 0) throw new Error('cannot delete: definition is bound to a feature');
  const i = await query('SELECT 1 FROM workflow_instances WHERE definition_id = $1 LIMIT 1', [definitionId]);
  if (i.rowCount > 0) throw new Error('cannot delete: instances exist for this definition');
  await query('DELETE FROM workflow_definitions WHERE id = $1', [definitionId]);
  return { deleted: true };
}

export async function setDeprecated({ definitionId, deprecated }) {
  await ensureTables();
  const cur = await query('SELECT status FROM workflow_definitions WHERE id = $1', [definitionId]);
  if (cur.rowCount === 0) throw new Error('definition not found');
  if (cur.rows[0].status !== 'published') throw new Error('only published definitions can be deprecated');
  await query('UPDATE workflow_definitions SET deprecated = $1, updated_at = NOW() WHERE id = $2', [!!deprecated, definitionId]);
  return { definitionId, deprecated: !!deprecated };
}

// Update requisition status when workflow completes
async function updateRequisitionStatus(instanceId, workflowState, actorId, comment) {
  try {
    // Find the requisition associated with this workflow instance
    const requisitionResult = await query(
      'SELECT id FROM requisitions WHERE workflow_instance_id = $1',
      [instanceId]
    );
    
    if (requisitionResult.rows.length === 0) {
      // No requisition found for this workflow - might be a different type of workflow
      return;
    }
    
    const requisitionId = requisitionResult.rows[0].id;
    
  // Update requisition status based on workflow state
  if (workflowState === 'approved') {
      await query(`
        UPDATE requisitions 
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, requisitionId]);
      
      console.log(`Requisition ${requisitionId} approved via workflow completion`);
  } else if (workflowState === 'rejected') {
      await query(`
        UPDATE requisitions 
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = COALESCE($3, 'Rejected via workflow'),
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, requisitionId, comment || null]);
      console.log(`Requisition ${requisitionId} rejected via workflow completion`);
  }
  } catch (err) {
    console.error('Error updating requisition status:', err);
  }
}

// Update inventory issue (delivery challan) status when workflow completes
async function updateInventoryIssueStatus(instanceId, workflowState, actorId, comment) {
  try {
    // Find the inventory issue associated with this workflow instance
    const issueResult = await query(
      'SELECT id, status FROM inventory_issues WHERE workflow_instance_id = $1',
      [instanceId]
    );
    
    if (issueResult.rows.length === 0) {
      // No issue found for this workflow - might be a different type of workflow
      return;
    }
    
    const issueId = issueResult.rows[0].id;
    const currentStatus = issueResult.rows[0].status;
    
    // Update issue status based on workflow state
    if (workflowState === 'approved') {
      await query(`
        UPDATE inventory_issues 
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, issueId]);
      
      console.log(`Inventory Issue ${issueId} approved via workflow completion`);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE inventory_issues 
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = $2,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $3
      `, [actorId, comment || 'Rejected via workflow', issueId]);
      
      console.log(`Inventory Issue ${issueId} rejected via workflow completion`);
    }
  } catch (err) {
    console.error('Error updating inventory issue status:', err);
  }
}

// Update store return note status when workflow completes
async function updateStoreReturnNoteStatus(instanceId, workflowState, actorId, comment) {
  try {
    // Find the store return note associated with this workflow instance
    const srnResult = await query(
      'SELECT id, status FROM store_return_notes WHERE workflow_instance_id = $1',
      [instanceId]
    );
    
    if (srnResult.rows.length === 0) {
      // No SRN found for this workflow - might be a different type of workflow
      return;
    }
    
    const srnId = srnResult.rows[0].id;
    const currentStatus = srnResult.rows[0].status;
    
    // Update SRN status based on workflow state
    if (workflowState === 'approved') {
      await query(`
        UPDATE store_return_notes 
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1
        WHERE id = $2
      `, [actorId, srnId]);
      
      console.log(`Store Return Note ${srnId} approved via workflow completion`);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE store_return_notes 
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = $2
        WHERE id = $3
      `, [actorId, comment || 'Rejected via workflow', srnId]);
      
      console.log(`Store Return Note ${srnId} rejected via workflow completion`);
    }
  } catch (err) {
    console.error('Error updating store return note status:', err);
  }
}

// Update inventory adjustment status when workflow completes
async function updateInventoryAdjustmentStatus(instanceId, workflowState, actorId, comment) {
  try {
    const res = await query(
      'SELECT id, status FROM inventory_adjustments WHERE workflow_instance_id = $1',
      [instanceId]
    );
    if (res.rows.length === 0) return;
    const adjId = res.rows[0].id;
    if (workflowState === 'approved') {
      await query(`
        UPDATE inventory_adjustments 
        SET status = 'approved',
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, adjId]);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE inventory_adjustments 
        SET status = 'rejected',
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, adjId]);
    }
  } catch (err) {
    console.error('Error updating inventory adjustment status:', err);
  }
}

// Update stock count status when workflow completes
async function updateStockCountStatus(instanceId, workflowState, actorId, comment) {
  try {
    const res = await query('SELECT id FROM stock_counts WHERE workflow_instance_id = $1', [instanceId]);
    if (res.rows.length === 0) return;
    const scId = res.rows[0].id;
    if (workflowState === 'approved') {
      await query(`
        UPDATE stock_counts
        SET status = 'approved', updated_at = NOW(), updated_by = $1
        WHERE id = $2
      `, [actorId, scId]);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE stock_counts
        SET status = 'rejected', updated_at = NOW(), updated_by = $1
        WHERE id = $2
      `, [actorId, scId]);
    }
  } catch (err) {
    console.error('Error updating stock count status:', err);
  }
}

// Update inventory transfer status when workflow completes
async function updateInventoryTransferStatus(instanceId, workflowState, actorId, comment) {
  try {
    const res = await query(
      'SELECT id, status FROM inventory_transfers WHERE workflow_instance_id = $1',
      [instanceId]
    );
    if (res.rows.length === 0) return;
    const transferId = res.rows[0].id;
    if (workflowState === 'approved') {
      await query(`
        UPDATE inventory_transfers 
        SET status = 'approved',
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, transferId]);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE inventory_transfers 
        SET status = 'rejected',
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, transferId]);
    }
  } catch (err) {
    console.error('Error updating inventory transfer status:', err);
  }
}

// Update purchase order status when workflow completes
async function updatePurchaseOrderStatus(instanceId, workflowState, actorId, comment) {
  try {
    // Find the purchase order associated with this workflow instance
    const poResult = await query(
      'SELECT id FROM purchase_orders WHERE workflow_instance_id = $1',
      [instanceId]
    );
    
    if (poResult.rows.length === 0) {
      // No PO found for this workflow - might be a different type of workflow
      return;
    }
    
    const poId = poResult.rows[0].id;
    
    // Update PO status based on workflow state
    if (workflowState === 'approved') {
      await query(`
        UPDATE purchase_orders 
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, poId]);
      
      console.log(`Purchase Order ${poId} approved via workflow completion`);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE purchase_orders 
        SET status = 'rejected',
            receiving_status = 'closed',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = $2,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $3
      `, [actorId, comment || 'Rejected via workflow', poId]);
      
      console.log(`Purchase Order ${poId} rejected via workflow completion`);
    }
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    // Don't throw - workflow should complete even if PO update fails
  }
}

// Update goods receipt status when workflow completes
async function updateGoodsReceiptStatus(instanceId, workflowState, actorId, comment) {
  try {
    const grnRes = await query(
      'SELECT id FROM goods_receipts WHERE workflow_instance_id = $1',
      [instanceId]
    );
    if (grnRes.rows.length === 0) return;
    const grnId = grnRes.rows[0].id;
    if (workflowState === 'approved') {
      await query(`
        UPDATE goods_receipts
        SET status = 'approved',
            approved_at = NOW(),
            approved_by = $1,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $2
      `, [actorId, grnId]);
      console.log(`Goods Receipt ${grnId} approved via workflow completion`);
    } else if (workflowState === 'rejected') {
      await query(`
        UPDATE goods_receipts
        SET status = 'rejected',
            rejected_at = NOW(),
            rejected_by = $1,
            rejection_reason = $2,
            updated_at = NOW(),
            updated_by = $1
        WHERE id = $3
      `, [actorId, comment || 'Rejected via workflow', grnId]);
      console.log(`Goods Receipt ${grnId} rejected via workflow completion`);
    }
  } catch (err) {
    console.error('Error updating goods receipt status:', err);
  }
}

export async function emitWorkflowEvent({ featureId, event, data, actorId, entityId, entityType }) {
  await ensureTables();
  if (!featureId || !event) throw new Error('featureId and event required');
  // Normalize and accept synonyms ('status_change', 'onstatuschange', 'on_status_change')
  const base = String(event).toLowerCase();
  const variants = Array.from(new Set([
    base,
    base.replace(/\s+/g, '_'),
    base === 'status_change' ? 'onstatuschange' : undefined,
    base === 'status_change' ? 'on_status_change' : undefined,
    base === 'onstatuschange' ? 'status_change' : undefined,
    base === 'on_status_change' ? 'status_change' : undefined
  ].filter(Boolean)));
  const b = await query(
    `SELECT wb.definition_id, wd.version
     FROM workflow_bindings wb
     JOIN workflow_definitions wd ON wd.id = wb.definition_id
     WHERE wb.feature_id = $1 AND LOWER(wb.event) = ANY($2::text[]) AND wd.status = 'published' AND wd.deprecated = false
     ORDER BY wb.created_at DESC
     LIMIT 1`,
    [featureId, variants]
  );
  if (b.rowCount === 0) throw new Error('no active binding for this event');
  const defId = b.rows[0].definition_id;
  const version = b.rows[0].version;
  
  // Load graph to initialize first step (same as createInstance)
  const drow = await query('SELECT graph FROM workflow_definitions WHERE id = $1', [defId]);
  const graph = drow.rows[0].graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const start = nodes.find(n => n.type === 'start');
  const firstEdge = edges.find(e => e.from === (start?.id || ''));
  const firstNodeId = firstEdge?.to || null;
  
  const res = await query('INSERT INTO workflow_instances (definition_id, definition_version, data, created_by, current_node_id, entity_id, entity_type) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7) RETURNING id', [defId, version, JSON.stringify(data || {}), actorId, firstNodeId, entityId || null, entityType || null]);
  const instanceId = res.rows[0].id;
  
  // Update entity status to 'submitted' when workflow starts
  if (entityId && entityType) {
    try {
      if (entityType === 'inventory_issue') {
        await query(`
          UPDATE inventory_issues 
          SET status = 'submitted', 
              workflow_instance_id = $1,
              submitted_at = NOW(),
              submitted_by = $2,
              updated_at = NOW(),
              updated_by = $2
          WHERE id = $3
        `, [instanceId, actorId, entityId]);
        console.log(`Inventory Issue ${entityId} submitted for approval`);
      } else if (entityType === 'store_return_note') {
        await query(`
          UPDATE store_return_notes 
          SET status = 'submitted', 
              workflow_instance_id = $1,
              submitted_at = NOW(),
              submitted_by = $2
          WHERE id = $3
        `, [instanceId, actorId, entityId]);
        console.log(`Store Return Note ${entityId} submitted for approval`);
      } else if (entityType === 'inventory_transfer') {
        await query(`
          UPDATE inventory_transfers 
          SET status = 'submitted', 
              workflow_instance_id = $1,
              updated_at = NOW(),
              updated_by = $2
          WHERE id = $3
        `, [instanceId, actorId, entityId]);
        console.log(`Inventory Transfer ${entityId} submitted for approval`);
      } else if (entityType === 'inventory_adjustment') {
        await query(`
          UPDATE inventory_adjustments 
          SET status = 'submitted', 
              workflow_instance_id = $1,
              submitted_at = NOW(),
              submitted_by = $2,
              updated_at = NOW(),
              updated_by = $2
          WHERE id = $3
        `, [instanceId, actorId, entityId]);
        console.log(`Inventory Adjustment ${entityId} submitted for approval`);
      } else if (entityType === 'stock_count') {
        await query(`
          UPDATE stock_counts 
          SET status = 'submitted',
              workflow_instance_id = $1,
              submitted_at = NOW(),
              submitted_by = $2,
              updated_at = NOW(),
              updated_by = $2
          WHERE id = $3
        `, [instanceId, actorId, entityId]);
        console.log(`Stock Count ${entityId} submitted for approval`);
      } else if (entityType === 'goods_receipt') {
        // Only update workflow_instance_id; status is already set by service layer
        await query(`
          UPDATE goods_receipts
          SET workflow_instance_id = $1,
              updated_at = NOW(),
              updated_by = $2
          WHERE id = $3 AND status = 'pending_approval'
        `, [instanceId, actorId, entityId]);
        console.log(`Goods Receipt ${entityId} linked to workflow instance ${instanceId}`);
      }
    } catch (err) {
      console.error(`Error updating ${entityType} status to submitted:`, err);
    }
  }
  
  // Create approval tasks if the first node is an approval node
  if (firstNodeId) {
    const n = nodes.find(x => x.id === firstNodeId) || {};
    if (n.type === 'approval') {
      const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId, data: data || {} });
      const assignees = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
      await query('INSERT INTO workflow_tasks (instance_id, node_id, node_type, config, assignees, entity_id, entity_type, context) VALUES ($1,$2,$3,$4::jsonb,$5::int[],$6,$7,$8::jsonb)', [instanceId, n.id, n.type, JSON.stringify(n.config || {}), assignees.length ? assignees : null, entityId || null, entityType || null, JSON.stringify(data || {})]);
    }
  }
  
  return { instanceId };
}

export async function listInstances({ featureId, state, from, to, page = 1, pageSize = 20 }) {
  await ensureTables();
  const where = [];
  const params = [];
  let i = 1;
  if (state) { where.push(`state = $${i++}`); params.push(state); }
  if (from) { where.push(`created_at >= $${i++}`); params.push(new Date(from)); }
  if (to) { where.push(`created_at <= $${i++}`); params.push(new Date(to)); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const offset = Math.max(0, (Number(page) - 1) * limit);
  const { rows } = await query(`SELECT id, definition_id, definition_version, state, data, created_at, updated_at FROM workflow_instances ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params);
  const totalRes = await query(`SELECT COUNT(*)::int AS count FROM workflow_instances ${whereSql}`, params);
  return { items: rows, total: totalRes.rows[0].count, page: Number(page), pageSize: limit };
}

export async function createInstance({ actorId, payload }) {
  await ensureTables();
  const { definitionId, data } = payload;
  const def = await query('SELECT id, version FROM workflow_definitions WHERE id = $1 AND status = \'published\'', [definitionId]);
  if (def.rowCount === 0) throw new Error('definition not published');
  const v = def.rows[0].version;
  // Load graph to initialize first step
  const drow = await query('SELECT graph FROM workflow_definitions WHERE id = $1', [definitionId]);
  const graph = drow.rows[0].graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const start = nodes.find(n => n.type === 'start');
  const firstEdge = edges.find(e => e.from === (start?.id || ''));
  const firstNodeId = firstEdge?.to || null;
  const res = await query('INSERT INTO workflow_instances (definition_id, definition_version, data, created_by, current_node_id) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING id', [definitionId, v, JSON.stringify(data || {}), actorId, firstNodeId]);
  const instanceId = res.rows[0].id;
  if (firstNodeId) {
    const n = nodes.find(x => x.id === firstNodeId) || {};
    if (n.type === 'approval') {
      const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId, data: data || {} });
      const assignees = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
      await query('INSERT INTO workflow_tasks (instance_id, node_id, node_type, config, assignees) VALUES ($1,$2,$3,$4::jsonb,$5::int[])', [instanceId, n.id, n.type, JSON.stringify(n.config || {}), assignees.length ? assignees : null]);
    }
  }
  return { instanceId };
}

export async function getInstance(instanceId) {
  await ensureTables();
  const { rows } = await query('SELECT id, definition_id, definition_version, state, data, history, current_node_id, created_at, updated_at FROM workflow_instances WHERE id = $1', [instanceId]);
  if (rows.length === 0) throw new Error('instance not found');
  const tasksRes = await query('SELECT id, node_id, node_type, status, assignees, completed_by, created_at, updated_at FROM workflow_tasks WHERE instance_id = $1 ORDER BY created_at', [instanceId]);
  return { ...rows[0], tasks: tasksRes.rows };
}

export async function getForEntity({ entityType, entityId }) {
  await ensureTables();
  // Find instance by entity
  const instRes = await query(`
    SELECT wi.id, wi.definition_id, wi.definition_version, wi.state, wi.data, wi.history, wi.current_node_id, wi.created_at, wi.updated_at, wi.created_by,
           u.full_name as submitted_by_name
    FROM workflow_instances wi
    LEFT JOIN users u ON u.id = wi.created_by
    WHERE wi.entity_type = $1 AND wi.entity_id = $2
    ORDER BY wi.created_at DESC LIMIT 1
  `, [entityType, entityId]);
  const instance = instRes.rows[0] || null;
  if (!instance) return { instance: null, definition: null, computed: { submission: null, steps: [], finalApproval: null } };
  const defRes = await query('SELECT id, name, display_name, version, graph FROM workflow_definitions WHERE id = $1', [instance.definition_id]);
  const definition = defRes.rows[0] || null;
  const graph = definition?.graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const history = Array.isArray(instance.history) ? instance.history : [];
  
  // Build submission info
  const submission = {
    submitted_by: instance.submitted_by_name || 'Unknown',
    submitted_at: instance.created_at
  };
  
  const steps = [];
  // Resolve each approval node as a step
  for (const n of nodes.filter(n => n.type === 'approval')) {
    const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId: null, data: instance.data || {} });
    const assigneeIds = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
    let assignees = [];
    if (assigneeIds.length) {
      const { rows } = await query(`
        SELECT u.id, u.full_name AS name, u.email, u.is_superuser,
               MIN(r.role_level) AS role_level,
               MAX(r.display_name) FILTER (WHERE r.display_name IS NOT NULL) AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = ANY($1::int[])
        GROUP BY u.id, u.full_name, u.email, u.is_superuser
      `, [assigneeIds]);
      const rawAssignees = rows.map(r => ({ id: r.id, name: r.name, email: r.email, role: r.role_name, isSuperuser: !!r.is_superuser, roleLevel: r.role_level !== null ? Number(r.role_level) : null }));
      // Hide superadmins and level 1 admins from pending display per policy
      assignees = rawAssignees.filter(a => !(a.isSuperuser || (Number.isInteger(a.roleLevel) && a.roleLevel <= 1)));
    }
    
    // Check if this step was completed
    const historyEntry = history.find(h => h.nodeId === n.id);
    let approvedBy = null;
    if (historyEntry && historyEntry.by) {
      const actorRes = await query(`
        SELECT u.full_name AS name, MAX(r.display_name) AS role_name
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
        LEFT JOIN roles r ON r.id = ur.role_id
        WHERE u.id = $1
        GROUP BY u.full_name
      `, [historyEntry.by]);
      if (actorRes.rows.length) {
        approvedBy = {
          name: actorRes.rows[0].name,
          role: actorRes.rows[0].role_name || 'Approver',
          date: historyEntry.at,
          action: historyEntry.action || 'approved',
          reason: historyEntry.comment || null
        };
      }
    }
    
    const status = n.id === instance.current_node_id
      ? 'current'
      : history.some(h => h.nodeId === n.id)
        ? 'completed'
        : 'pending';
    steps.push({ id: n.id, name: n.name || n.id, status, assignees, approvedBy });
  }
  
  const currentStepIndex = steps.findIndex(s => s.status === 'current');
  
  // Check if fully approved
  let finalApproval = null;
  if (instance.state === 'approved') {
    const lastStep = steps[steps.length - 1];
    if (lastStep?.approvedBy) {
      finalApproval = {
        date: lastStep.approvedBy.date,
        message: 'Fully Approved'
      };
    }
  }
  
  return { 
    instance, 
    definition: { id: definition?.id, name: definition?.name, display_name: definition?.display_name, version: definition?.version }, 
    computed: { submission, currentStepIndex, steps, finalApproval } 
  };
}

export async function getPendingAssignees({ entityType, entityId }) {
  await ensureTables();
  const instRes = await query('SELECT id, definition_id, definition_version, state, data, current_node_id FROM workflow_instances WHERE entity_type = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 1', [entityType, entityId]);
  const row = instRes.rows[0] || null;
  if (!row) return { assignees: [] };
  const drow = await query('SELECT graph FROM workflow_definitions WHERE id = $1', [row.definition_id]);
  const graph = drow.rows[0]?.graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const n = nodes.find(x => x.id === row.current_node_id) || {};
  if (n.type !== 'approval') return { assignees: [] };
  const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId: null, data: row.data || {} });
  const assigneeIds = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
  if (assigneeIds.length === 0) return { assignees: [] };
  const { rows } = await query('SELECT id, name, email FROM users WHERE id = ANY($1::int[])', [assigneeIds]);
  return { assignees: rows.map(r => ({ id: r.id, name: r.name, email: r.email })) };
}

export async function actOnInstance({ instanceId, actorId, action, comment }) {
  await ensureTables();
  // Minimal: append to history and advance along edges
  const inst = await query('SELECT i.id, i.definition_id, i.state, i.history, i.current_node_id, i.data, i.entity_id, i.entity_type, d.graph FROM workflow_instances i JOIN workflow_definitions d ON d.id = i.definition_id WHERE i.id = $1', [instanceId]);
  if (inst.rowCount === 0) throw new Error('instance not found');
  const row = inst.rows[0];
  const state = row.state;
  const history = Array.isArray(row.history) ? row.history : [];
  const graph = row.graph || { nodes: [], edges: [] };
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const currentNodeId = row.current_node_id;
  const entry = { at: new Date().toISOString(), by: actorId, action, comment, nodeId: currentNodeId };
  // Complete any pending task at current node
  await query("UPDATE workflow_tasks SET status = 'completed', completed_by = $3, updated_at = NOW() WHERE instance_id = $1 AND node_id = $2 AND status = 'pending'", [instanceId, currentNodeId, actorId]);
  // Decide next node by matching edge condition (label/condition)
  const outgoing = edges.filter(e => e.from === currentNodeId);
  let nextId = null;
  
  // Match by condition/label equals action if provided, else first
  let match = null;
  if (action) {
    const actionLower = String(action).toLowerCase();
    
    // Handle action mapping: reject -> rejected, approve -> approved
    const mappedAction = actionLower === 'reject' ? 'rejected' : 
                        actionLower === 'approve' ? 'approved' : actionLower;
    
    // First try exact condition match with mapped action
    match = outgoing.find(e => (e.condition || '').toLowerCase() === mappedAction);
    // If no condition match, try original action
    if (!match) {
      match = outgoing.find(e => (e.condition || '').toLowerCase() === actionLower);
    }
    // If still no match, try label match
    if (!match) {
      match = outgoing.find(e => (e.label || '').toLowerCase().includes(actionLower) || 
                                 (e.label || '').toLowerCase().includes(mappedAction));
    }
  }
  
  nextId = (match || outgoing[0] || {}).to || null;
  
  console.log(`Workflow transition: ${currentNodeId} -> ${nextId} (action: ${action}, matched edge:`, match || 'none', ')');
  let nextState = state;
  if (nextId) {
    const n = nodes.find(x => x.id === nextId) || {};
    if (n.type === 'end') {
      nextState = action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'completed');
      await query('UPDATE workflow_instances SET state = $1, current_node_id = $2, history = COALESCE(history,\'[]\'::jsonb) || $3::jsonb, updated_at = NOW() WHERE id = $4', [nextState, nextId, JSON.stringify([entry]), instanceId]);
      
      // Update entity statuses when workflow completes
      await updateRequisitionStatus(instanceId, nextState, actorId, comment);
      await updatePurchaseOrderStatus(instanceId, nextState, actorId, comment);
      await updateInventoryIssueStatus(instanceId, nextState, actorId, comment);
      await updateStoreReturnNoteStatus(instanceId, nextState, actorId, comment);
      await updateInventoryAdjustmentStatus(instanceId, nextState, actorId, comment);
      await updateInventoryTransferStatus(instanceId, nextState, actorId, comment);
      await updateGoodsReceiptStatus(instanceId, nextState, actorId, comment);
      await updateStockCountStatus(instanceId, nextState, actorId, comment);
    } else {
      await query('UPDATE workflow_instances SET current_node_id = $1, history = COALESCE(history,\'[]\'::jsonb) || $2::jsonb, updated_at = NOW() WHERE id = $3', [nextId, JSON.stringify([entry]), instanceId]);
      if (n.type === 'approval') {
        const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId, data: row.data || {} });
        const assignees = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
        await query('INSERT INTO workflow_tasks (instance_id, node_id, node_type, config, assignees, entity_id, entity_type, context) VALUES ($1,$2,$3,$4::jsonb,$5::int[],$6,$7,$8::jsonb)', [instanceId, n.id, n.type, JSON.stringify(n.config || {}), assignees.length ? assignees : null, row.entity_id || null, row.entity_type || null, row.data]);
      }
    }
  } else {
    // No outgoing edges: treat as terminal
    nextState = action === 'approve' ? 'approved' : (action === 'reject' ? 'rejected' : 'completed');
    await query('UPDATE workflow_instances SET state = $1, history = COALESCE(history,\'[]\'::jsonb) || $2::jsonb, updated_at = NOW() WHERE id = $3', [nextState, JSON.stringify([entry]), instanceId]);
    
    // Update entity statuses when workflow completes
    await updateRequisitionStatus(instanceId, nextState, actorId, comment);
    await updatePurchaseOrderStatus(instanceId, nextState, actorId, comment);
    await updateInventoryIssueStatus(instanceId, nextState, actorId, comment);
    await updateStoreReturnNoteStatus(instanceId, nextState, actorId, comment);
    await updateInventoryAdjustmentStatus(instanceId, nextState, actorId, comment);
    await updateInventoryTransferStatus(instanceId, nextState, actorId, comment);
    await updateGoodsReceiptStatus(instanceId, nextState, actorId, comment);
    await updateStockCountStatus(instanceId, nextState, actorId, comment);
  }
  return { state: nextState };
}

// Bindings
export async function listBindings({ featureId } = {}) {
  await ensureTables();
  if (featureId) {
    const { rows } = await query('SELECT id, feature_id, event, definition_id, definition_version, created_at FROM workflow_bindings WHERE feature_id = $1 ORDER BY created_at DESC', [featureId]);
    return rows;
  }
  const { rows } = await query('SELECT id, feature_id, event, definition_id, definition_version, created_at FROM workflow_bindings ORDER BY created_at DESC');
  return rows;
}

// Expose a safe passthrough for simple reads (for listRoles)
export async function rawQuery(sql, params = []) {
  return query(sql, params);
}

export async function createBinding({ actorId, featureId, event, definitionId }) {
  await ensureTables();
  const allowed = new Set(['onCreate','onUpdate','onStatusChange']);
  if (!allowed.has(event)) throw new Error('invalid event');
  const def = await query("SELECT id, status, version FROM workflow_definitions WHERE id = $1", [definitionId]);
  if (def.rowCount === 0 || def.rows[0].status !== 'published') throw new Error('definition not published');
  const v = def.rows[0].version;
  const res = await query('INSERT INTO workflow_bindings (feature_id, event, definition_id, definition_version, created_by) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (feature_id,event) DO UPDATE SET definition_id = EXCLUDED.definition_id, definition_version = EXCLUDED.definition_version RETURNING id', [featureId, event, definitionId, v, actorId]);
  return { bindingId: res.rows[0].id };
}

export async function deleteBinding(bindingId) {
  await ensureTables();
  await query('DELETE FROM workflow_bindings WHERE id = $1', [bindingId]);
  return { deleted: true };
}

export async function cloneDefinition({ definitionId, actorId }) {
  await ensureTables();
  const cur = await query('SELECT name, display_name, graph FROM workflow_definitions WHERE id = $1', [definitionId]);
  if (cur.rowCount === 0) throw new Error('definition not found');
  const d = cur.rows[0];
  const basicErr = validateGraphStructure(d.graph, { strict: false });
  if (basicErr) throw new Error(`cannot clone invalid definition: ${basicErr}`);
  const res = await query('INSERT INTO workflow_definitions (name, display_name, version, status, graph, created_by) VALUES ($1,$2,1,\'draft\',$3::jsonb,$4) RETURNING id', [d.name, d.display_name, JSON.stringify(d.graph), actorId]);
  return { definitionId: res.rows[0].id, status: 'draft', version: 1 };
}

// Maintenance utilities
export async function reconcilePendingTasks({ dryRun = false } = {}) {
  await ensureTables();
  const results = { deletedOrphans: 0, fixedAssignees: 0 };
  // Delete pending tasks whose instances are not active
  const delRes = await query(
    `DELETE FROM workflow_tasks wt
     USING workflow_instances wi
     WHERE wt.instance_id = wi.id AND wi.state <> 'active' AND wt.status = 'pending'`
  );
  results.deletedOrphans = delRes.rowCount || 0;

  // Find pending tasks with null/empty assignees
  const { rows } = await query(
    `SELECT wt.id, wt.instance_id, wt.node_id, wi.definition_id, wi.data
     FROM workflow_tasks wt
     JOIN workflow_instances wi ON wi.id = wt.instance_id
     WHERE wt.status = 'pending' AND (wt.assignees IS NULL OR array_length(wt.assignees, 1) = 0)`
  );

  for (const row of rows) {
    // Load graph and node
    const drow = await query('SELECT graph FROM workflow_definitions WHERE id = $1', [row.definition_id]);
    const graph = drow.rows[0]?.graph || { nodes: [], edges: [] };
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const n = nodes.find(x => x.id === row.node_id) || {};
    if (n.type !== 'approval') continue;
    const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId: null, data: row.data || {} });
    const assignees = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
    if (!dryRun) {
      await query('UPDATE workflow_tasks SET assignees = $1 WHERE id = $2', [assignees.length ? assignees : null, row.id]);
    }
    results.fixedAssignees += 1;
  }

  return results;
}

export async function rebuildPendingTasksForActiveInstances({ dryRun = false } = {}) {
  await ensureTables();
  const results = { instancesProcessed: 0, tasksRebuilt: 0 };
  const { rows } = await query('SELECT id, definition_id, data, current_node_id FROM workflow_instances WHERE state = $1', ['active']);
  for (const inst of rows) {
    results.instancesProcessed += 1;
    if (!inst.current_node_id) continue;
    const drow = await query('SELECT graph FROM workflow_definitions WHERE id = $1', [inst.definition_id]);
    const graph = drow.rows[0]?.graph || { nodes: [], edges: [] };
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const n = nodes.find(x => x.id === inst.current_node_id) || {};
    if (n.type !== 'approval') {
      // Remove any stray pending tasks if not an approval node
      if (!dryRun) {
        await query('DELETE FROM workflow_tasks WHERE instance_id = $1 AND status = $2', [inst.id, 'pending']);
      }
      continue;
    }
    // Rebuild: delete existing pending, then insert new with correct assignees
    if (!dryRun) {
      await query('DELETE FROM workflow_tasks WHERE instance_id = $1 AND status = $2', [inst.id, 'pending']);
    }
    const depId = await getDepartmentIdFromConfig({ cfg: n.config || {}, actorId: null, data: inst.data || {} });
    const assignees = await resolveAssignees({ cfg: n.config || {}, departmentId: depId });
    if (!dryRun) {
      await query('INSERT INTO workflow_tasks (instance_id, node_id, node_type, config, assignees) VALUES ($1,$2,$3,$4::jsonb,$5::int[])', [inst.id, n.id, n.type, JSON.stringify(n.config || {}), assignees.length ? assignees : null]);
    }
    results.tasksRebuilt += 1;
  }
  return results;
}


