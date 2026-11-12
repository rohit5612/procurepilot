import stockCountService from '../../services/inventory/stockCountService.js';

class StockCountController {
  async create(req, res) {
    try {
      const userId = req.user.id;
      const sc = await stockCountService.create(req.body || {}, userId);
      res.status(201).json({ success: true, message: 'Stock count created', data: sc });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async post(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const sc = await stockCountService.post(Number(id), userId);
      res.json({ success: true, message: 'Stock count posted', data: sc });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async getById(req, res) {
    try {
      const { id } = req.params;
      const sc = await stockCountService.getById(Number(id));
      res.json({ success: true, data: sc });
    } catch (e) { res.status(404).json({ success: false, message: e.message }); }
  }

  async list(req, res) {
    try {
      const result = await stockCountService.list(req.query || {});
      res.json({ success: true, data: result.items, pagination: result.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async updateLine(req, res) {
    try {
      const userId = req.user.id;
      const { id, lineId } = req.params;
      const { counted_qty } = req.body || {};
      const line = await stockCountService.updateLine(Number(id), Number(lineId), Number(counted_qty || 0), userId);
      res.json({ success: true, message: 'Line updated', data: line });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }

  async updateHeader(req, res) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { conducted_by } = req.body || {};
      const sc = await stockCountService.updateHeader(Number(id), { conducted_by }, userId);
      res.json({ success: true, message: 'Stock count updated', data: sc });
    } catch (e) { res.status(400).json({ success: false, message: e.message }); }
  }
}

export default new StockCountController();



