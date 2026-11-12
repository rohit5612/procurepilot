import { query } from '../../database/connection.js';

/**
 * Service for managing telecom circles
 */

export const circleService = {
  /**
   * Get all telecom circles
   */
  async getAll(filters = {}) {
    const { region, search } = filters;
    const params = [];
    let whereClause = '';
    
    const conditions = [];
    if (region) {
      params.push(region);
      conditions.push(`region = $${params.length}`);
    }
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    const result = await query(`
      SELECT 
        tc.id,
        tc.code,
        tc.name,
        tc.region,
        tc.created_at,
        tc.updated_at,
        COUNT(DISTINCT c.id) as cluster_count
      FROM telecom_circles tc
      LEFT JOIN clusters c ON c.circle_id = tc.id
      ${whereClause}
      GROUP BY tc.id, tc.code, tc.name, tc.region, tc.created_at, tc.updated_at
      ORDER BY tc.region, tc.code
    `, params);
    
    return result.rows;
  },

  /**
   * Get circle by ID
   */
  async getById(id) {
    const result = await query(`
      SELECT 
        tc.id,
        tc.code,
        tc.name,
        tc.region,
        tc.created_at,
        tc.updated_at,
        COUNT(DISTINCT c.id) as cluster_count
      FROM telecom_circles tc
      LEFT JOIN clusters c ON c.circle_id = tc.id
      WHERE tc.id = $1
      GROUP BY tc.id, tc.code, tc.name, tc.region, tc.created_at, tc.updated_at
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Circle not found');
    }
    
    return result.rows[0];
  },

  /**
   * Create a new circle
   */
  async create(circleData) {
    const { code, name, region } = circleData;
    
    const result = await query(`
      INSERT INTO telecom_circles (code, name, region)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [code, name, region]);
    
    return result.rows[0];
  },

  /**
   * Update circle
   */
  async update(id, circleData) {
    const { code, name, region } = circleData;
    
    const result = await query(`
      UPDATE telecom_circles
      SET 
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        region = COALESCE($3, region),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [code, name, region, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Circle not found');
    }
    
    return result.rows[0];
  },

  /**
   * Delete circle
   */
  async delete(id) {
    const result = await query(`
      DELETE FROM telecom_circles
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Circle not found');
    }
    
    return result.rows[0];
  },

  /**
   * Get regions list
   */
  async getRegions() {
    const result = await query(`
      SELECT DISTINCT region
      FROM telecom_circles
      ORDER BY region
    `);
    
    return result.rows.map(r => r.region);
  }
};

