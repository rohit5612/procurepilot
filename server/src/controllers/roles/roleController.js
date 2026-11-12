import roleService from '../../services/roles/roleService.js';
import { validationResult } from 'express-validator';

class RoleController {
  /**
   * Get all roles
   */
  async getAllRoles(req, res) {
    try {
      const { departmentId } = req.query;
      const roles = await roleService.getAllRoles(req.user.id, departmentId ? parseInt(departmentId) : null);

      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: roles,
        count: roles.length
      });
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get role by ID
   */
  async getRoleById(req, res) {
    try {
      const { id } = req.params;
      const role = await roleService.getRoleById(parseInt(id), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Role retrieved successfully',
        data: role
      });
    } catch (error) {
      console.error('Get role error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create new role
   */
  async createRole(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const roleData = {
        name: req.body.name,
        displayName: req.body.displayName,
        description: req.body.description,
        departmentId: req.body.departmentId,
        roleLevel: req.body.roleLevel,
        permissions: req.body.permissions || []
      };

      const role = await roleService.createRole(roleData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: role
      });
    } catch (error) {
      console.error('Create role error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update role
   */
  async updateRole(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const roleData = {
        displayName: req.body.displayName,
        description: req.body.description,
        roleLevel: req.body.roleLevel,
        isActive: req.body.isActive,
        permissions: req.body.permissions
      };

      const role = await roleService.updateRole(parseInt(id), roleData, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: role
      });
    } catch (error) {
      console.error('Update role error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get available features for department
   */
  async getAvailableFeatures(req, res) {
    try {
      const { departmentId } = req.params;
      const features = await roleService.getAvailableFeatures(parseInt(departmentId));

      res.status(200).json({
        success: true,
        message: 'Available features retrieved successfully',
        data: features
      });
    } catch (error) {
      console.error('Get available features error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Duplicate role
   */
  async duplicateRole(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const newRoleData = {
        name: req.body.name,
        displayName: req.body.displayName,
        description: req.body.description
      };

      const role = await roleService.duplicateRole(parseInt(id), newRoleData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Role duplicated successfully',
        data: role
      });
    } catch (error) {
      console.error('Duplicate role error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get roles by department
   */
  async getRolesByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const roles = await roleService.getRolesByDepartment(parseInt(departmentId), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Department roles retrieved successfully',
        data: roles,
        count: roles.length
      });
    } catch (error) {
      console.error('Get department roles error:', error);
      const statusCode = error.message.includes('Access denied') ? 403 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Set default role for department
   */
  async setDefaultRole(req, res) {
    try {
      const { id } = req.params;
      const result = await roleService.setDefaultRole(parseInt(id), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Default role updated successfully',
        data: result
      });
    } catch (error) {
      console.error('Set default role error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete role
   */
  async deleteRole(req, res) {
    try {
      const { id } = req.params;
      const role = await roleService.deleteRole(parseInt(id), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully',
        data: {
          id: parseInt(id),
          name: role.name,
          display_name: role.display_name
        }
      });
    } catch (error) {
      console.error('Delete role error:', error);
      const statusCode = error.message.includes('not found') || error.message.includes('Access denied') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics(req, res) {
    try {
      const { user } = req;
      
      const stats = await roleService.getRoleStatistics(user.userId);
      
      res.json({
        success: true,
        message: 'Role statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Get role statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve role statistics',
        error: error.message
      });
    }
  }

  /**
   * Get available permissions
   */
  async getAvailablePermissions(req, res) {
    try {
      const permissions = await roleService.getAvailablePermissions();
      
      res.json({
        success: true,
        message: 'Available permissions retrieved successfully',
        data: permissions
      });
    } catch (error) {
      console.error('Get available permissions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve available permissions',
        error: error.message
      });
    }
  }
}

export default new RoleController();
