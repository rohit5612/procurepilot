/**
 * Requisition Controller
 * Handles HTTP requests for requisition operations
 */

import requisitionService from '../../services/procurement/requisitionService.js';
import activityLogService from '../../services/system/activityLogService.js';
import itemService from '../../services/inventory/itemService.js';
import { validationResult } from 'express-validator';
import { writeAuditLog } from '../../services/system/auditLogWriter.js';
import { respondProcurementError } from '../../utils/procurementHttpErrors.js';

class RequisitionController {
  /**
   * Create a new requisition
   */
  async createRequisition(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const requisitionData = req.body;
      const userId = req.user.id;

      // Set requester_id to current user if not provided
      if (!requisitionData.requester_id) {
        requisitionData.requester_id = userId;
      }

      const requisition = await requisitionService.createRequisition(requisitionData, userId);

      // Audit & Activity logging
      try {
        // Audit log (data_created)
        await writeAuditLog({
          userId,
          action: 'data_created',
          resourceType: 'purchase_requisition',
          resourceId: requisition.id,
          oldValues: null,
          newValues: {
            number: requisition.requisition_number,
            total_lines: (requisition.lines || []).length
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestMethod: req.method,
          requestPath: req.originalUrl,
          requestQuery: req.query,
          description: 'Created purchase requisition',
          success: true,
          errorMessage: null,
          metadata: null
        });

        // Activity log
        await activityLogService.logActivity({
          user_id: userId,
          username: req.user.full_name,
          activity_type: 'create',
          module: 'procurement',
          feature: 'purchase_requisition',
          action: 'create_requisition',
          resource_type: 'purchase_requisition',
          resource_id: requisition.id,
          resource_name: requisition.requisition_number,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          request_method: req.method,
          request_path: req.originalUrl,
          description: 'Created PR',
          metadata: { total_lines: (requisition.lines || []).length }
        });
      } catch (e) {
        // ignore logging errors
      }

      res.status(201).json({
        success: true,
        message: 'Requisition created successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Create requisition error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create requisition'
      });
    }
  }

  /**
   * Get requisition by ID
   */
  async getRequisitionById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const requisition = await requisitionService.getRequisitionById(requisitionId, userId);

