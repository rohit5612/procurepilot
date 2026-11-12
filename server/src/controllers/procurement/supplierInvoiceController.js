import supplierInvoiceService from '../../services/procurement/supplierInvoiceService.js';

class SupplierInvoiceController {
  async list(req, res) {
    try {
      const data = await supplierInvoiceService.list(req.query || {});
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await supplierInvoiceService.getById(parseInt(req.params.id, 10));
      res.json({ success: true, data });
    } catch (e) {
      res.status(404).json({ success: false, message: e.message });
    }
  }

  async capture(req, res) {
    try {
      const data = await supplierInvoiceService.capture(req.user.id, req.body || {});
      res.status(201).json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async rematch(req, res) {
    try {
      const data = await supplierInvoiceService.runMatch(parseInt(req.params.id, 10), req.user.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async handoff(req, res) {
    try {
      const data = await supplierInvoiceService.handoffToFinance(parseInt(req.params.id, 10), req.user.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new SupplierInvoiceController();
