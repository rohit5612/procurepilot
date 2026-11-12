/**
 * Item Category Service
 * Handles item category operations and hierarchical category management
 */

import { query } from '../../database/connection.js';
import domainEventService from '../system/domainEventService.js';

class ItemCategoryService {
  /**
   * Get all categories with optional filtering
   */
  async getAllCategories(filters = {}, page = 1, limit = 20) {
    try {
      let whereClause = 'WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (filters.category_type) {
        paramCount++;
        whereClause += ` AND ic.category_type = $${paramCount}`;
        params.push(filters.category_type);
      }

      if (filters.status) {
        paramCount++;
        whereClause += ` AND ic.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.search) {
        paramCount++;
        whereClause += ` AND (ic.category_code ILIKE $${paramCount} OR ic.name ILIKE $${paramCount})`;
        params.push(`%${filters.search}%`);
      }

      if (filters.parent_category_id !== undefined) {
        if (filters.parent_category_id === null) {
          whereClause += ` AND ic.parent_category_id IS NULL`;
        } else {
          paramCount++;
          whereClause += ` AND ic.parent_category_id = $${paramCount}`;
          params.push(filters.parent_category_id);
        }
      }

      const offset = (page - 1) * limit;
      paramCount++;
      params.push(limit);
      paramCount++;
      params.push(offset);

      const sqlQuery = `
        SELECT 
          ic.*,
          pc.category_code as parent_category_code,
          pc.name as parent_category_name
        FROM item_categories ic
        LEFT JOIN item_categories pc ON ic.parent_category_id = pc.id
        ${whereClause}
        ORDER BY ic.sort_order, ic.category_code
        LIMIT $${paramCount - 1} OFFSET $${paramCount}
      `;

      const result = await query(sqlQuery, params);
      
      // Get total count
      const countSqlQuery = `
        SELECT COUNT(*) as total
        FROM item_categories ic
        ${whereClause}
      `;
      const countResult = await query(countSqlQuery, params.slice(0, -2));
      
      return {
        data: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          totalPages: Math.ceil(countResult.rows[0].total / limit)
        }
      };
    } catch (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  /**
   * Get category by ID
   */
  async getCategoryById(categoryId) {
    try {
            const sqlQuery = `
        SELECT 
          ic.*,
          pc.category_code as parent_category_code,
          pc.name as parent_category_name
        FROM item_categories ic
        LEFT JOIN item_categories pc ON ic.parent_category_id = pc.id
        WHERE ic.id = $1
      `;

      const result = await query(sqlQuery, [categoryId]);
      
      if (result.rows.length === 0) {
        throw new Error('Category not found');
      }
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get category: ${error.message}`);
    }
  }

  /**
   * Create new category
   */
  async createCategory(categoryData, userId) {
    try {
      const sqlQuery = `
        INSERT INTO item_categories (
          category_code, name, description, parent_category_id,
          category_type, status, sort_order, is_default, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        categoryData.category_code,
        categoryData.name,
        categoryData.description,
        categoryData.parent_category_id || null,
        categoryData.category_type || 'PRODUCT',
        categoryData.status || 'ACTIVE',
        categoryData.sort_order || 0,
        categoryData.is_default || false,
        userId
      ];
      
      const result = await query(sqlQuery, values);
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.CATEGORY.CREATED', result.rows[0].id, 'category', {
        category_id: result.rows[0].id,
        category_code: categoryData.category_code,
        created_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to create category: ${error.message}`);
    }
  }

  /**
   * Update category
   */
  async updateCategory(categoryId, categoryData, userId) {
    try {
      const sqlQuery = `
        UPDATE item_categories SET
          category_code = $1,
          name = $2,
          description = $3,
          parent_category_id = $4,
          category_type = $5,
          status = $6,
          sort_order = $7,
          is_default = $8,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $9
        WHERE id = $10
        RETURNING *
      `;
      
      const values = [
        categoryData.category_code,
        categoryData.name,
        categoryData.description,
        categoryData.parent_category_id || null,
        categoryData.category_type,
        categoryData.status,
        categoryData.sort_order || 0,
        categoryData.is_default || false,
        userId,
        categoryId
      ];
      
      const result = await query(sqlQuery, values);
      
      if (result.rows.length === 0) {
        throw new Error('Category not found');
      }
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.CATEGORY.UPDATED', categoryId, 'category', {
        category_id: categoryId,
        category_code: categoryData.category_code,
        updated_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update category: ${error.message}`);
    }
  }

  /**
   * Delete category
   */
  async deleteCategory(categoryId, userId) {
    try {
      // Check if category has child categories
      const childQuery = 'SELECT COUNT(*) as count FROM item_categories WHERE parent_category_id = $1';
      const childResult = await query(childQuery, [categoryId]);
      
      if (parseInt(childResult.rows[0].count) > 0) {
        throw new Error('Cannot delete category with child categories');
      }
      
      // Check if category has items
      const itemQuery = 'SELECT COUNT(*) as count FROM items WHERE category_id = $1';
      const itemResult = await query(itemQuery, [categoryId]);
      
      if (parseInt(itemResult.rows[0].count) > 0) {
        throw new Error('Cannot delete category with associated items');
      }
      
      const sqlQuery = 'DELETE FROM item_categories WHERE id = $1 RETURNING *';
      const result = await query(sqlQuery, [categoryId]);
      
      if (result.rows.length === 0) {
        throw new Error('Category not found');
      }
      
      // Publish domain event
      await domainEventService.publishEvent('INVENTORY.CATEGORY.DELETED', categoryId, 'category', {
        category_id: categoryId,
        category_code: result.rows[0].category_code,
        deleted_by: userId
      });
      
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to delete category: ${error.message}`);
    }
  }

  /**
   * Get category hierarchy
   */
  async getCategoryHierarchy() {
    try {
      // First, get all categories
      const allCategoriesQuery = `
        SELECT 
          ic.*,
          pc.category_code as parent_category_code,
          pc.name as parent_category_name,
          (SELECT COUNT(*) FROM item_categories WHERE parent_category_id = ic.id) as children_count
        FROM item_categories ic
        LEFT JOIN item_categories pc ON ic.parent_category_id = pc.id
        ORDER BY ic.sort_order, ic.category_code
      `;
      
      const allCategoriesResult = await query(allCategoriesQuery);
      const allCategories = allCategoriesResult.rows;
      
      // Build hierarchy manually
      const buildHierarchy = (parentId = null) => {
        const children = allCategories.filter(cat => cat.parent_category_id === parentId);
        return children.map(child => ({
          ...child,
          children: buildHierarchy(child.id)
        }));
      };
      
      const hierarchy = buildHierarchy();
      return hierarchy;
    } catch (error) {
      throw new Error(`Failed to get category hierarchy: ${error.message}`);
    }
  }

  /**
   * Get categories by type
   */
  async getCategoriesByType(categoryType) {
    try {
      const sqlQuery = `
        SELECT 
          ic.*,
          pc.category_code as parent_category_code,
          pc.name as parent_category_name
        FROM item_categories ic
        LEFT JOIN item_categories pc ON ic.parent_category_id = pc.id
        WHERE ic.category_type = $1 AND ic.status = 'ACTIVE'
        ORDER BY ic.sort_order, ic.category_code
      `;
      
      const result = await query(sqlQuery, [categoryType]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get categories by type: ${error.message}`);
    }
  }

  /**
   * Get default category
   */
  async getDefaultCategory() {
    try {
      const sqlQuery = `
        SELECT * FROM item_categories 
        WHERE is_default = true AND status = 'ACTIVE'
        LIMIT 1
      `;
      
      const result = await query(sqlQuery);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to get default category: ${error.message}`);
    }
  }
}

export default new ItemCategoryService();
