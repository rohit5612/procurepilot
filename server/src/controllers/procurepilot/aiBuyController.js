import aiBuyService from '../../services/procurepilot/aiBuyService.js';
import { getSpendSnapshotForUser } from '../../services/procurepilot/spendAuditService.js';

class AiBuyController {
  async status(req, res) {
    try {
      const data = await aiBuyService.getStatus(req.user?.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async extract(req, res) {
    try {
      const { text } = req.body || {};
      const result = await aiBuyService.extract(req.user.id, text);
      if (!result.ok) {
        return res.status(422).json({ success: false, ...result });
      }
      res.json({ success: true, data: result.data, meta: { source: result.source, llm_error: result.llm_error } });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async previewChannel3(req, res) {
    try {
      const { request } = req.body || {};
      const result = await aiBuyService.previewChannel3(request);
      if (!result.ok && !result.offers?.length) {
        return res.status(422).json({ success: false, message: result.error, data: result });
      }
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async compare(req, res) {
    try {
      const { request, offers } = req.body || {};
      const result = await aiBuyService.compare(req.user.id, { request, offers });
      if (!result.ok) {
        return res.status(422).json({ success: false, message: result.error });
      }
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async activity(req, res) {
    try {
      const data = await getSpendSnapshotForUser(req.user.id);
      res.json({ success: true, data });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async submitRequisition(req, res) {
    try {
      const { purchase_request_id: purchaseRequestId, offer_id: offerId } = req.body || {};
      const data = await aiBuyService.submitAsRequisition(req.user.id, {
        purchaseRequestId: Number(purchaseRequestId),
        offerId
      });
      res.json({ success: true, data });
    } catch (e) {
      res.status(422).json({ success: false, message: e.message });
    }
  }
}

export default new AiBuyController();
