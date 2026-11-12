import issueService from '../../services/inventory/issueService.js';

class IssueController {
  async create(req, res) {
    try {
      const userId = req.user.id;
      const iss = await issueService.create(req.body, userId);
      res.status(201).json({ success: true, message: 'Issue created successfully', data: iss });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async post(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const issueId = parseInt(id, 10);
      if (!Number.isInteger(issueId)) {
        return res.status(400).json({ success: false, message: 'Invalid issue id' });
      }
      const iss = await issueService.post(issueId, userId);
      res.json({ success: true, message: 'Issue posted successfully', data: iss });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const issueId = parseInt(id, 10);
      if (!Number.isInteger(issueId)) {
        return res.status(400).json({ success: false, message: 'Invalid issue id' });
      }
      const iss = await issueService.getById(issueId);
      res.json({ success: true, data: iss });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await issueService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async export(req, res) {
    try {
      const rows = await issueService.export(req.query || {});

      const headers = [
        'Challan Number',
        'Issue Number',
        'Status',
        'Site',
        'Destination Type',
        'Circle',
        'Cluster',
        'Total Issued Qty',
        'Total Returned Qty',
        'Return Status',
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
          r.issue_number,
          r.status,
          r.site_name,
          r.destination_type,
          r.circle_name,
          r.cluster_name,
          r.total_issued_qty,
          r.total_returned_qty,
          r.return_status,
          r.created_at ? new Date(r.created_at).toISOString() : ''
        ].map(escapeCsv).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `inventory-issues-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export issues error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export issues' });
    }
  }

  async exportXlsx(req, res) {
    try {
      const { id } = req.params;
      const issueId = parseInt(id, 10);
      if (!Number.isInteger(issueId)) {
        return res.status(400).json({ success: false, message: 'Invalid issue id' });
      }
      const { buffer, fileName } = await issueService.generateChallanXlsx(issueId);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName.replace(/"/g, '')}"`);
      return res.status(200).send(buffer);
    } catch (e) {
      console.error('Export DC XLSX error:', e);
      res.status(500).json({ success: false, message: e.message || 'Failed to export delivery challan as XLSX' });
    }
  }

  async update(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const iss = await issueService.update(parseInt(id, 10), req.body || {}, userId);
      res.json({ success: true, message: 'Issue updated successfully', data: iss });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async delete(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const issueId = parseInt(id, 10);
      if (!Number.isInteger(issueId)) {
        return res.status(400).json({ success: false, message: 'Invalid issue id' });
      }
      const result = await issueService.delete(issueId, userId);
      res.json({ success: true, message: 'Issue deleted successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async withdraw(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const issueId = parseInt(id, 10);
      if (!Number.isInteger(issueId)) {
        return res.status(400).json({ success: false, message: 'Invalid issue id' });
      }
      const result = await issueService.withdraw(issueId, userId);
      res.json({ success: true, message: 'Issue withdrawn successfully', data: result });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new IssueController();



