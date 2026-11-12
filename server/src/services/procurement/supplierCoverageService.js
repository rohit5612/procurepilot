import { query } from '../../database/connection.js';

/**
 * Service for managing supplier circle and cluster coverage
 */

export const supplierCoverageService = {
  /**
   * List all supplier coverage (both circle and cluster rows)
   */
  async listAll() {
    const result = await query(`
      SELECT 
        'circle'::text AS type,
        sc.id,
        sc.supplier_id,
        sc.circle_id,
        NULL::int AS cluster_id,
        sc.created_at,
        s.name AS supplier_name,
        tc.code AS circle_code,
        tc.name AS circle_name,
        tc.region AS circle_region,
        NULL::text AS cluster_code,
        NULL::text AS cluster_name
      FROM supplier_circles sc
      JOIN suppliers s ON s.id = sc.supplier_id
      JOIN telecom_circles tc ON tc.id = sc.circle_id
      UNION ALL
      SELECT 
        'cluster'::text AS type,
        scl.id,
        scl.supplier_id,
        c.circle_id,
        scl.cluster_id,
        scl.created_at,
        s.name AS supplier_name,
        tc.code AS circle_code,
        tc.name AS circle_name,
        tc.region AS circle_region,
        c.code AS cluster_code,
        c.name AS cluster_name
      FROM supplier_clusters scl
      JOIN suppliers s ON s.id = scl.supplier_id
      JOIN clusters c ON c.id = scl.cluster_id
      JOIN telecom_circles tc ON tc.id = c.circle_id
      ORDER BY supplier_id, circle_name, cluster_name NULLS FIRST
    `);
    return result.rows;
  },
  /**
   * Get supplier's circle coverage
   */
  async getSupplierCircles(supplierId) {
    const result = await query(`
      SELECT 
        sc.id,
        sc.supplier_id,
        sc.circle_id,
        sc.created_at,
        tc.code as circle_code,
        tc.name as circle_name,
        tc.region as circle_region
      FROM supplier_circles sc
      INNER JOIN telecom_circles tc ON tc.id = sc.circle_id
      WHERE sc.supplier_id = $1
      ORDER BY tc.region, tc.code
    `, [supplierId]);
    
    return result.rows;
  },

  /**
   * Get supplier's cluster coverage
   */
  async getSupplierClusters(supplierId) {
    const result = await query(`
      SELECT 
        sc.id,
        sc.supplier_id,
        sc.cluster_id,
        sc.created_at,
        c.code as cluster_code,
        c.name as cluster_name,
        c.circle_id,
        tc.code as circle_code,
        tc.name as circle_name,
        tc.region as circle_region
      FROM supplier_clusters sc
      INNER JOIN clusters c ON c.id = sc.cluster_id
      INNER JOIN telecom_circles tc ON tc.id = c.circle_id
      WHERE sc.supplier_id = $1
      ORDER BY tc.region, tc.code, c.code
    `, [supplierId]);
    
    return result.rows;
  },

  /**
   * Set supplier's circle coverage (replaces existing)
   */
  async setSupplierCircles(supplierId, circleIds) {
    // Start transaction
    const client = await query('BEGIN');
    
    try {
      // Delete existing
      await query('DELETE FROM supplier_circles WHERE supplier_id = $1', [supplierId]);
      
      // Insert new
      if (circleIds && circleIds.length > 0) {
        const values = circleIds.map((circleId, idx) => 
          `($1, $${idx + 2})`
        ).join(', ');
        
        await query(
          `INSERT INTO supplier_circles (supplier_id, circle_id) VALUES ${values}`,
          [supplierId, ...circleIds]
        );
      }
      
      await query('COMMIT');
      
      return this.getSupplierCircles(supplierId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  /**
   * Set supplier's cluster coverage (replaces existing)
   */
  async setSupplierClusters(supplierId, clusterIds) {
    // Start transaction
    const client = await query('BEGIN');
    
    try {
      // Delete existing
      await query('DELETE FROM supplier_clusters WHERE supplier_id = $1', [supplierId]);
      
      // Insert new
      if (clusterIds && clusterIds.length > 0) {
        const values = clusterIds.map((clusterId, idx) => 
          `($1, $${idx + 2})`
        ).join(', ');
        
        await query(
          `INSERT INTO supplier_clusters (supplier_id, cluster_id) VALUES ${values}`,
          [supplierId, ...clusterIds]
        );
      }
      
      await query('COMMIT');
      
      return this.getSupplierClusters(supplierId);
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  },

  /**
   * Add a circle to supplier coverage
   */
  async addSupplierCircle(supplierId, circleId) {
    const result = await query(`
      INSERT INTO supplier_circles (supplier_id, circle_id)
      VALUES ($1, $2)
      ON CONFLICT (supplier_id, circle_id) DO NOTHING
      RETURNING *
    `, [supplierId, circleId]);
    
    return result.rows[0];
  },

  /**
   * Remove a circle from supplier coverage
   */
  async removeSupplierCircle(supplierId, circleId) {
    const result = await query(`
      DELETE FROM supplier_circles
      WHERE supplier_id = $1 AND circle_id = $2
      RETURNING *
    `, [supplierId, circleId]);
    
    return result.rows[0];
  },

  /**
   * Add a cluster to supplier coverage
   */
  async addSupplierCluster(supplierId, clusterId) {
    const result = await query(`
      INSERT INTO supplier_clusters (supplier_id, cluster_id)
      VALUES ($1, $2)
      ON CONFLICT (supplier_id, cluster_id) DO NOTHING
      RETURNING *
    `, [supplierId, clusterId]);
    
    return result.rows[0];
  },

  /**
   * Remove a cluster from supplier coverage
   */
  async removeSupplierCluster(supplierId, clusterId) {
    const result = await query(`
      DELETE FROM supplier_clusters
      WHERE supplier_id = $1 AND cluster_id = $2
      RETURNING *
    `, [supplierId, clusterId]);
    
    return result.rows[0];
  }
};

