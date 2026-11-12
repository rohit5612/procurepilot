import { query } from '../../database/connection.js';
import { aiConfig } from '../../config/aiConfig.js';
import policyService from './policyService.js';
import { buildDemoOffers } from './demoOfferCatalog.js';
import { extractRequirements, explainComparison } from './requirementExtraction.js';
import { checkLlmHealth } from './llmClient.js';
import paypalService from './paypalService.js';
import requisitionService from '../procurement/requisitionService.js';
import { paypalConfig } from '../../config/aiConfig.js';
import channel3Service from './channel3Service.js';
import procurementPolicyService from '../procurement/procurementPolicyService.js';
import { transaction } from '../../database/connection.js';

let tablesReady = false;

async function ensurePurchaseRequestTables() {
  if (tablesReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status VARCHAR(40) NOT NULL DEFAULT 'draft',
      raw_text TEXT,
      extracted_json JSONB,
      confirmed_json JSONB,
      policy_result_json JSONB,
      ai_explanation TEXT,
      selected_offer_id VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_purchase_requests_user ON purchase_requests(user_id);
    ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS offers_json JSONB;
  `);
  tablesReady = true;
}

class AiBuyService {
  async getStatus() {
    const llm = await checkLlmHealth();
    return {
      llm,
      demo_offers: aiConfig.demoOffers,
      persist: aiConfig.persistAiBuy,
      provider: aiConfig.provider,
      paypal: paypalService.getPublicConfig(),
      channel3: {
        enabled: channel3Service.isEnabled(),
        demo_offers_fallback: aiConfig.demoOffers
      }
    };
  }

  async extract(userId, text) {
    const result = await extractRequirements(text);
    if (!result.ok) return result;

    if (aiConfig.persistAiBuy) {
      await ensurePurchaseRequestTables();
      await query(
        `INSERT INTO purchase_requests (user_id, status, raw_text, extracted_json)
         VALUES ($1, 'extracted', $2, $3::jsonb)`,
        [userId, text, JSON.stringify(result.data)]
      );
    }

    return result;
  }

  async compare(userId, { request, offers }) {
    const confirmed = request;
    if (!confirmed?.item) {
      return { ok: false, error: 'Confirmed request with item is required' };
    }

    let offerSource = 'client';
    let offerMeta = null;
    let offerList = Array.isArray(offers) && offers.length > 0 ? offers : [];

    if (!offerList.length && channel3Service.isEnabled()) {
      const c3 = await channel3Service.searchOffersForRequest(confirmed);
      if (c3.ok && c3.offers?.length) {
        offerList = c3.offers;
        offerSource = 'channel3';
        offerMeta = c3.meta;
      } else if (c3.error && !aiConfig.demoOffers) {
        return { ok: false, error: c3.error };
      }
    }

    if (!offerList.length && aiConfig.demoOffers) {
      offerList = buildDemoOffers(confirmed);
      offerSource = 'demo';
    }

    if (!offerList.length) {
      return { ok: false, error: 'No offers to compare (enable Channel3 or demo offers)' };
    }

    const policyResult = await policyService.evaluateForUser(userId, {
      request: {
        maximum_budget: confirmed.maximum_budget,
        delivery_deadline: confirmed.delivery_deadline,
        procurement_category: confirmed.procurement_category,
        currency: confirmed.currency,
        requires_human_approval: confirmed.requires_human_approval
      },
      offers: offerList.map((o) => ({
        id: o.id,
        supplier_name: o.supplier_name,
        price: o.price,
        delivery_date: o.delivery_date
      }))
    });

    const explanation = await explainComparison({ request: confirmed, policyResult });

    let purchaseRequestId = null;
    if (aiConfig.persistAiBuy) {
      await ensurePurchaseRequestTables();
      const ins = await query(
        `INSERT INTO purchase_requests (
          user_id, status, confirmed_json, policy_result_json, ai_explanation, selected_offer_id, offers_json
        ) VALUES ($1, 'compared', $2::jsonb, $3::jsonb, $4, $5, $6::jsonb)
        RETURNING id`,
        [
          userId,
          JSON.stringify(confirmed),
          JSON.stringify(policyResult),
          explanation.explanation,
          policyResult.recommended_offer_id,
          JSON.stringify(offerList)
        ]
      );
      purchaseRequestId = ins.rows[0]?.id;
    }

    return {
      ok: true,
      offers: offerList,
      policy: policyResult,
      explanation: explanation.explanation,
      explanation_source: explanation.llm_error ? 'deterministic' : 'llm',
      demo_data: offerSource === 'demo',
      offer_source: offerSource,
      offer_meta: offerMeta,
      purchase_request_id: purchaseRequestId
    };
  }

  async #loadPurchaseRequest(userId, purchaseRequestId) {
    await ensurePurchaseRequestTables();
    const { rows } = await query(
      `SELECT * FROM purchase_requests WHERE id = $1 AND user_id = $2`,
      [purchaseRequestId, userId]
    );
    if (!rows.length) throw new Error('Purchase request session not found');
    return rows[0];
  }

  #getOffer(row, offerId) {
    const raw = row.offers_json;
    const list = Array.isArray(raw) ? raw : [];
    const id = offerId || row.selected_offer_id;
    const offer = list.find((o) => String(o.id) === String(id));
    if (!offer) throw new Error('Selected offer not found on session');
    return offer;
  }

  #resolveOfferForPayment(row, offerId) {
    const offer = this.#getOffer(row, offerId);
    const policy = row.policy_result_json || {};
    const policyOffer = (policy.offers || []).find((p) => String(p.offer_id) === String(offer.id));
    if (policyOffer && policyOffer.eligible === false) {
      throw new Error('Selected offer failed policy checks');
    }
    if (policy.approval?.required) {
      throw new Error('Human approval is required before PayPal checkout');
    }
    return offer;
  }

  async createPayPalOrder(userId, { purchaseRequestId, offerId }) {
    if (!paypalConfig.enabled) throw new Error('PayPal checkout is not enabled');
    const row = await this.#loadPurchaseRequest(userId, purchaseRequestId);
    if (row.payment_status === 'paid') throw new Error('This purchase is already paid');
    const offer = this.#resolveOfferForPayment(row, offerId);
    const confirmed = row.confirmed_json || {};

    await query(
      `UPDATE purchase_requests SET selected_offer_id = $1, updated_at = NOW() WHERE id = $2`,
      [String(offer.id), purchaseRequestId]
    );

    const category = confirmed.procurement_category || 'other';
    try {
      await transaction(async (client) => {
        await procurementPolicyService.reserveForDocument(client, userId, {
          referenceType: 'ai_buy_purchase_request',
          referenceId: purchaseRequestId,
          amount: Number(offer.price),
          category,
          actorUserId: userId
        });
      });

      return await paypalService.createOrderForPurchase({
        userId,
        purchaseRequestId,
        description: confirmed.item || 'ProcurePilot purchase',
        amountInr: offer.price
      });
    } catch (err) {
      await transaction(async (client) => {
        await procurementPolicyService.releaseDocument(
          client,
          'ai_buy_purchase_request',
          purchaseRequestId,
          userId
        );
      }).catch(() => {});
      throw err;
    }
  }

  async onPayPalPaid({ userId, purchaseRequestId, actorUserId }) {
    if (!purchaseRequestId) return;
    await transaction(async (client) => {
      await procurementPolicyService.commitDocument(
        client,
        'ai_buy_purchase_request',
        purchaseRequestId,
        actorUserId || userId
      );
    });
  }

  async onPayPalCancelled({ userId, purchaseRequestId, actorUserId }) {
    if (!purchaseRequestId) return;
    await transaction(async (client) => {
      await procurementPolicyService.releaseDocument(
        client,
        'ai_buy_purchase_request',
        purchaseRequestId,
        actorUserId || userId
      );
    });
  }

  async submitAsRequisition(userId, { purchaseRequestId, offerId }) {
    const row = await this.#loadPurchaseRequest(userId, purchaseRequestId);
    const confirmed = row.confirmed_json || {};
    const offer = this.#getOffer(row, offerId || row.selected_offer_id);
    const policy = row.policy_result_json || {};
    const policyOffer = (policy.offers || []).find((p) => String(p.offer_id) === String(offer.id));
    if (policyOffer && policyOffer.eligible === false) {
      throw new Error('Selected offer failed policy checks');
    }
    const qty = Math.max(Number(confirmed.quantity) || 1, 1);
    const unitPrice = Number(offer.price) / qty;

    const deptRes = await query(
      `SELECT r.department_id FROM user_roles ur
       JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = $1 AND ur.is_active = true
       ORDER BY r.role_level ASC LIMIT 1`,
      [userId]
    );
    const departmentId = deptRes.rows[0]?.department_id;
    if (!departmentId) throw new Error('No department on user role — cannot create PR');

    const title = `AI Buy: ${confirmed.item}`.slice(0, 200);
    const description = [
      confirmed.delivery_location ? `Location: ${confirmed.delivery_location}` : null,
      `Supplier offer: ${offer.supplier_name}`,
      `Category: ${confirmed.procurement_category || 'other'}`,
      row.ai_explanation ? `AI note: ${String(row.ai_explanation).slice(0, 500)}` : null
    ]
      .filter(Boolean)
      .join('\n');

    const requisition = await requisitionService.createRequisition(
      {
        title,
        description,
        requester_id: userId,
        department_id: departmentId,
        needed_by_date: confirmed.delivery_deadline || null,
        lines: [
          {
            item_name: confirmed.item,
            quantity: qty,
            unit_of_measure: 'PCS',
            unit_price: unitPrice,
            needed_by_date: confirmed.delivery_deadline || null
          }
        ]
      },
      userId
    );

    await query(
      `UPDATE purchase_requests
       SET status = 'submitted_pr', updated_at = NOW()
       WHERE id = $1`,
      [purchaseRequestId]
    );

    return { requisition_id: requisition.id, requisition_number: requisition.requisition_number };
  }
}

export default new AiBuyService();
