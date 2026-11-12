import employeeService from '../../services/inventory/employeeService.js';

/**
 * Inventory Employee Master controller
 * Thin read-only wrapper over HR employee schema so Inventory can
 * use employees (especially technicians) without depending on the HR UI.
 */
const employeeController = {
  async list(req, res) {
    try {
      const { search, work_status, only_technicians } = req.query || {};
      const filters = {
        search: search || undefined,
        work_status: work_status || undefined,
        only_technicians: String(only_technicians).toLowerCase() === 'true'
      };

      const employees = await employeeService.listEmployees(filters);
      res.json({
        success: true,
        message: 'Employees retrieved successfully',
        data: employees
      });
    } catch (error) {
      console.error('Error listing employees:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve employees',
        error: error.message
      });
    }
  },

  async getById(req, res) {
    try {
      const { id } = req.params;
      const emp = await employeeService.getEmployeeById(Number(id));
      if (!emp) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      res.json({
        success: true,
        message: 'Employee retrieved successfully',
        data: emp
      });
    } catch (error) {
      console.error('Error getting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve employee',
        error: error.message
      });
    }
  }
};

export default employeeController;

