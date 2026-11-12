import srnService from '../../services/inventory/srnService.js';

class SrnController {
  async create(req, res) {
    try {
      const userId = req.user.id;
      const srn = await srnService.create(req.body, userId);
      res.status(201).json({ success: true, message: 'SRN created successfully', data: srn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async post(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const srnId = parseInt(id, 10);
      if (!Number.isInteger(srnId)) {
        return res.status(400).json({ success: false, message: 'Invalid SRN id' });
      }
      const srn = await srnService.post(srnId, userId);
      res.json({ success: true, message: 'SRN posted successfully', data: srn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const srnId = parseInt(id, 10);
      if (!Number.isInteger(srnId)) {
        return res.status(400).json({ success: false, message: 'Invalid SRN id' });
      }
      const srn = await srnService.getById(srnId);
      res.json({ success: true, data: srn });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await srnService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const rows = await srnService.export(req.query || {});

      const headers = [
        'SRN Number',
        'Status',
        'Reference Challan',
        'Circle Code',
        'Cluster Code',
        'Item Count',
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
          r.srn_number,
          r.status,
          r.reference_challan_number,
          r.reference_circle_code,
          r.reference_cluster_code,
          r.item_count,
          r.created_at ? new Date(r.created_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `store-return-notes-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export SRNs error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export SRNs' });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const srn = await srnService.update(parseInt(id, 10), req.body || {}, userId);
      res.json({ success: true, message: 'SRN updated successfully', data: srn });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const srnId = parseInt(id, 10);
      if (!Number.isInteger(srnId)) {
        return res.status(400).json({ success: false, message: 'Invalid SRN id' });
      }
      const result = await srnService.delete(srnId, userId);
      res.json({ success: true, message: 'SRN deleted successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const srnId = parseInt(id, 10);
      if (!Number.isInteger(srnId)) {
        return res.status(400).json({ success: false, message: 'Invalid SRN id' });
      }
      const result = await srnService.withdraw(srnId, userId);
      res.json({ success: true, message: 'SRN withdrawn successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new SrnController();


