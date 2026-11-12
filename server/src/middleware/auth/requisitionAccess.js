import { query } from '../../database/connection.js';
import { PermissionService } from '../../services/permissions/permissionService.js';

/**
 * Requisition view access middleware
 * Allows access if:
 * - Superuser or role level <= 1
 * - Has procurement.purchase_requisition.read permission
 * - Is the requester of the requisition
 * - Belongs to the same department and has department data scope for PRs
 * - Is/was assigned to any task on the requisition's workflow instance
 */
export const canViewRequisition = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = req.user.id;

    // Superuser or Admin L1
    if (req.user.isSuperuser || (Number.isInteger(req.user.roleLevel) && req.user.roleLevel <= 1)) {
      return next();
    }

    const { id } = req.params;
    const requisitionId = Number(id);
    if (!Number.isInteger(requisitionId)) {
      return res.status(400).json({ success: false, message: 'Invalid requisition ID' });
    }

    // Basic requisition info
    const reqRes = await query(
      `SELECT id, requester_id, department_id, workflow_instance_id
       FROM requisitions
       WHERE id = $1`,
      [requisitionId]
    );
    if (reqRes.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Requisition not found' });
    }
    const reqRow = reqRes.rows[0];

    // Requester can always view
    if (reqRow.requester_id === userId) {
      return next();
    }

    // Explicit read permission
    const hasRead = await PermissionService.hasPermission(
      userId,
      'procurement',
      'purchase_requisition',
      'read'
    );
    if (hasRead) {
      return next();
    }

    // Department scope access
    const scope = await PermissionService.getDataScope(
      userId,
      'procurement',
      'purchase_requisition'
    );
    if (
      scope === 'department' &&
      Number.isInteger(reqRow.department_id)
    ) {
      const deptRes = await query(
        `SELECT r.department_id
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.is_active = true
         WHERE ur.user_id = $1 AND ur.is_active = true
         ORDER BY ur.created_at DESC
         LIMIT 1`,
        [userId]
      );
      const userDeptId = deptRes.rows[0]?.department_id;
      if (Number.isInteger(userDeptId) && userDeptId === reqRow.department_id) {
        return next();
      }
    }

    // Approvers on the workflow instance (current or past) can view
    if (Number.isInteger(reqRow.workflow_instance_id)) {
      const taskRes = await query(
        `SELECT 1
         FROM workflow_tasks
         WHERE instance_id = $1
           AND (
             (assignees IS NOT NULL AND array_length(assignees, 1) > 0 AND assignees @> ARRAY[$2::int])
             OR completed_by = $2
           )
         LIMIT 1`,
        [reqRow.workflow_instance_id, userId]
      );
      if (taskRes.rowCount > 0) {
        return next();
      }
    }

    return res.status(403).json({ success: false, message: 'Access denied to requisition' });
  } catch (error) {
    console.error('Requisition access check error:', error);
    return res.status(500).json({ success: false, message: 'Access check error' });
  }
};

export default canViewRequisition;


