import { query } from '../../database/connection.js';

/**
 * Temporary Employee master service for Inventory module.
 *
 * Backed by inventory_employee_master (simple master seeded from employeemaster.csv).
 * Later, when the full HR module is live, this can be replaced by hr_employee.
 */
const employeeService = {
  /**
   * List employees with basic filters.
   * Exposes only the fields needed for technician/site mapping.
   */
  async listEmployees(filters = {}) {
    const params = [];
    const where = [];
    let i = 1;

    if (filters.search) {
      where.push(
        `(employee_code ILIKE $${i} OR full_name ILIKE $${i} OR department ILIKE $${i} OR location ILIKE $${i})`
      );
      params.push(`%${filters.search}%`);
      i++;
    }

    if (filters.work_status) {
      where.push(`status = $${i}`);
      params.push(filters.work_status);
      i++;
    }

    if (filters.only_technicians) {
      where.push(`COALESCE(designation, '') ILIKE '%Technician%'`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const sql = `
      SELECT
        id,
        employee_code,
        full_name,
        designation,
        department     AS department_name,
        location       AS location_name,
        phone,
        email,
        status         AS work_status
      FROM inventory_employee_master
      ${whereSql}
      ORDER BY employee_code ASC
      LIMIT 500
    `;

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Get a single employee by id.
   */
  async getEmployeeById(id) {
    const sql = `
      SELECT
        id,
        employee_code,
        full_name,
        designation,
        department     AS department_name,
        location       AS location_name,
        phone,
        email,
        status         AS work_status
      FROM inventory_employee_master
      WHERE id = $1
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  }
};

export default employeeService;



