import paypalService from '../../services/procurepilot/paypalService.js';
import aiBuyService from '../../services/procurepilot/aiBuyService.js';

class PayPalController {
  async config(req, res) {
    try {
      res.json({ success: true, data: paypalService.getPublicConfig() });
    } catch (e) {
      res.status(500).json({ success: false, message: e.message });
    }
  }

  async createOrder(req, res) {
    try {
      const { purchase_request_id: purchaseRequestId, offer_id: offerId } = req.body || {};
      const order = await aiBuyService.createPayPalOrder(req.user.id, {
        purchaseRequestId: Number(purchaseRequestId),
        offerId
      });
      res.json({ success: true, data: order });
    } catch (e) {
      res.status(422).json({ success: false, message: e.message });
    }
  }

  async captureOrder(req, res) {
    try {
      const { orderId } = req.body || {};
      if (!orderId) return res.status(400).json({ success: false, message: 'orderId is required' });
      const result = await paypalService.captureOrder({ userId: req.user.id, orderId });
      if (result.newlyPaid && result.purchaseRequestId) {
        await aiBuyService.onPayPalPaid({
          userId: result.userId || req.user.id,
          purchaseRequestId: result.purchaseRequestId,
          actorUserId: req.user.id
        });
      }
      res.json({ success: true, data: result });
    } catch (e) {
      res.status(422).json({ success: false, message: e.message });
    }
  }

  async webhook(req, res) {
    try {
      const rawBody = req.body;
      const verified = await paypalService.verifyWebhookSignature(req.headers, rawBody);
      if (!verified) {
        return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
      }
      const event = JSON.parse(rawBody.toString());
      const result = await paypalService.handleWebhookEvent(event);
      if (result.newlyPaid && result.purchaseRequestId && result.userId) {
        await aiBuyService.onPayPalPaid({
          userId: result.userId,
          purchaseRequestId: result.purchaseRequestId,
          actorUserId: result.userId
        });
      }
      if (
        (result.type === 'CHECKOUT.ORDER.CANCELLED' || result.type === 'PAYMENT.CAPTURE.DENIED') &&
        result.purchaseRequestId
      ) {
        await aiBuyService.onPayPalCancelled({
          userId: result.userId,
          purchaseRequestId: result.purchaseRequestId,
          actorUserId: result.userId
        });
      }
      res.status(200).json({ success: true, data: result });
    } catch (e) {
      console.error('PayPal webhook error:', e);
      res.status(400).json({ success: false, message: e.message });
    }
  }
}

export default new PayPalController();
