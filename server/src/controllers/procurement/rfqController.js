import rfqService from '../../services/procurement/rfqService.js';
import { respondProcurementError } from '../../utils/procurementHttpErrors.js';

class RfqController {
  async list(req, res) {
    try {
      const data = await rfqService.list(req.query || {});
      res.json({ success: true, data: data.items, pagination: data.pagination });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await rfqService.getById(parseInt(req.params.id, 10));
      res.json({ success: true, data });
    } catch (e) {
      res.status(404).json({ success: false, message: e.message });
    }
  }

  async createFromRequisition(req, res) {
    try {
      const data = await rfqService.createFromRequisition(
        parseInt(req.params.requisitionId, 10),
        req.user.id,
        req.body || {}
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      respondProcurementError(res, e, 'Failed to create RFQ');
    }
  }

  async invite(req, res) {
    try {
      const supplierIds = (req.body?.supplier_ids || []).map((id) => parseInt(id, 10));
      const data = await rfqService.inviteSuppliers(parseInt(req.params.id, 10), supplierIds, req.user.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async submitQuotation(req, res) {
    try {
      const data = await rfqService.upsertQuotation(
        parseInt(req.params.id, 10),
        parseInt(req.body.supplier_id, 10),
        req.user.id,
        req.body || {}
      );
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async compare(req, res) {
    try {
      const data = await rfqService.compareQuotations(parseInt(req.params.id, 10));
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async award(req, res) {
    try {
      const data = await rfqService.award(
        parseInt(req.params.id, 10),
        parseInt(req.body.quotation_id, 10),
        req.user.id
      );
      res.json({ success: true, data });
    } catch (e) {
      respondProcurementError(res, e, 'Failed to award RFQ');
    }
  }
}

export default new RfqController();
