import { channel3Config, paypalConfig } from '../../config/aiConfig.js';

const IN_STOCK = new Set(['InStock', 'LimitedAvailability', 'PreOrder']);

function usdToInr(usd) {
  const rate = Number(channel3Config.usdToInr) || Number(paypalConfig.inrToUsdRate) || 83;
  return Math.round(usd * rate);
}

function otherToInr(amount, currency) {
  const c = String(currency || 'USD').toUpperCase();
  if (c === 'INR') return Math.round(amount);
  if (c === 'USD') return usdToInr(amount);
  // Fallback: treat as USD-ish for demo comparisons
  return usdToInr(amount);
}

/**
 * @param {object} confirmed - AI Buy confirmed request
 * @returns {Promise<{ ok: boolean, offers?: object[], error?: string, meta?: object }>}
 */
async function searchOffersForRequest(confirmed) {
  if (!channel3Config.enabled) {
    return { ok: false, error: 'Channel3 disabled' };
  }
  if (!channel3Config.baseUrl || !channel3Config.apiKey) {
    return { ok: false, error: 'Channel3 not configured (base URL + API key)' };
  }

  const queryText = buildSearchQuery(confirmed);
  const maxBudgetInr = Number(confirmed.maximum_budget);
  const maxBudgetUsd =
    Number.isFinite(maxBudgetInr) && maxBudgetInr > 0
      ? maxBudgetInr / (Number(channel3Config.usdToInr) || Number(paypalConfig.inrToUsdRate) || 83)
      : null;

  const body = {
    query: queryText,
    limit: Math.min(30, Math.max(3, channel3Config.searchLimit || 12)),
    filters: {
      conditions: ['new'],
      availability: ['InStock', 'LimitedAvailability', 'PreOrder']
    }
  };

  if (maxBudgetUsd != null && maxBudgetUsd > 0) {
    body.filters.price = { max_price: Number(maxBudgetUsd.toFixed(2)) };
  }

  try {
    const res = await fetch(`${channel3Config.baseUrl}/v1/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': channel3Config.apiKey
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(channel3Config.timeoutMs)
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = json.detail || json.message || res.statusText;
      return { ok: false, error: `Channel3 search failed (${res.status}): ${String(detail).slice(0, 200)}` };
    }

    const products = Array.isArray(json.products) ? json.products : [];
    const offers = mapProductsToOffers(products, confirmed);

    return {
      ok: offers.length > 0,
      offers,
      error: offers.length === 0 ? 'No in-stock Channel3 offers matched your query' : undefined,
      meta: {
        query: queryText,
        product_count: products.length,
        offer_count: offers.length,
        disclaimer:
          'List prices from Channel3 retailers. Bulk pricing, delivery to your site, and business terms are not verified.'
      }
    };
  } catch (err) {
    return { ok: false, error: err.message || 'Channel3 request failed' };
  }
}

function buildSearchQuery(confirmed) {
  const parts = [confirmed.item].filter(Boolean);
  if (confirmed.quantity) parts.push(`qty ${confirmed.quantity}`);
  if (confirmed.delivery_location) parts.push(confirmed.delivery_location);
  return parts.join(' ').trim() || confirmed.item || 'office supplies';
}

function mapProductsToOffers(products, confirmed) {
  const qty = Math.max(Number(confirmed.quantity) || 1, 1);
  const deadline = confirmed.delivery_deadline || null;
  const offers = [];

  for (const product of products) {
    const productOffers = Array.isArray(product.offers) ? product.offers : [];
    const inStock = productOffers
      .filter((o) => o?.price?.price != null && IN_STOCK.has(o.availability))
      .sort((a, b) => Number(a.price.price) - Number(b.price.price));

    const best = inStock[0];
    if (!best) continue;

    const unitList = Number(best.price.price);
    const unitInr = otherToInr(unitList, best.price.currency);
    const lineTotal = unitInr * qty;

    offers.push({
      id: `c3-${product.id}-${best.domain}`,
      supplier_name: best.domain || product.brands?.[0]?.name || 'Retailer',
      price: lineTotal,
      unit_price_inr: unitInr,
      quantity: qty,
      delivery_date: deadline,
      delivery_verified: false,
      source: 'channel3',
      product_id: product.id,
      product_title: product.title,
      image_url: product.images?.[0]?.url || product.images?.[0] || null,
      purchase_url: best.url,
      list_currency: best.price.currency,
      list_unit_price: unitList,
      availability: best.availability,
      notes:
        'Channel3 listing — per-unit list price × qty. Delivery and bulk availability not verified by ProcurePilot.'
    });

    if (offers.length >= 8) break;
  }

  return offers;
}

async function checkHealth() {
  if (!channel3Config.enabled) {
    return { ok: false, message: 'disabled' };
  }
  if (!channel3Config.apiKey || !channel3Config.baseUrl) {
    return { ok: false, message: 'missing API key or base URL' };
  }
  const result = await searchOffersForRequest({
    item: 'office chair',
    quantity: 1,
    maximum_budget: 100000,
    procurement_category: 'office'
  });
  return {
    ok: result.ok,
    message: result.ok ? 'search ok' : result.error,
    offer_count: result.offers?.length || 0
  };
}

export default {
  searchOffersForRequest,
  checkHealth,
  isEnabled: () => channel3Config.enabled && Boolean(channel3Config.apiKey && channel3Config.baseUrl)
};
