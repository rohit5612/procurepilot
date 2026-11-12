import stockService from '../../services/inventory/stockService.js';

class StockController {
  async getOnHand(req, res) {
    try {
      const { itemId, warehouseId, binId } = req.query || {};
      const data = await stockService.getOnHand({ itemId, warehouseId, binId });
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getValuation(req, res) {
    try {
      const { itemId, warehouseId } = req.query || {};
      const data = await stockService.getValuation({ itemId, warehouseId });
      res.json({ success: true, data });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }

  async getTransactions(req, res) {
    try {
      const { itemId, warehouseId, binId, type, dateFrom, dateTo, page, limit } = req.query || {};
      const data = await stockService.getTransactions({ itemId, warehouseId, binId, type, dateFrom, dateTo, page, limit });
      res.json({ success: true, data: data.items, pagination: data.pagination });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
  }
}

export default new StockController();


