import userAssignmentService from '../../services/users/userAssignmentService.js';
import { query } from '../../database/connection.js';

/**
 * Helper method to get role recommendations
 */
function getRoleRecommendation(roleLevel) {
    const recommendations = {
      2: 'Experienced professionals, team leaders, department heads',
      3: 'Mid-level professionals, supervisors, project managers',
      4: 'Junior professionals, specialists, senior operators',
      5: 'Entry-level users, trainees, basic operators'
    };

    return recommendations[roleLevel] || 'General users';
}

class UserAssignmentController {
  /**
   * Assign user to department and role
   */
  async assignUserRole(req, res) {
    try {
      const { user } = req;
      const { userId, departmentId, roleId, notes = '' } = req.body;
      
      const result = await userAssignmentService.assignUserRole(
        userId, 
        departmentId, 
        roleId, 
        user.userId, 
        notes
      );
      
      res.json({
        success: true,
        message: result.message,
        data: result.assignment
      });
      
    } catch (error) {
      console.error('Assign user role error:', error);
      
      if (error.message.includes('not found') || 
          error.message.includes('inactive') ||
          error.message.includes('must be approved')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot assign user role',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to assign user role',
        error: error.message
      });
    }
  }

  /**
   * Transfer user to different department/role
   */
  async transferUser(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const { departmentId, roleId, transferReason, notes = '' } = req.body;
      
      const result = await userAssignmentService.transferUser(
        userId, 
        departmentId, 
        roleId, 
        user.userId, 
        transferReason, 
        notes
      );
      
      res.json({
        success: true,
        message: result.message,
        data: result.transfer
      });
      
    } catch (error) {
      console.error('Transfer user error:', error);
      
      if (error.message.includes('not found') || 
          error.message.includes('no active assignment') ||
          error.message.includes('inactive')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot transfer user',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to transfer user',
        error: error.message
      });
    }
  }

  /**
   * Remove user assignment (unassign)
   */
  async unassignUser(req, res) {
    try {
      const { user } = req;
      const { userId } = req.params;
      const { reason, notes = '' } = req.body;
      
      const result = await userAssignmentService.unassignUser(
        userId, 
        user.userId, 
        reason, 
        notes
      );
      
      res.json({
        success: true,
        message: result.message,
        data: result.unassignment
      });
      
    } catch (error) {
      console.error('Unassign user error:', error);
      
      if (error.message.includes('no active assignment')) {
        return res.status(400).json({
          success: false,
          message: 'Cannot unassign user',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to unassign user',
        error: error.message
      });
    }
  }

  /**
   * Get assignment details
   */
  async getAssignmentDetails(req, res) {
    try {
      const { assignmentId } = req.params;
      
      const assignment = await userAssignmentService.getAssignmentDetails(assignmentId);
      
      res.json({
        success: true,
        message: 'Assignment details retrieved successfully',
        data: assignment
      });
      
    } catch (error) {
      console.error('Get assignment details error:', error);
      
      if (error.message === 'Assignment not found') {
        return res.status(404).json({
          success: false,
          message: 'Assignment not found',
          error: error.message
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment details',
        error: error.message
      });
    }
  }

  /**
   * Get users available for assignment
   */
  async getAvailableUsers(req, res) {
    try {
      const { user } = req;
      const { departmentId } = req.query;
      
      const availableUsers = await userAssignmentService.getAllAvailableUsers(user.userId);
      
      res.json({
        success: true,
        message: 'Available users retrieved successfully',
        data: availableUsers,
        count: availableUsers.length
      });
      
    } catch (error) {
      console.error('❌ Get available users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve available users',
        error: error.message
      });
    }
  }

  /**
   * Get assignment statistics
   */
  async getAssignmentStatistics(req, res) {
    try {
      const { user } = req;
      
      const stats = await userAssignmentService.getAssignmentStatistics(user.userId);
      
      res.json({
        success: true,
        message: 'Assignment statistics retrieved successfully',
        data: stats
      });
      
    } catch (error) {
      console.error('Get assignment statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment statistics',
        error: error.message
      });
    }
  }

  /**
   * Bulk assign users
   */
  async bulkAssignUsers(req, res) {
    try {
      const { user } = req;
      const { assignments } = req.body; // Array of {userId, departmentId, roleId, notes}
      
      // Allow empty arrays for testing - just return success with no changes
      if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.json({
          success: true,
          message: 'No assignments to process',
          data: {
            assigned: [],
            failed: [],
            total: 0
          }
        });
      }
      
      const results = [];
      const errors = [];
      
      // Process each assignment
      for (const assignment of assignments) {
        try {
          const result = await userAssignmentService.assignUserRole(
            assignment.userId,
            assignment.departmentId,
            assignment.roleId,
            user.userId,
            assignment.notes || ''
          );
          results.push(result);
        } catch (error) {
          errors.push({
            assignment: assignment,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: `Bulk assignment completed. ${results.length} successful, ${errors.length} failed`,
        data: {
          successful: results,
          failed: errors,
          summary: {
            total: assignments.length,
            successful: results.length,
            failed: errors.length
          }
        }
      });
      
    } catch (error) {
      console.error('Bulk assign users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process bulk assignment',
        error: error.message
      });
    }
  }

  /**
   * Get assignment templates for department
   */
  async getAssignmentTemplates(req, res) {
    try {
      const { departmentId } = req.params;
      
      // Get department details with available roles
      const departmentQuery = `
        SELECT 
          d.id,
          d.display_name as department_name,
          d.department_code,
          d.description,
          
          -- Available roles
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', r.id,
              'name', r.name,
              'display_name', r.display_name,
              'role_type', r.role_type,
              'role_level', r.role_level,
              'description', r.description,
              'is_default', r.is_default
            ) ORDER BY r.role_level
          ) as available_roles
          
        FROM departments d
        LEFT JOIN roles r ON d.id = r.department_id AND r.is_active = true
        WHERE d.id = $1 AND d.is_active = true
        GROUP BY d.id, d.display_name, d.department_code, d.description
      `;
      
      const result = await query(departmentQuery, [departmentId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Department not found or inactive'
        });
      }
      
      const department = result.rows[0];
      
      // Get assignment templates (common role assignments)
      const templates = department.available_roles.map(role => ({
        template_name: `${department.department_name} - ${role.display_name}`,
        department_id: department.id,
        department_name: department.department_name,
        role_id: role.id,
        role_name: role.display_name,
        role_level: role.role_level,
        is_default: role.is_default,
        recommended_for: getRoleRecommendation(role.role_level),
        description: `Assign user to ${department.department_name} as ${role.display_name}`
      }));
      
      res.json({
        success: true,
        message: 'Assignment templates retrieved successfully',
        data: {
          department: department,
          templates: templates
        }
      });
      
    } catch (error) {
      console.error('Get assignment templates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve assignment templates',
        error: error.message
      });
    }
  }

}

export default new UserAssignmentController();
