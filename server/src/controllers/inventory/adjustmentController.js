import adjustmentService from '../../services/inventory/adjustmentService.js';

class AdjustmentController {
  async create(req, res) {
    try {
      const userId = req.user.id;
      const adj = await adjustmentService.create(req.body, userId);
      res.status(201).json({ success: true, message: 'Adjustment created successfully', data: adj });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async post(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const adj = await adjustmentService.post(Number(id), userId);
      res.json({ success: true, message: 'Adjustment posted successfully', data: adj });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const adj = await adjustmentService.getById(Number(id));
      res.json({ success: true, data: adj });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await adjustmentService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const rows = await adjustmentService.export(req.query || {});

      const headers = [
        'Adjustment Number',
        'Status',
        'Warehouse',
        'Delta',
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
          r.adjustment_number,
          r.status,
          r.warehouse_name,
          r.sum_delta,
          r.created_at ? new Date(r.created_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `inventory-adjustments-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export adjustments error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export adjustments' });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const adj = await adjustmentService.update(Number(id), req.body || {}, userId);
      res.json({ success: true, message: 'Adjustment updated successfully', data: adj });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const adj = await adjustmentService.delete(Number(id), userId);
      res.json({ success: true, message: 'Adjustment deleted successfully', data: adj });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const adj = await adjustmentService.withdraw(Number(id), userId);
      res.json({ success: true, message: 'Adjustment withdrawn successfully', data: adj });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new AdjustmentController();



