import transferService from '../../services/inventory/transferService.js';

class TransferController {
  async create(req, res) {
    try {
      const userId = req.user.id;
      const tr = await transferService.create(req.body, userId);
      res.status(201).json({ success: true, message: 'Transfer created successfully', data: tr });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async post(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const tr = await transferService.post(Number(id), userId);
      res.json({ success: true, message: 'Transfer posted successfully', data: tr });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const transferId = parseInt(id, 10);
      if (!Number.isInteger(transferId)) {
        return res.status(400).json({ success: false, message: 'Invalid transfer id' });
      }
      const tr = await transferService.getById(transferId);
      res.json({ success: true, data: tr });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await transferService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const rows = await transferService.export(req.query || {});

      const headers = [
        'Challan Number',
        'Transfer Number',
        'Status',
        'From Warehouse',
        'To Warehouse',
        'Line Count',
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
          r.challan_number,
          r.transfer_number,
          r.status,
          r.from_warehouse_name,
          r.to_warehouse_name,
          r.line_count,
          r.created_at ? new Date(r.created_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `inventory-transfers-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export transfers error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export transfers' });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const tr = await transferService.update(Number(id), req.body || {}, userId);
      res.json({ success: true, message: 'Transfer updated successfully', data: tr });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await transferService.delete(Number(id), userId);
      res.json({ success: true, message: 'Transfer deleted successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const tr = await transferService.withdraw(Number(id), userId);
      res.json({ success: true, message: 'Transfer withdrawn successfully', data: tr });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new TransferController();



