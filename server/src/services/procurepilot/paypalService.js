import { query } from '../../database/connection.js';
import { paypalConfig } from '../../config/aiConfig.js';

let tablesReady = false;

function apiBase() {
  return paypalConfig.mode === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function assertConfigured() {
  if (!paypalConfig.enabled) {
    throw new Error('PayPal is disabled. Set PAYPAL_ENABLED=true and configure client credentials.');
  }
  if (!paypalConfig.clientId || !paypalConfig.clientSecret) {
    throw new Error('PayPal client ID and secret are required.');
  }
}

async function ensurePaymentTables() {
  if (tablesReady) return;
  await query(`
    ALTER TABLE purchase_requests
      ADD COLUMN IF NOT EXISTS payment_status VARCHAR(32) DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS amount_inr NUMERIC(14,2),
      ADD COLUMN IF NOT EXISTS checkout_currency VARCHAR(3),
      ADD COLUMN IF NOT EXISTS checkout_amount NUMERIC(14,2);

    CREATE TABLE IF NOT EXISTS payment_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purchase_request_id INTEGER REFERENCES purchase_requests(id) ON DELETE SET NULL,
      paypal_order_id VARCHAR(80),
      paypal_capture_id VARCHAR(80),
      amount NUMERIC(14,2) NOT NULL,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      amount_inr NUMERIC(14,2),
      status VARCHAR(32) NOT NULL DEFAULT 'created',
      raw_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_payment_events_user ON payment_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_payment_events_pr ON payment_events(purchase_request_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_paypal_order ON payment_events(paypal_order_id)
      WHERE paypal_order_id IS NOT NULL;
  `);
  tablesReady = true;
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  assertConfigured();
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 30_000) return cachedToken;

  const auth = Buffer.from(`${paypalConfig.clientId}:${paypalConfig.clientSecret}`).toString('base64');
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PayPal auth failed (${res.status}): ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  cachedToken = json.access_token;
  tokenExpiresAt = now + (Number(json.expires_in) || 300) * 1000;
  return cachedToken;
}

function inrToCheckoutAmount(priceInr) {
  const inr = Number(priceInr);
  if (!Number.isFinite(inr) || inr <= 0) throw new Error('Invalid checkout amount');
  const currency = paypalConfig.checkoutCurrency || 'USD';
  if (currency === 'INR') {
    return { currency: 'INR', amount: inr.toFixed(2), amount_inr: inr };
  }
  const rate = Number(paypalConfig.inrToUsdRate) || 83;
  const usd = Math.max(inr / rate, 0.01);
  return { currency: 'USD', amount: usd.toFixed(2), amount_inr: inr };
}

class PayPalService {
  getPublicConfig() {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    return {
      enabled: paypalConfig.enabled,
      mode: paypalConfig.mode,
      clientId: paypalConfig.publicClientId || null,
      currency: paypalConfig.checkoutCurrency || 'USD',
      returnUrl: paypalConfig.returnUrl || `${frontendUrl}/buy?paypal=success`,
      cancelUrl: paypalConfig.cancelUrl || `${frontendUrl}/buy?paypal=cancelled`
    };
  }

  async createOrderForPurchase({ userId, purchaseRequestId, description, amountInr }) {
    await ensurePaymentTables();
    assertConfigured();

    const { currency, amount, amount_inr } = inrToCheckoutAmount(amountInr);
    const token = await getAccessToken();

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrl = paypalConfig.returnUrl || `${frontendUrl}/buy?paypal=success`;
    const cancelUrl = paypalConfig.cancelUrl || `${frontendUrl}/buy?paypal=cancelled`;

    const body = {
      intent: 'CAPTURE',
      application_context: {
        brand_name: 'ProcurePilot',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        return_url: returnUrl,
        cancel_url: cancelUrl
      },
      purchase_units: [
        {
          reference_id: `pp-pr-${purchaseRequestId}`,
          description: (description || 'ProcurePilot AI Buy').slice(0, 120),
          amount: {
            currency_code: currency,
            value: amount
          }
        }
      ]
    };

    const res = await fetch(`${apiBase()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || json.error_description || `PayPal create order failed (${res.status})`);
    }

    const orderId = json.id;
    await query(
      `INSERT INTO payment_events (
        user_id, purchase_request_id, paypal_order_id, amount, currency, amount_inr, status, raw_json
      ) VALUES ($1,$2,$3,$4,$5,$6,'created',$7::jsonb)`,
      [userId, purchaseRequestId, orderId, amount, currency, amount_inr, JSON.stringify(json)]
    );

    await query(
      `UPDATE purchase_requests
       SET payment_status = 'pending',
           amount_inr = $2,
           checkout_currency = $3,
           checkout_amount = $4,
           updated_at = NOW()
       WHERE id = $1 AND user_id = $5`,
      [purchaseRequestId, amount_inr, currency, amount, userId]
    );

    return { id: orderId, currency, amount, amount_inr };
  }

  async captureOrder({ userId, orderId }) {
    await ensurePaymentTables();
    assertConfigured();

    const token = await getAccessToken();
    const res = await fetch(`${apiBase()}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.message || `PayPal capture failed (${res.status})`);
    }

