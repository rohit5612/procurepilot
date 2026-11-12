import { query } from '../../database/connection.js';

const siteService = {
  // Get all sites
  async getSites() {
    const result = await query(`
      SELECT 
        id,
        site_code,
        name,
        description,
        site_type,
        status,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        circle_id,
        cluster_id,
        contact_person,
        email,
        phone,
        technician_employee_code,
        technician_employee_name,
        fse_employee_code,
        fse_employee_name,
        power_type,
        dg_make,
        dg_rating,
        solar_type,
        hub_site_status,
        aom,
        is_default,
        created_at,
        updated_at
      FROM sites 
      ORDER BY name ASC
    `);
    return result.rows;
  },

  // Get site by ID
  async getSiteById(id) {
    const result = await query(`
      SELECT 
        id,
        site_code,
        name,
        description,
        site_type,
        status,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        circle_id,
        cluster_id,
        contact_person,
        email,
        phone,
        technician_employee_code,
        technician_employee_name,
        fse_employee_code,
        fse_employee_name,
        power_type,
        dg_make,
        dg_rating,
        solar_type,
        hub_site_status,
        aom,
        is_default,
        created_at,
        updated_at
      FROM sites 
      WHERE id = $1
    `, [id]);
    return result.rows[0];
  },

  // Create new site
  async createSite(siteData, userId) {
    const {
      site_code,
      name,
      description,
      site_type = 'OFFICE',
      status = 'ACTIVE',
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      circle_id,
      cluster_id,
      contact_person,
      email,
      phone,
      hub_site_status,
      aom,
      technician_employee_code,
      technician_employee_name,
      fse_employee_code,
      fse_employee_name,
      power_type,
      dg_make,
      dg_rating,
      solar_type,
      is_default = false
    } = siteData;

    const result = await query(`
      INSERT INTO sites (
        site_code,
        name,
        description,
        site_type,
        status,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        country,
        circle_id,
        cluster_id,
        contact_person,
        email,
        phone,
        hub_site_status,
        aom,
        technician_employee_code,
        technician_employee_name,
        fse_employee_code,
        fse_employee_name,
        power_type,
        dg_make,
        dg_rating,
        solar_type,
        is_default,
        created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28
      )
      RETURNING *
    `, [
      site_code,
      name,
      description,
      site_type,
      status,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      circle_id || null,
      cluster_id || null,
      contact_person,
      email,
      phone,
      hub_site_status || null,
      aom || null,
      technician_employee_code || null,
      technician_employee_name || null,
      fse_employee_code || null,
      fse_employee_name || null,
      power_type || null,
      dg_make || null,
      dg_rating || null,
      solar_type || null,
      is_default,
      userId
    ]);

    return result.rows[0];
  },

  // Update site
  async updateSite(id, updateData, userId) {
    const {
      site_code,
      name,
      description,
      site_type,
      status,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      circle_id,
      cluster_id,
      contact_person,
      email,
      phone,
      hub_site_status,
      aom,
      technician_employee_code,
      technician_employee_name,
      fse_employee_code,
      fse_employee_name,
      power_type,
      dg_make,
      dg_rating,
      solar_type,
      is_default
    } = updateData;

    const result = await query(`
      UPDATE sites 
      SET 
        site_code = COALESCE($2, site_code),
        name = COALESCE($3, name),
        description = COALESCE($4, description),
        site_type = COALESCE($5, site_type),
        status = COALESCE($6, status),
        address_line1 = COALESCE($7, address_line1),
        address_line2 = COALESCE($8, address_line2),
        city = COALESCE($9, city),
        state = COALESCE($10, state),
        postal_code = COALESCE($11, postal_code),
        country = COALESCE($12, country),
        circle_id = COALESCE($13, circle_id),
        cluster_id = COALESCE($14, cluster_id),
        contact_person = COALESCE($15, contact_person),
        email = COALESCE($16, email),
        phone = COALESCE($17, phone),
        hub_site_status = COALESCE($18, hub_site_status),
        aom = COALESCE($19, aom),
        is_default = COALESCE($20, is_default),
        technician_employee_code = COALESCE($21, technician_employee_code),
        technician_employee_name = COALESCE($22, technician_employee_name),
        fse_employee_code = COALESCE($23, fse_employee_code),
        fse_employee_name = COALESCE($24, fse_employee_name),
        power_type = COALESCE($25, power_type),
        dg_make = COALESCE($26, dg_make),
        dg_rating = COALESCE($27, dg_rating),
        solar_type = COALESCE($28, solar_type),
        updated_by = $29,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `, [
      id,
      site_code,
      name,
      description,
      site_type,
      status,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      circle_id,
      cluster_id,
      contact_person,
      email,
      phone,
      hub_site_status,
      aom,
      is_default,
      technician_employee_code,
      technician_employee_name,
      fse_employee_code,
      fse_employee_name,
      power_type,
      dg_make,
      dg_rating,
      solar_type,
      userId
    ]);

    return result.rows[0];
  },

  // Delete site (hard delete by default, with optional soft delete)
  async deleteSite(id, userId, hardDelete = true) {
    let result;
    
    if (hardDelete) {
      // Hard delete - permanently remove from database
      result = await query(`
        DELETE FROM sites WHERE id = $1 RETURNING *
      `, [id]);
    } else {
      // Soft delete - set status to INACTIVE
      result = await query(`
        UPDATE sites 
        SET 
          status = 'INACTIVE',
          updated_by = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `, [id, userId]);
    }

    if (result.rows.length === 0) {
      throw new Error('Site not found');
    }

    return result.rows[0];
  }
};

export default siteService;
