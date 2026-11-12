import { validationResult } from 'express-validator';
import grnService from '../../services/procurement/goodsReceiptService.js';

class GoodsReceiptController {
  async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      const userId = req.user.id;
      const grn = await grnService.create(req.body, userId);
      res.status(201).json({ success: true, message: 'GRN created successfully', data: grn });
    } catch (e) { res.status(500).json({ success: false, message: e.message || 'Failed to create GRN' }); }
  }

  async submit(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const grn = await grnService.submit(parseInt(id), userId);
      res.json({ success: true, message: 'GRN submitted successfully', data: grn });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async post(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const grn = await grnService.post(parseInt(id), userId);
      res.json({ success: true, message: 'GRN posted successfully', data: grn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const grn = await grnService.getById(parseInt(id));
      res.json({ success: true, data: grn });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await grnService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const rows = await grnService.export(req.query || {});

      const headers = [
        'GRN Number',
        'Status',
        'PO Number',
        'PO Title',
        'Warehouse',
        'Supplier',
        'Created At',
        'Posted At'
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
          r.grn_number,
          r.status,
          r.po_number,
          r.po_title,
          r.warehouse_name,
          r.supplier_name,
          r.created_at ? new Date(r.created_at).toISOString() : '',
          r.posted_at ? new Date(r.posted_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `goods-receipts-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export GRN error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export GRNs' });
    }
  }

  async exportXlsx(req, res) {
    try {
      const { id } = req.params;
      const { buffer, fileName } = await grnService.generateXlsx(parseInt(id));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      return res.status(200).send(buffer);
    } catch (e) {
      console.error('Export single GRN XLSX error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export GRN as XLSX' });
    }
  }

  async update(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
      const { id } = req.params;
      const userId = req.user.id;
      const grn = await grnService.update(parseInt(id), req.body || {}, userId);
      res.json({ success: true, message: 'GRN updated successfully', data: grn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const result = await grnService.delete(parseInt(id), userId);
      res.json({ success: true, message: 'GRN deleted successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const grn = await grnService.withdraw(parseInt(id), userId);
      res.json({ success: true, message: 'GRN withdrawn successfully', data: grn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new GoodsReceiptController();



