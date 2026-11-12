import reportService from '../../services/reports/reportService.js';
import reportPresetService from '../../services/reports/reportPresetService.js';

class ReportController {
  /**
   * Run a report for on-screen preview (JSON).
   * Body: { report_type, columns?, filters?, sort?, page?, limit? }
   */
  async run(req, res) {
    try {
      const result = await reportService.runReport(req.body || {}, req.user);
      res.json({ success: true, data: result.rows, pagination: result.pagination });
    } catch (e) {
      console.error('Run report error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to run report' });
    }
  }

  /**
   * Export a report as CSV.
   * Body: { report_type, columns?, filters?, sort?, limit? }
   */
  async export(req, res) {
    try {
      const rows = await reportService.exportCsv(req.body || {}, req.user);

      if (!Array.isArray(rows) || rows.length === 0) {
        // No rows – send an empty CSV with no body columns yet
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report-${new Date().toISOString().slice(0, 10)}.csv"`);
        return res.status(200).send('');
      }

      const headers = Object.keys(rows[0]);

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

      for (const row of rows) {
        lines.push(headers.map((h) => {
          const v = row[h];
          if (v instanceof Date) return escapeCsv(v.toISOString());
          return escapeCsv(v);
        }).join(','));
      }

      const csv = lines.join('\r\n');
      const fileName = `report-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.status(200).send(csv);
    } catch (e) {
      console.error('Export report error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to export report' });
    }
  }

  /**
   * List saved presets for the current user and report type.
   * Query: ?report_type=...
   */
  async listPresets(req, res) {
    try {
      const userId = req.user?.id;
      const { report_type } = req.query || {};
      const presets = await reportPresetService.listForUser({ userId, reportType: report_type });
      res.json({ success: true, data: presets });
    } catch (e) {
      console.error('List report presets error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to load presets' });
    }
  }

  /**
   * Save a preset for the current user.
   * Body: { report_type, name, columns, filters }
   */
  async savePreset(req, res) {
    try {
      const userId = req.user?.id;
      const { report_type, name, columns, filters } = req.body || {};

      if (!report_type) {
        return res.status(400).json({ success: false, message: 'report_type is required' });
      }

      // Validate columns/filters against report definition so presets stay compatible
      let safeColumns = Array.isArray(columns) ? columns.map((c) => String(c)) : [];
      const safeFilters = filters && typeof filters === 'object' ? filters : {};

      try {
        const def = reportService.getReportDefinition(report_type);
        const allowedCols = new Set(Object.keys(def.allowedColumns || {}));
        if (!safeColumns.length) {
          // If nothing specified, fall back to default columns
          safeColumns = Array.isArray(def.defaultColumns) ? def.defaultColumns.slice() : [];
        } else {
          safeColumns = safeColumns.filter((c) => allowedCols.has(c));
        }

        // Drop filters that are not defined for this report
        const allowedFilters = new Set(Object.keys(def.filterDefs || {}));
        for (const key of Object.keys(safeFilters)) {
          if (!allowedFilters.has(key)) {
            delete safeFilters[key];
          }
        }
      } catch (_) {
        // If definition lookup fails, fall back to raw values
      }

      const preset = await reportPresetService.createForUser({
        userId,
        reportType: report_type,
        name,
        columns: safeColumns,
        filters: safeFilters
      });

      res.status(201).json({ success: true, data: preset });
    } catch (e) {
      console.error('Save report preset error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to save preset' });
    }
  }

  /**
   * Delete a preset owned by the current user.
   * Params: :id
   */
  async deletePreset(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Preset id is required' });
      }

      const result = await reportPresetService.deleteForUser({ userId, presetId: id });
      if (!result.deleted) {
        return res.status(404).json({ success: false, message: 'Preset not found' });
      }

      res.json({ success: true, deleted: true });
    } catch (e) {
      console.error('Delete report preset error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to delete preset' });
    }
  }

  /**
   * Update a preset owned by the current user.
   * Params: :id
   * Body: { name?, columns?, filters? }
   */
  async updatePreset(req, res) {
    try {
      const userId = req.user?.id;
      const { id } = req.params || {};
      if (!id) {
        return res.status(400).json({ success: false, message: 'Preset id is required' });
      }

      const { name, columns, filters, report_type } = req.body || {};

      let safeColumns = columns;
      let safeFilters = filters;

      // If report_type provided, sanitize columns/filters against definition
      if (report_type && (columns !== undefined || filters !== undefined)) {
        try {
          const def = reportService.getReportDefinition(report_type);
          if (columns !== undefined) {
            const allowedCols = new Set(Object.keys(def.allowedColumns || {}));
            const inputCols = Array.isArray(columns) ? columns.map((c) => String(c)) : [];
            safeColumns = inputCols.filter((c) => allowedCols.has(c));
          }

          if (filters !== undefined) {
            const originalFilters = filters && typeof filters === 'object' ? filters : {};
            const allowedFilters = new Set(Object.keys(def.filterDefs || {}));
            const cleaned = {};
            for (const [key, value] of Object.entries(originalFilters)) {
              if (allowedFilters.has(key)) cleaned[key] = value;
            }
            safeFilters = cleaned;
          }
        } catch (_) {
          // fall back to raw values if definition lookup fails
        }
      }

      const updated = await reportPresetService.updateForUser({
        userId,
        presetId: id,
        name,
        columns: safeColumns,
        filters: safeFilters
      });

      res.json({ success: true, data: updated });
    } catch (e) {
      console.error('Update report preset error:', e);
      res.status(400).json({ success: false, message: e.message || 'Failed to update preset' });
    }
  }
}

export default new ReportController();


