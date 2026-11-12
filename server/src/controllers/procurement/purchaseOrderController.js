import { validationResult } from 'express-validator';
import poService from '../../services/procurement/purchaseOrderService.js';
import { respondProcurementError } from '../../utils/procurementHttpErrors.js';

class PurchaseOrderController {
  async createDirect(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      const userId = req.user.id;
      const po = await poService.createDirect(req.body, userId);
      res.status(201).json({ success: true, message: 'PO created successfully', data: po });
    } catch (e) { console.error('Create PO error:', e); res.status(500).json({ success: false, message: e.message || 'Failed to create purchase order' }); }
  }

  async createFromRequisition(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      const userId = req.user.id;
      const { requisitionId } = req.params;
      const po = await poService.createFromRequisition(parseInt(requisitionId), req.body, userId);
      res.status(201).json({ success: true, message: 'PO created from requisition', data: po });
    } catch (e) { console.error('Create PO from PR error:', e); res.status(500).json({ success: false, message: e.message || 'Failed to create PO from requisition' }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const po = await poService.getById(parseInt(id), null, userId);
      res.json({ success: true, data: po });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const userId = req.user.id;
      const result = await poService.list(req.query || {}, userId);
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const userId = req.user.id;
      const rows = await poService.export(req.query || {}, userId);

      const headers = [
        'PO Number',
        'Title',
        'Status',
        'Receiving Phase',
        'Supplier',
        'Total Quantity',
        'Total Amount',
        'Created At',
        'Issued At'
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
          r.po_number,
          r.title,
          r.status,
          r.receiving_phase,
          r.supplier_name,
          r.total_quantity,
          r.total_amount,
          r.created_at ? new Date(r.created_at).toISOString() : '',
          r.issued_at ? new Date(r.issued_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `purchase-orders-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export PO error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export purchase orders' });
    }
  }

  async exportXlsx(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { buffer, fileName } = await poService.generateXlsx(parseInt(id), userId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      return res.status(200).send(buffer);
    } catch (e) {
      console.error('Export single PO XLSX error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export purchase order as XLSX' });
    }
  }

  async exportPdf(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { buffer, fileName } = await poService.generatePdf(parseInt(id), userId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      return res.status(200).send(buffer);
    } catch (e) {
      console.error('Export single PO PDF error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export purchase order as PDF' });
    }
  }

  async submit(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const po = await poService.submit(parseInt(id), userId);
      res.json({ success: true, message: 'PO submitted successfully', data: po });
    } catch (e) { return respondProcurementError(res, e, 'Failed to submit PO'); }
  }

  async approve(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { comment } = req.body || {};
      const po = await poService.approve(parseInt(id), userId, comment);
      res.json({ success: true, message: 'PO approved successfully', data: po });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async issue(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const po = await poService.issue(parseInt(id), userId);
      res.json({ success: true, message: 'PO issued successfully', data: po });
    } catch (e) { return respondProcurementError(res, e, 'Failed to issue PO'); }
  }

  async reject(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const { reason } = req.body || {};
      const po = await poService.reject(parseInt(id), userId, reason);
      res.json({ success: true, message: 'PO rejected successfully', data: po });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      const { id } = req.params;
      const userId = req.user.id;
      const po = await poService.update(parseInt(id), req.body || {}, userId);
      res.json({ success: true, message: 'PO updated successfully', data: po });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await poService.delete(parseInt(id), userId);
      res.json({ success: true, message: 'PO deleted successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const po = await poService.withdraw(parseInt(id), userId);
      res.json({ success: true, message: 'PO withdrawn successfully', data: po });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async cancelIssued(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body || {};
      const po = await poService.cancelIssued(parseInt(id, 10), req.user.id, reason);
      res.json({ success: true, message: 'PO cancelled', data: po });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async amendIssued(req, res) {
    try {
      const { id } = req.params;
      const { reason, ...payload } = req.body || {};
      const result = await poService.amendIssued(parseInt(id, 10), payload, req.user.id, reason);
      res.json({ success: true, message: 'PO amended', data: result });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new PurchaseOrderController();


