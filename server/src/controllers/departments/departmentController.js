import departmentService from '../../services/departments/departmentService.js';
import { validationResult } from 'express-validator';

class DepartmentController {
  /**
   * Get all departments
   */
  async getAllDepartments(req, res) {
    try {
      const departments = await departmentService.getAllDepartments(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Departments retrieved successfully',
        data: departments,
        count: departments.length
      });
    } catch (error) {
      console.error('Get departments error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get department by ID
   */
  async getDepartmentById(req, res) {
    try {
      const { id } = req.params;
      const department = await departmentService.getDepartmentById(parseInt(id), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Department retrieved successfully',
        data: department
      });
    } catch (error) {
      console.error('Get department error:', error);
      const statusCode = error.message === 'Department not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Create new department
   */
  async createDepartment(req, res) {
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

      const departmentData = {
        name: req.body.name,
        displayName: req.body.displayName,
        description: req.body.description,
        departmentCode: req.body.departmentCode,
        parentDepartmentId: req.body.parentDepartmentId,
        moduleIds: req.body.moduleIds || []
      };

      const department = await departmentService.createDepartment(departmentData, req.user.id);

      res.status(201).json({
        success: true,
        message: 'Department created successfully',
        data: department
      });
    } catch (error) {
      console.error('Create department error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update department
   */
  async updateDepartment(req, res) {
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
      const departmentData = {
        displayName: req.body.displayName,
        description: req.body.description,
        departmentCode: req.body.departmentCode,
        parentDepartmentId: req.body.parentDepartmentId,
        isActive: req.body.isActive
      };

      const department = await departmentService.updateDepartment(parseInt(id), departmentData, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Department updated successfully',
        data: department
      });
    } catch (error) {
      console.error('Update department error:', error);
      const statusCode = error.message === 'Department not found' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Assign modules to department
   */
  async assignModules(req, res) {
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
      const { moduleIds } = req.body;

      const assignedModules = await departmentService.assignModules(parseInt(id), moduleIds, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Modules assigned successfully',
        data: {
          departmentId: parseInt(id),
          assignedModules: assignedModules.length,
          moduleIds: assignedModules
        }
      });
    } catch (error) {
      console.error('Assign modules error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get available modules
   */
  async getAvailableModules(req, res) {
    try {
      const modules = await departmentService.getAvailableModules();

      res.status(200).json({
        success: true,
        message: 'Available modules retrieved successfully',
        data: modules
      });
    } catch (error) {
      console.error('Get available modules error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Deactivate department
   */
  async deactivateDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await departmentService.deactivateDepartment(parseInt(id), req.user.id);

      res.status(200).json({
        success: true,
        message: 'Department deactivated successfully',
        data: department
      });
    } catch (error) {
      console.error('Deactivate department error:', error);
      const statusCode = error.message === 'Department not found' ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get department statistics
   */
  async getDepartmentStatistics(req, res) {
    try {
      const { user } = req;
      
      const stats = await departmentService.getDepartmentStatistics(user.userId);
      
      res.json({
        success: true,
        message: 'Department statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Get department statistics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve department statistics',
        error: error.message
      });
    }
  }
}

export default new DepartmentController();