      res.status(200).json({
        success: true,
        message: 'Requisition retrieved successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Get requisition error:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'Requisition not found'
      });
    }
  }

  /**
   * Get all requisitions with filtering and pagination
   */
  async getRequisitions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        requester_id,
        department_id,
        search,
        circle_id,
        cluster_id,
        exclude_with_po
      } = req.query;

      const filters = {
        status,
        requester_id: requester_id ? parseInt(requester_id) : null,
        department_id: department_id ? parseInt(department_id) : null,
        search,
        circle_id: circle_id ? parseInt(circle_id) : null,
        cluster_id: cluster_id ? parseInt(cluster_id) : null,
        limit: parseInt(limit),
        page: parseInt(page),
        exclude_with_po: exclude_with_po === 'true'
      };

      const userId = req.user.id;
      const result = await requisitionService.getRequisitions(filters, userId);

      res.status(200).json({
        success: true,
        message: 'Requisitions retrieved successfully',
        data: {
          requisitions: result.requisitions,
          pagination: result.pagination
        }
      });
    } catch (error) {
      console.error('Get requisitions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve requisitions'
      });
    }
  }

  /**
   * Export requisitions as CSV (using same filters as list view)
   */
  async exportRequisitions(req, res) {
    try {
      const {
        status,
        requester_id,
        department_id,
        search,
        circle_id,
        cluster_id,
        exclude_with_po
      } = req.query;

      const filters = {
        status,
        requester_id: requester_id ? parseInt(requester_id) : null,
        department_id: department_id ? parseInt(department_id) : null,
        search,
        circle_id: circle_id ? parseInt(circle_id) : null,
        cluster_id: cluster_id ? parseInt(cluster_id) : null,
        exclude_with_po: exclude_with_po === 'true'
      };

      const userId = req.user.id;
      const rows = await requisitionService.exportRequisitions(filters, userId);

      // Build CSV
      const headers = [
        'Requisition Number',
        'Title',
        'Status',
        'Department',
        'Site',
        'Requester',
        'Needed By',
        'Total Quantity',
        'Total Amount',
        'Created At'
      ];

      const escapeCsv = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (/[",\n]/.test(str)) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const lines = [];
      lines.push(headers.map(escapeCsv).join(','));

      for (const r of rows) {
        lines.push([
          r.requisition_number,
          r.title,
          r.status,
          r.department_name,
          r.site_name,
          r.requester_name || r.requester_email,
          r.needed_by_date ? new Date(r.needed_by_date).toISOString().slice(0, 10) : '',
          r.total_quantity,
          r.total_amount,
          r.created_at ? new Date(r.created_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `purchase-requisitions-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (error) {
      console.error('Export requisitions error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to export requisitions'
      });
    }
  }

  /**
   * Update requisition
   */
  async updateRequisition(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user.id;

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const requisition = await requisitionService.updateRequisition(requisitionId, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Requisition updated successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Update requisition error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update requisition'
      });
    }
  }

  /**
   * Submit requisition for approval
   */
  async submitRequisition(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const requisition = await requisitionService.submitRequisition(requisitionId, userId);

      // Activity & Audit logging
      try {
        await writeAuditLog({
          userId,
          action: 'data_updated',
          resourceType: 'purchase_requisition',
          resourceId: requisitionId,
          oldValues: null,
          newValues: { submitted: true },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          requestMethod: req.method,
          requestPath: req.originalUrl,
          requestQuery: req.query,
          description: 'Submitted PR for approval',
          success: true,
          errorMessage: null,
          metadata: null
        });

        await activityLogService.logActivity({
          user_id: userId,
          username: req.user.full_name,
          activity_type: 'submit',
          module: 'procurement',
          feature: 'purchase_requisition',
          action: 'submit_for_approval',
          resource_type: 'purchase_requisition',
          resource_id: requisitionId,
          resource_name: requisition?.requisition_number || undefined,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          request_method: req.method,
          request_path: req.originalUrl,
          description: 'Submitted PR',
          metadata: null
        });
      } catch (e) {
        // ignore logging errors
      }

      res.status(200).json({
        success: true,
        message: 'Requisition submitted successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Submit requisition error:', error);
      return respondProcurementError(res, error, 'Failed to submit requisition');
    }
  }

  /**
   * Approve requisition
   */
  async approveRequisition(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const approvalData = req.body;
      const userId = req.user.id;

      // Only superadmin or level 1 admin can override approval directly via endpoint
      if (!req.user.isSuperuser && !(Number.isInteger(req.user.roleLevel) && req.user.roleLevel <= 1)) {
        return res.status(403).json({
          success: false,
          message: 'Only superadmin or admin (level 1) can override approvals. Use Approval Tasks to act on assigned steps.'
        });
      }

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const requisition = await requisitionService.approveRequisition(requisitionId, userId, approvalData);

      res.status(200).json({
        success: true,
        message: 'Requisition approved successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Approve requisition error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to approve requisition'
      });
    }
  }

  /**
   * Reject requisition
   */
  async rejectRequisition(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { rejection_reason } = req.body;
      const userId = req.user.id;

      // Only superadmin or level 1 admin can override rejection directly via endpoint
      if (!req.user.isSuperuser && !(Number.isInteger(req.user.roleLevel) && req.user.roleLevel <= 1)) {
        return res.status(403).json({
          success: false,
          message: 'Only superadmin or admin (level 1) can override approvals. Use Approval Tasks to act on assigned steps.'
        });
      }

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      if (!rejection_reason) {
        return res.status(400).json({
          success: false,
          message: 'Rejection reason is required'
        });
      }

      const requisition = await requisitionService.rejectRequisition(requisitionId, userId, rejection_reason);

      res.status(200).json({
        success: true,
        message: 'Requisition rejected successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Reject requisition error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to reject requisition'
      });
    }
  }

  /**
   * Delete requisition
   */
  async deleteRequisition(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const result = await requisitionService.deleteRequisition(requisitionId, userId);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result
      });
    } catch (error) {
      console.error('Delete requisition error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to delete requisition'
      });
    }
  }

  /**
   * Withdraw requisition (soft delete)
   */
  async withdrawRequisition(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid requisition ID'
        });
      }

      const requisition = await requisitionService.withdrawRequisition(requisitionId, userId);

      res.status(200).json({
        success: true,
        message: 'Requisition withdrawn successfully',
        data: requisition
      });
    } catch (error) {
      console.error('Withdraw requisition error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to withdraw requisition'
      });
    }
  }

  /**
   * Get requisition statistics
   */
  async getRequisitionStats(req, res) {
    try {
      const userId = req.user.id;
      const stats = await requisitionService.getRequisitionStats(userId);

      res.status(200).json({
        success: true,
        message: 'Requisition statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Get requisition stats error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to retrieve requisition statistics'
      });
    }
  }

  /**
   * Search items for requisition lines
   */
  async getReferenceUnitPrice(req, res) {
    try {
      const itemId = parseInt(req.params.itemId, 10);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ success: false, message: 'Invalid item ID' });
      }
      const quantity = Math.max(parseFloat(req.query.quantity) || 1, 0.01);
      const unit_price = await requisitionService.getReferenceUnitPrice(itemId, quantity);
      res.json({
        success: true,
        data: { item_id: itemId, quantity, unit_price, currency: 'INR' }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message || 'Failed to load reference price' });
    }
  }

  async searchItems(req, res) {
    try {
      const { search } = req.query;
      
      if (!search || search.length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Search term must be at least 2 characters long'
        });
      }

      // Use inventory item service to search items by code/name/brand/model
      const page = 1;
      const limit = 20;
      const result = await itemService.searchItemsByBrandModel({ search }, page, limit);

      // Map to minimal payload for requisition line selection
      const items = (result.items || []).map(i => ({
        id: i.id,
        item_code: i.item_code,
        name: i.name,
        description: i.description,
        brand: i.brand,
        model: i.model,
        unit_of_measure: i.unit_of_measure,
        estimated_price: i.estimated_price,
        standard_cost: i.standard_cost
      }));

      res.status(200).json({
        success: true,
        message: 'Items retrieved successfully',
        data: items
      });
    } catch (error) {
      console.error('Search items error:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to search items'
      });
    }
  }

  /**
   * Get vendor options for an approved requisition's lines
   */
  async getVendorOptions(req, res) {
    try {
      const { id } = req.params;
      const requisitionId = parseInt(id);
      if (isNaN(requisitionId)) {
        return res.status(400).json({ success: false, message: 'Invalid requisition ID' });
      }
      const options = await requisitionService.getVendorOptions(requisitionId);
      res.status(200).json({ success: true, data: options });
    } catch (error) {
      console.error('Get vendor options error:', error);
      res.status(500).json({ success: false, message: error.message || 'Failed to get vendor options' });
    }
  }
}

export default new RequisitionController();

