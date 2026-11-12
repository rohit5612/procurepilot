import itemService from '../../services/inventory/itemService.js';
import { checkPermission } from '../../utils/permissionUtils.js';
import redisManager from '../../config/redis.js';
import { buildCacheKey, cacheGetOrSet } from '../../utils/cache.js';
import multer from 'multer';
import fs from 'fs/promises';

const ITEM_CACHE_PATTERN = 'api:v1:inventory:items:*';
const ITEM_LIST_TTL_SECONDS = 300;     // 5 minutes
const ITEM_LOOKUP_TTL_SECONDS = 900;   // 15 minutes
const ITEM_META_TTL_SECONDS = 3600;    // 1 hour

async function invalidateItemCaches() {
  try {
    await redisManager.delPattern(ITEM_CACHE_PATTERN);
  } catch (_) {}
}

class ItemController {
  /**
   * Create a new item
   */
  async createItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const itemData = req.body;
      const userId = req.user.id;

      const item = await itemService.createItem(itemData, userId);
      await invalidateItemCaches();

      res.status(201).json({
        success: true,
        message: 'Item created successfully',
        data: item
      });
    } catch (error) {
      console.error('Error creating item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemId } = req.params;

      const cacheKey = buildCacheKey('inventory:items:byId', { itemId });
      const { value: item } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_LOOKUP_TTL_SECONDS,
        () => itemService.getItemById(itemId)
      );

      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error('Error getting item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item by code
   */
  async getItemByCode(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemCode } = req.params;

      const cacheKey = buildCacheKey('inventory:items:byCode', { itemCode });
      const { value: item } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_LOOKUP_TTL_SECONDS,
        () => itemService.getItemByCode(itemCode)
      );

      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      console.error('Error getting item by code:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all items with pagination and filters
   */
  async getItems(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const { page: _p, limit: _l, ...filters } = req.query;

      const cacheKey = buildCacheKey('inventory:items:list', { filters, page, limit });
      const { value: result } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_LIST_TTL_SECONDS,
        () => itemService.getItems(filters, page, limit)
      );

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error getting items:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Export items as CSV (Stock Item Report format)
   */
  async exportItemsCsv(req, res) {
    try {
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const csv = await itemService.exportItemsCsv();
      const fileName = `item-master-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting items CSV:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update item
   */
  async updateItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemId } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const updatedItem = await itemService.updateItem(itemId, updateData, userId);
      await invalidateItemCaches();

      res.status(200).json({
        success: true,
        message: 'Item updated successfully',
        data: updatedItem
      });
    } catch (error) {
      console.error('Error updating item:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Toggle item status (active/inactive)
   */
  async toggleItemStatus(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemId } = req.params;
      const { is_active } = req.body;
      const userId = req.user.id;

      const updatedItem = await itemService.toggleItemStatus(itemId, is_active, userId);
      await invalidateItemCaches();

      res.status(200).json({
        success: true,
        message: `Item ${is_active ? 'activated' : 'deactivated'} successfully`,
        data: updatedItem
      });
    } catch (error) {
      console.error('Error toggling item status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Delete item (soft delete or hard delete)
   */
  async deleteItem(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'delete');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { itemId } = req.params;
      const { hardDelete = false } = req.query; // Get hardDelete from query params
      const userId = req.user.id;

      const deletedItem = await itemService.deleteItem(itemId, userId, hardDelete === 'true');
      await invalidateItemCaches();

      const deleteType = hardDelete === 'true' ? 'permanently deleted' : 'deactivated';
      res.status(200).json({
        success: true,
        message: `Item ${deleteType} successfully`,
        data: deletedItem
      });
    } catch (error) {
      console.error('Error deleting item:', error);
      
      // Check if it's a dependency error
      if (error.message.includes('Cannot delete item') && error.message.includes('referenced in')) {
        return res.status(409).json({
          success: false,
          error: error.message,
          canSoftDelete: true
        });
      }

      // Check if item not found
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      // General error
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Search items by brand/model
   */
  async searchItemsByBrandModel(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { brand, model, search } = req.query;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const cacheKey = buildCacheKey('inventory:items:searchBrandModel', { brand, model, search, page, limit });
      const { value: result } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_LIST_TTL_SECONDS,
        () => itemService.searchItemsByBrandModel({ brand, model, search }, page, limit)
      );

      res.status(200).json({
        success: true,
        data: result.items,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      console.error('Error searching items by brand/model:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all unique brands
   */
  async getAllBrands(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const cacheKey = buildCacheKey('inventory:items:brands', {});
      const { value: brands } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_META_TTL_SECONDS,
        () => itemService.getAllBrands()
      );

      res.status(200).json({
        success: true,
        data: brands
      });
    } catch (error) {
      console.error('Error getting brands:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get all models for a specific brand
   */
  async getModelsByBrand(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { brand } = req.params;

      const cacheKey = buildCacheKey('inventory:items:modelsByBrand', { brand });
      const { value: models } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_META_TTL_SECONDS,
        () => itemService.getModelsByBrand(brand)
      );

      res.status(200).json({
        success: true,
        data: models
      });
    } catch (error) {
      console.error('Error getting models by brand:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Bulk update brand/model information
   */
  async bulkUpdateBrandModel(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'update');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { items } = req.body; // Array of { itemId, brand, model, estimated_price, price_currency }
      const userId = req.user.id;

      const result = await itemService.bulkUpdateBrandModel(items, userId);
      await invalidateItemCaches();

      res.status(200).json({
        success: true,
        message: `Successfully updated ${result.updatedCount} items`,
        data: result
      });
    } catch (error) {
      console.error('Error bulk updating brand/model:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get item categories
   */
  async getItemCategories(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'read');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const cacheKey = buildCacheKey('inventory:items:categories', {});
      const { value: categories } = await cacheGetOrSet(
        redisManager,
        cacheKey,
        ITEM_META_TTL_SECONDS,
        () => itemService.getItemCategories()
      );

      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error getting item categories:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Create item category
   */
  async createItemCategory(req, res) {
    try {
      // Check permission
      const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'create');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const categoryData = req.body;
      const userId = req.user.id;

      const category = await itemService.createItemCategory(categoryData, userId);
      await invalidateItemCaches();

      res.status(201).json({
        success: true,
        message: 'Item category created successfully',
        data: category
      });
    } catch (error) {
      console.error('Error creating item category:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default new ItemController();

// Multer upload configuration for item CSV import
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/items';
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch((err) => cb(err, null));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `item_master_${uniqueSuffix}.csv`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed for item import'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

export const itemUpload = upload;

/**
 * Import items from CSV (Stock Item Report format).
 * Upserts items by company_code (preferred) or item_code.
 */
export const importItemsCsv = async (req, res) => {
  try {
    const hasPermission = checkPermission(req.user, 'inventory', 'item_master', 'update');
    if (!hasPermission) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required' });
    }

    const userId = req.user.id;
    const stats = await itemService.importItemsFromCsv(req.file.path, userId);
    await invalidateItemCaches();

    // Clean up uploaded file
    try {
      await fs.unlink(req.file.path);
    } catch (cleanupError) {
      console.warn('Failed to clean up uploaded item CSV file:', cleanupError);
    }

    return res.status(200).json({
      success: true,
      message: 'Item master CSV import completed',
      data: stats
    });
  } catch (error) {
    console.error('Error importing items CSV:', error);

    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupError) {
        console.warn('Failed to clean up uploaded item CSV file after error:', cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
