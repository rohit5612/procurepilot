/**
 * Item Category Controller
 * Handles HTTP requests for item category operations
 */

import itemCategoryService from '../../services/inventory/itemCategoryService.js';
import { checkPermission } from '../../utils/permissionUtils.js';

class ItemCategoryController {
  /**
   * Get all categories with filtering and pagination
   */
  async getAllCategories(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { page = 1, limit = 20, search, category_type, status, parent_category_id } = req.query;
      const filters = { search, category_type, status, parent_category_id };

      const result = await itemCategoryService.getAllCategories(filters, parseInt(page), parseInt(limit));
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const category = await itemCategoryService.getCategoryById(id);
      
      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      if (error.message === 'Category not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create new category
   */
  async createCategory(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'create')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const categoryData = req.body;
      const category = await itemCategoryService.createCategory(categoryData, req.user.id);
      
      res.status(201).json({
        success: true,
        data: category,
        message: 'Category created successfully'
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update category
   */
  async updateCategory(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'update')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const categoryData = req.body;
      const category = await itemCategoryService.updateCategory(id, categoryData, req.user.id);
      
      res.json({
        success: true,
        data: category,
        message: 'Category updated successfully'
      });
    } catch (error) {
      if (error.message === 'Category not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'delete')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { id } = req.params;
      const category = await itemCategoryService.deleteCategory(id, req.user.id);
      
      res.json({
        success: true,
        data: category,
        message: 'Category deleted successfully'
      });
    } catch (error) {
      if (error.message === 'Category not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get category hierarchy
   */
  async getCategoryHierarchy(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const hierarchy = await itemCategoryService.getCategoryHierarchy();
      
      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get categories by type
   */
  async getCategoriesByType(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const { type } = req.params;
      const categories = await itemCategoryService.getCategoriesByType(type);
      
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get default category
   */
  async getDefaultCategory(req, res) {
    try {
      // Check permission
      if (!checkPermission(req.user, 'inventory', 'item_master', 'read')) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      const category = await itemCategoryService.getDefaultCategory();
      
      res.json({
        success: true,
        data: category
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

export default new ItemCategoryController();
