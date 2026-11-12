import { query } from '../../database/connection.js';

/**
 * Service for managing clusters within telecom circles
 */

export const clusterService = {
  /**
   * Get all clusters
   */
  async getAll(filters = {}) {
    const { circle_id, search } = filters;
    const params = [];
    let whereClause = '';
    
    const conditions = [];
    if (circle_id) {
      params.push(circle_id);
      conditions.push(`c.circle_id = $${params.length}`);
    }
    
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.name ILIKE $${params.length} OR c.code ILIKE $${params.length})`);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
    
    const result = await query(`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.circle_id,
        c.created_at,
        c.updated_at,
        tc.code as circle_code,
        tc.name as circle_name,
        tc.region as circle_region
      FROM clusters c
      INNER JOIN telecom_circles tc ON tc.id = c.circle_id
      ${whereClause}
      ORDER BY tc.region, tc.code, c.code
    `, params);
    
    return result.rows;
  },

  /**
   * Get cluster by ID
   */
  async getById(id) {
    const result = await query(`
      SELECT 
        c.id,
        c.code,
        c.name,
        c.circle_id,
        c.created_at,
        c.updated_at,
        tc.code as circle_code,
        tc.name as circle_name,
        tc.region as circle_region
      FROM clusters c
      INNER JOIN telecom_circles tc ON tc.id = c.circle_id
      WHERE c.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Cluster not found');
    }
    
    return result.rows[0];
  },

  /**
   * Create a new cluster
   */
  async create(clusterData) {
    const { code, name, circle_id } = clusterData;
    
    // Verify circle exists
    const circleCheck = await query(
      'SELECT id FROM telecom_circles WHERE id = $1',
      [circle_id]
    );
    
    if (circleCheck.rows.length === 0) {
      throw new Error('Invalid circle_id');
    }
    
    const result = await query(`
      INSERT INTO clusters (code, name, circle_id)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [code, name, circle_id]);
    
    return result.rows[0];
  },

  /**
   * Update cluster
   */
  async update(id, clusterData) {
    const { code, name, circle_id } = clusterData;
    
    // If updating circle_id, verify it exists
    if (circle_id) {
      const circleCheck = await query(
        'SELECT id FROM telecom_circles WHERE id = $1',
        [circle_id]
      );
      
      if (circleCheck.rows.length === 0) {
        throw new Error('Invalid circle_id');
      }
    }
    
    const result = await query(`
      UPDATE clusters
      SET 
        code = COALESCE($1, code),
        name = COALESCE($2, name),
        circle_id = COALESCE($3, circle_id),
        updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [code, name, circle_id, id]);
    
    if (result.rows.length === 0) {
      throw new Error('Cluster not found');
    }
    
    return result.rows[0];
  },

  /**
   * Delete cluster
   */
  async delete(id) {
    const result = await query(`
      DELETE FROM clusters
      WHERE id = $1
      RETURNING *
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Cluster not found');
    }
    
    return result.rows[0];
  },

  /**
   * Get clusters for a specific circle
   */
  async getByCircle(circleId) {
    const result = await query(`
      SELECT 
        id,
        code,
        name,
        circle_id,
        created_at,
        updated_at
      FROM clusters
      WHERE circle_id = $1
      ORDER BY code
    `, [circleId]);
    
    return result.rows;
  }
};

