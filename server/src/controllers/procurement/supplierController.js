import supplierService from '../../services/procurement/supplierService.js';
import { checkPermission } from '../../utils/permissionUtils.js';
import redisManager from '../../config/redis.js';
import { buildCacheKey, cacheGetOrSet } from '../../utils/cache.js';

const SUPPLIER_CACHE_PATTERN = 'api:v1:procurement:suppliers:*';
const SUPPLIER_LIST_TTL_SECONDS = 300;   // 5 minutes
const SUPPLIER_LOOKUP_TTL_SECONDS = 900; // 15 minutes

async function invalidateSupplierCaches() {
  try {
    await redisManager.delPattern(SUPPLIER_CACHE_PATTERN);
  } catch (_) {}
}

class SupplierController {
  /**
   * Create a new supplier
   */
  async createSupplier(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const supplierData = req.body;
      // Require circle and cluster
      if (!supplierData.circle_id || !supplierData.cluster_id) {
        return res.status(400).json({ success: false, error: 'circle_id and cluster_id are required' });
      }
      const userId = req.user.id;

      const supplier = await supplierService.createSupplier(supplierData, userId);
      await invalidateSupplierCaches();

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(req, res) {
    try {
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const supplierId = req.params.supplierId;
      const updateData = req.body;
      if (!updateData.circle_id || !updateData.cluster_id) {
        return res.status(400).json({ success: false, error: 'circle_id and cluster_id are required' });
      }

      const supplier = await supplierService.updateSupplier(supplierId, updateData, req.user.id);
      await invalidateSupplierCaches();

      res.json({ success: true, message: 'Supplier updated successfully', data: supplier });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;

      const cacheKey = buildCacheKey('procurement:suppliers:byId', { supplierId });
      const { value: supplier } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        SUPPLIER_LOOKUP_TTL_SECONDS,
        () => supplierService.getSupplierById(supplierId)
      );

      res.status(200).json({
        success: true,
        data: supplier
      });
    } catch (error) {
      console.error('Error getting supplier:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get supplier by code
   */
  async getSupplierByCode(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierCode } = req.params;

      const cacheKey = buildCacheKey('procurement:suppliers:byCode', { supplierCode });
      const { value: supplier } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        SUPPLIER_LOOKUP_TTL_SECONDS,
        () => supplierService.getSupplierByCode(supplierCode)
      );

      res.status(200).json({
        success: true,
        data: supplier
      });
    } catch (error) {
      console.error('Error getting supplier by code:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all suppliers with pagination and filters
   */
  async getSuppliers(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { page: _p, limit: _l, ...filters } = req.query;

      const cacheKey = buildCacheKey('procurement:suppliers:list', { filters, page, limit });
      const { value: result } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        SUPPLIER_LIST_TTL_SECONDS,
        () => supplierService.getSuppliers(filters, page, limit)
      );

      res.status(200).json({
        success: true,
        data: result.suppliers,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting suppliers:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update supplier
   */
  async updateSupplier(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedSupplier = await supplierService.updateSupplier(supplierId, updateData, userId);
      await invalidateSupplierCaches();

      res.status(200).json({
        success: true,
        message: 'Supplier updated successfully',
        data: updatedSupplier
      });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Toggle supplier status (active/inactive)
   */
  async toggleSupplierStatus(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const updatedSupplier = await supplierService.toggleSupplierStatus(supplierId, status, userId);
      await invalidateSupplierCaches();

      res.status(200).json({
        success: true,
        message: `Supplier ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`,
        data: updatedSupplier
      });
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;
      const userId = req.user.id;

      const deletedSupplier = await supplierService.deleteSupplier(supplierId, userId);
      await invalidateSupplierCaches();

      res.status(200).json({
        success: true,
        message: 'Supplier deleted successfully',
        data: deletedSupplier
      });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get supplier contacts
   */
  async getSupplierContacts(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;

      const cacheKey = buildCacheKey('procurement:suppliers:contacts', { supplierId });
      const { value: contacts } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        SUPPLIER_LOOKUP_TTL_SECONDS,
        () => supplierService.getSupplierContacts(supplierId)
      );

      res.status(200).json({
        success: true,
        data: contacts
      });
    } catch (error) {
      console.error('Error getting supplier contacts:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Add supplier contact
   */
  async addSupplierContact(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { supplierId } = req.params;
      const contactData = req.body;

      const contact = await supplierService.addSupplierContact(supplierId, contactData);
      await invalidateSupplierCaches();

      res.status(201).json({
        success: true,
        message: 'Supplier contact added successfully',
        data: contact
      });
    } catch (error) {
      console.error('Error adding supplier contact:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update supplier contact
   */
  async updateSupplierContact(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { contactId } = req.params;
      const updateData = req.body;

      const updatedContact = await supplierService.updateSupplierContact(contactId, updateData);
      await invalidateSupplierCaches();

      res.status(200).json({
        success: true,
        message: 'Supplier contact updated successfully',
        data: updatedContact
      });
    } catch (error) {
      console.error('Error updating supplier contact:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete supplier contact
   */
  async deleteSupplierContact(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { contactId } = req.params;

      const deletedContact = await supplierService.deleteSupplierContact(contactId);
      await invalidateSupplierCaches();

      res.status(200).json({
        success: true,
        message: 'Supplier contact deleted successfully',
        data: deletedContact
      });
    } catch (error) {
      console.error('Error deleting supplier contact:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get applied price list for supplier
   */
  async getAppliedPriceList(req, res) {
    try {
      const hasPermissionRead = checkPermission(req.user, 'procurement', 'supplier_management', 'read');
      if (!hasPermissionRead) return res.status(403).json({ error: 'Insufficient permissions' });
      const { supplierId } = req.params;
      const cacheKey = buildCacheKey('procurement:suppliers:appliedPriceList', { supplierId });
      const { value: data } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        SUPPLIER_LOOKUP_TTL_SECONDS,
        () => supplierService.getAppliedPriceList(supplierId)
      );
      return res.status(200).json({ success: true, data });
    } catch (error) {
      console.error('Error getting applied price list:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * Set applied price list for supplier (only one active at a time)
   */
  async setAppliedPriceList(req, res) {
    try {
      const hasPermissionUpdate = checkPermission(req.user, 'procurement', 'supplier_management', 'update');
      if (!hasPermissionUpdate) return res.status(403).json({ error: 'Insufficient permissions' });
      const { supplierId } = req.params;
      const { price_list_id } = req.body;
      const userId = req.user.id;
      const data = await supplierService.setAppliedPriceList(supplierId, price_list_id, userId);
      await invalidateSupplierCaches();
      return res.status(200).json({ success: true, message: 'Applied price list set successfully', data });
    } catch (error) {
      console.error('Error setting applied price list:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }


}

export default new SupplierController();
