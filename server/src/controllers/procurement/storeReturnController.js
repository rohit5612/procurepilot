import storeReturnService from '../../services/procurement/storeReturnService.js';

class StoreReturnController {
  async list(req, res) {
    try {
      const data = await storeReturnService.list();
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async getById(req, res) {
    try {
      const data = await storeReturnService.getById(parseInt(req.params.id, 10));
      res.json({ success: true, data });
    } catch (e) {
      res.status(404).json({ success: false, message: e.message });
    }
  }

  async createFromGrn(req, res) {
    try {
      const data = await storeReturnService.createFromGrn(
        parseInt(req.params.grnId, 10),
        req.user.id,
        req.body || {}
      );
      res.status(201).json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }

  async post(req, res) {
    try {
      const data = await storeReturnService.post(parseInt(req.params.id, 10), req.user.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new StoreReturnController();