    const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id || null;
    const status = (json.status || '').toLowerCase() === 'completed' ? 'captured' : 'capture_failed';

    return this.#finalizeCapture({
      userId,
      orderId,
      captureId,
      payPalStatus: json.status,
      internalStatus: status,
      rawCapture: json
    });
  }

  async #finalizeCapture({ userId, orderId, captureId, payPalStatus, internalStatus, rawCapture }) {
    const status = internalStatus || (String(payPalStatus).toLowerCase() === 'completed' ? 'captured' : 'capture_failed');

    const eventRes = await query(
      `UPDATE payment_events
       SET status = $1,
           paypal_capture_id = COALESCE($2, paypal_capture_id),
           raw_json = COALESCE(raw_json, '{}'::jsonb) || $3::jsonb,
           updated_at = NOW()
       WHERE paypal_order_id = $4 AND ($5::int IS NULL OR user_id = $5)
       RETURNING purchase_request_id, user_id, status`,
      [status, captureId, JSON.stringify({ capture: rawCapture || {} }), orderId, userId ?? null]
    );

    if (eventRes.rowCount === 0) {
      return { orderId, captureId, status: payPalStatus, purchaseRequestId: null, userId: null, newlyPaid: false };
    }

    const purchaseRequestId = eventRes.rows[0]?.purchase_request_id;
    const ownerId = eventRes.rows[0]?.user_id || userId;

    let newlyPaid = false;
    if (purchaseRequestId && status === 'captured') {
      const prUpd = await query(
        `UPDATE purchase_requests
         SET payment_status = 'paid', status = 'paid', updated_at = NOW()
         WHERE id = $1 AND payment_status IS DISTINCT FROM 'paid'
         RETURNING id, user_id`,
        [purchaseRequestId]
      );
      newlyPaid = prUpd.rowCount > 0;
    }

    return {
      orderId,
      captureId,
      status: payPalStatus,
      purchaseRequestId,
      userId: ownerId,
      newlyPaid
    };
  }

  async verifyWebhookSignature(headers, rawBody) {
    if (!paypalConfig.webhookId) {
      if (paypalConfig.mode === 'sandbox') {
        console.warn('PayPal webhook: PAYPAL_WEBHOOK_ID not set — skipping verification (sandbox only)');
        return true;
      }
      throw new Error('PAYPAL_WEBHOOK_ID required for webhook verification');
    }

    const token = await getAccessToken();
    const event = JSON.parse(rawBody.toString());
    const body = {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: paypalConfig.webhookId,
      webhook_event: event
    };

    const res = await fetch(`${apiBase()}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Webhook verification request failed');
    return String(json.verification_status || '').toUpperCase() === 'SUCCESS';
  }

  async handleWebhookEvent(event) {
    await ensurePaymentTables();
    const type = event?.event_type;
    if (!type) return { handled: false };

    if (type === 'PAYMENT.CAPTURE.COMPLETED') {
      const capture = event.resource || {};
      const orderId =
        capture.supplementary_data?.related_ids?.order_id ||
        capture.custom_id ||
        null;
      const captureId = capture.id;
      const amount = capture.amount?.value;
      const existing = await query(
        `SELECT user_id, purchase_request_id FROM payment_events WHERE paypal_order_id = $1 LIMIT 1`,
        [orderId]
      );
      const row = existing.rows[0];
      const result = await this.#finalizeCapture({
        userId: row?.user_id,
        orderId,
        captureId,
        payPalStatus: 'COMPLETED',
        internalStatus: 'captured',
        rawCapture: { webhook: event, amount }
      });
      return { handled: true, type, ...result };
    }

    if (type === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = event.resource?.id;
      await query(
        `UPDATE payment_events SET status = 'approved', updated_at = NOW() WHERE paypal_order_id = $1`,
        [orderId]
      );
      return { handled: true, type, orderId };
    }

    if (type === 'CHECKOUT.ORDER.CANCELLED' || type === 'PAYMENT.CAPTURE.DENIED') {
      const orderId = event.resource?.id || event.resource?.supplementary_data?.related_ids?.order_id;
      const ev = await query(
        `SELECT user_id, purchase_request_id FROM payment_events WHERE paypal_order_id = $1 LIMIT 1`,
        [orderId]
      );
      await query(
        `UPDATE payment_events SET status = 'cancelled', updated_at = NOW() WHERE paypal_order_id = $1`,
        [orderId]
      );
      if (ev.rows[0]) {
        await query(
          `UPDATE purchase_requests SET payment_status = 'cancelled', updated_at = NOW()
           WHERE id = $1 AND payment_status = 'pending'`,
          [ev.rows[0].purchase_request_id]
        );
      }
      return { handled: true, type, orderId, purchaseRequestId: ev.rows[0]?.purchase_request_id, userId: ev.rows[0]?.user_id };
    }

    return { handled: false, type };
  }
}

export default new PayPalService();
