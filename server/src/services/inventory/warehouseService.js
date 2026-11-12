import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class WarehouseService {
  /**
   * Create a new warehouse
   */
  async createWarehouse(warehouseData, userId) {
    try {
      const result = await query(`
        INSERT INTO warehouses (
          warehouse_code, name, description, warehouse_type, address_line1, address_line2,
          city, state, country, postal_code, contact_person, phone, email,
          capacity_sqm, temperature_range, operating_hours, is_automated, notes,
          circle_id, cluster_id, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING *
      `, [
        warehouseData.warehouse_code,
        warehouseData.name,
        warehouseData.description,
        warehouseData.warehouse_type || 'STORAGE',
        warehouseData.address_line1,
        warehouseData.address_line2,
        warehouseData.city,
        warehouseData.state,
        warehouseData.country,
        warehouseData.postal_code,
        warehouseData.contact_person,
        warehouseData.phone,
        warehouseData.email,
        warehouseData.capacity_sqm || 0,
        warehouseData.temperature_range || { min: 0, max: 25 },
        warehouseData.operating_hours || { open: '08:00', close: '18:00' },
        warehouseData.is_automated || false,
        warehouseData.notes || null,
        warehouseData.circle_id || null,
        warehouseData.cluster_id || null,
        warehouseData.status || 'ACTIVE',
        userId
      ]);

      const warehouse = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.WAREHOUSE.CREATED',
        warehouse.id.toString(),
        'warehouse',
        {
          warehouse_id: warehouse.id,
          warehouse_code: warehouse.warehouse_code,
          name: warehouse.name
        },
        { created_by: userId }
      );

      return warehouse;
    } catch (error) {
      console.error('Failed to create warehouse:', error);
      throw new Error(`Failed to create warehouse: ${error.message}`);
    }
  }

  /**
   * Get warehouse by ID
   */
  async getWarehouseById(warehouseId) {
    try {
      const result = await query(`
        SELECT * FROM warehouses WHERE id = $1
      `, [warehouseId]);

      if (result.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Failed to get warehouse:', error);
      throw new Error(`Failed to get warehouse: ${error.message}`);
    }
  }

  /**
   * Get all warehouses with pagination and filters
   */
  async getWarehouses(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (warehouse_code ILIKE $${paramCount} OR name ILIKE $${paramCount} OR city ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.country) {
        paramCount++;
        whereClause += ` AND country = $${paramCount}`;
        params.push(filters.country);
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const result = await query(`
        SELECT *, COUNT(*) OVER() as total_count
        FROM warehouses
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `, params);

      return {
        warehouses: result.rows,
        total: result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0,
        page,
        limit,
        totalPages: Math.ceil((result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0) / limit)
      };
    } catch (error) {
      console.error('Failed to get warehouses:', error);
      throw new Error(`Failed to get warehouses: ${error.message}`);
    }
  }

  /**
   * Update warehouse
   */
  async updateWarehouse(warehouseId, updateData, userId) {
    try {
      const oldWarehouse = await this.getWarehouseById(warehouseId);

      const result = await query(`
        UPDATE warehouses SET
          warehouse_code = COALESCE($1, warehouse_code),
          name = COALESCE($2, name),
          description = COALESCE($3, description),
          warehouse_type = COALESCE($4, warehouse_type),
          status = COALESCE($5, status),
          address_line1 = COALESCE($6, address_line1),
          address_line2 = COALESCE($7, address_line2),
          city = COALESCE($8, city),
          state = COALESCE($9, state),
          country = COALESCE($10, country),
          postal_code = COALESCE($11, postal_code),
          contact_person = COALESCE($12, contact_person),
          phone = COALESCE($13, phone),
          email = COALESCE($14, email),
          capacity_sqm = COALESCE($15, capacity_sqm),
          temperature_range = COALESCE($16, temperature_range),
          operating_hours = COALESCE($17, operating_hours),
          is_automated = COALESCE($18, is_automated),
          notes = COALESCE($19, notes),
          circle_id = $20,
          cluster_id = $21,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $22
        RETURNING *
      `, [
        updateData.warehouse_code,
        updateData.name,
        updateData.description,
        updateData.warehouse_type,
        updateData.status,
        updateData.address_line1,
        updateData.address_line2,
        updateData.city,
        updateData.state,
        updateData.country,
        updateData.postal_code,
        updateData.contact_person,
        updateData.phone,
        updateData.email,
        updateData.capacity_sqm,
        updateData.temperature_range,
        updateData.operating_hours,
        updateData.is_automated,
        updateData.notes,
        updateData.circle_id !== undefined ? updateData.circle_id : null,
        updateData.cluster_id !== undefined ? updateData.cluster_id : null,
        warehouseId
      ]);

      if (result.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      const updatedWarehouse = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.WAREHOUSE.UPDATED',
        updatedWarehouse.id.toString(),
        'warehouse',
        {
          warehouse_id: updatedWarehouse.id,
          warehouse_code: updatedWarehouse.warehouse_code,
          name: updatedWarehouse.name,
          changes: this.getChanges(oldWarehouse, updatedWarehouse)
        },
        { updated_by: userId }
      );

      return updatedWarehouse;
    } catch (error) {
      console.error('Failed to update warehouse:', error);
      throw new Error(`Failed to update warehouse: ${error.message}`);
    }
  }

  /**
   * Toggle warehouse status (active/inactive)
   */
  async toggleWarehouseStatus(warehouseId, status, userId) {
    try {
      const oldWarehouse = await this.getWarehouseById(warehouseId);

      const result = await query(`
        UPDATE warehouses SET status = $1 WHERE id = $2 RETURNING *
      `, [status, warehouseId]);

      if (result.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      const updatedWarehouse = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.WAREHOUSE.STATUS_TOGGLED',
        updatedWarehouse.id.toString(),
        'warehouse',
        {
          warehouse_id: updatedWarehouse.id,
          warehouse_code: updatedWarehouse.warehouse_code,
          name: updatedWarehouse.name,
          old_status: oldWarehouse.status,
          new_status: updatedWarehouse.status
        },
        { updated_by: userId }
      );

      return updatedWarehouse;
    } catch (error) {
      console.error('Failed to toggle warehouse status:', error);
      throw new Error(`Failed to toggle warehouse status: ${error.message}`);
    }
  }

  /**
   * Delete warehouse (permanent delete)
   */
  async deleteWarehouse(warehouseId, userId) {
    try {
      // First get the warehouse details for the domain event
      const warehouse = await this.getWarehouseById(warehouseId);
      
      // Check if warehouse has any associated data that would prevent deletion
      const hasZones = await query(`
        SELECT COUNT(*) as count FROM warehouse_zones WHERE warehouse_id = $1
      `, [warehouseId]);
      
      if (parseInt(hasZones.rows[0].count) > 0) {
        throw new Error('Cannot delete warehouse that has zones. Please delete all zones first.');
      }

      const result = await query(`
        DELETE FROM warehouses WHERE id = $1 RETURNING *
      `, [warehouseId]);

      if (result.rows.length === 0) {
        throw new Error('Warehouse not found');
      }

      const deletedWarehouse = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.WAREHOUSE.DELETED',
        deletedWarehouse.id.toString(),
        'warehouse',
        {
          warehouse_id: deletedWarehouse.id,
          warehouse_code: deletedWarehouse.warehouse_code,
          name: deletedWarehouse.name
        },
        { deleted_by: userId }
      );

      return deletedWarehouse;
    } catch (error) {
      console.error('Failed to delete warehouse:', error);
      throw new Error(`Failed to delete warehouse: ${error.message}`);
    }
  }

  /**
   * Create warehouse zone
   */
  async createWarehouseZone(warehouseId, zoneData, userId) {
    try {
      const result = await query(`
        INSERT INTO warehouse_zones (
          warehouse_id, zone_code, name, description, zone_type, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        warehouseId,
        zoneData.zone_code,
        zoneData.name,
        zoneData.description,
        zoneData.zone_type || 'STORAGE',
        zoneData.is_active !== undefined ? zoneData.is_active : true
      ]);

      const zone = result.rows[0];

      // Publish domain event
      await domainEventService.publishEvent(
        'INVENTORY.WAREHOUSE_ZONE.CREATED',
        zone.id.toString(),
        'warehouse_zone',
        {
          zone_id: zone.id,
          warehouse_id: zone.warehouse_id,
          zone_code: zone.zone_code,
          name: zone.name
        },
        { created_by: userId }
      );

      return zone;
    } catch (error) {
      console.error('Failed to create warehouse zone:', error);
      throw new Error(`Failed to create warehouse zone: ${error.message}`);
    }
  }

  /**
   * Get warehouse zones
   */
  async getWarehouseZones(warehouseId, filters = {}) {
    try {
      let whereClause = 'WHERE wz.warehouse_id = $1';
      const params = [warehouseId];
      let paramCount = 1;

      if (filters.zone_type) {
        paramCount++;
        whereClause += ` AND wz.zone_type = $${paramCount}`;
        params.push(filters.zone_type);
      }

      if (filters.is_active !== undefined) {
        paramCount++;
        whereClause += ` AND wz.is_active = $${paramCount}`;
        params.push(filters.is_active);
      }

      const result = await query(`
        SELECT wz.*, w.warehouse_code, w.name as warehouse_name
        FROM warehouse_zones wz
        LEFT JOIN warehouses w ON wz.warehouse_id = w.id
        ${whereClause}
        ORDER BY wz.zone_code
      `, params);

      return result.rows;
    } catch (error) {
      console.error('Failed to get warehouse zones:', error);
      throw new Error(`Failed to get warehouse zones: ${error.message}`);
    }
  }

  /**
   * Create warehouse bin (DEPRECATED - Use binService instead)
   */
  async createWarehouseBin(zoneId, binData, userId) {
    throw new Error('Warehouse bin creation is deprecated. Use the main bin management system instead.');
  }

  /**
   * Get warehouse bins (DEPRECATED - Use binService.getBinsByWarehouse instead)
   */
  async getWarehouseBins(warehouseId, filters = {}) {
    throw new Error('Warehouse bin retrieval is deprecated. Use the main bin management system instead.');
  }

  /**
   * Get default receiving bin for warehouse (DEPRECATED - Use binService instead)
   */
  async getDefaultReceivingBin(warehouseId) {
    throw new Error('Default receiving bin retrieval is deprecated. Use the main bin management system instead.');
  }

  /**
   * Update warehouse bin (DEPRECATED - Use binService.updateBin instead)
   */
  async updateWarehouseBin(binId, updateData, userId) {
    throw new Error('Warehouse bin update is deprecated. Use the main bin management system instead.');
  }

  /**
   * Get warehouse bin by ID (DEPRECATED - Use binService.getBinById instead)
   */
  async getWarehouseBinById(binId) {
    throw new Error('Warehouse bin retrieval by ID is deprecated. Use the main bin management system instead.');
  }

  /**
   * Helper method to get changes between old and new warehouse data
   */
  getChanges(oldWarehouse, newWarehouse) {
    const changes = {};
    const fields = ['warehouse_code', 'name', 'description', 'address_line1', 'address_line2',
                   'city', 'state', 'country', 'postal_code', 'contact_person', 'phone', 'email', 'status'];

    fields.forEach(field => {
      if (oldWarehouse[field] !== newWarehouse[field]) {
        changes[field] = {
          old: oldWarehouse[field],
          new: newWarehouse[field]
        };
      }
    });

    return changes;
  }

  /**
   * Helper method to get changes between old and new bin data
   */
  getBinChanges(oldBin, newBin) {
    const changes = {};
    const fields = ['bin_code', 'name', 'description', 'bin_type', 'location_type', 
                   'dimensions', 'is_active', 'is_occupied'];

    fields.forEach(field => {
      if (oldBin[field] !== newBin[field]) {
        changes[field] = {
          old: oldBin[field],
          new: newBin[field]
        };
      }
    });

    return changes;
  }
}

export default new WarehouseService();
