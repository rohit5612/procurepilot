import { aiConfig } from '../../config/aiConfig.js';
import { completeChat } from './llmClient.js';

const EXTRACTION_SYSTEM = `You extract procurement requirements from plain English.
Return ONLY valid JSON (no markdown) matching this schema:
{
  "item": string,
  "quantity": number | null,
  "maximum_budget": number | null,
  "currency": "INR",
  "delivery_deadline": string | null (ISO date YYYY-MM-DD if possible),
  "delivery_location": string | null,
  "procurement_category": "office" | "mro" | "steel" | "infra" | "electrical" | "ppe" | "other",
  "preferences": string[],
  "requires_human_approval": boolean,
  "confidence": "high" | "medium" | "low",
  "missing_fields": string[]
}
Use INR for Indian rupee amounts. Infer category from context (chairs/office supplies -> office).
Set requires_human_approval to true ONLY if the user explicitly asks for approval or sign-off; otherwise false.`;

/**
 * @param {string} text
 */
export async function extractRequirements(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'Request text is required', source: 'validation' };
  }

  try {
    const raw = await completeChat({
      system: EXTRACTION_SYSTEM,
      user: trimmed,
      temperature: aiConfig.extractionTemperature
    });
    const parsed = parseJsonFromLlm(raw);
    const normalized = normalizeExtraction(parsed, trimmed);
    const validation = validateExtraction(normalized);
    if (!validation.valid) {
      return {
        ok: false,
        error: validation.errors.join('; '),
        source: 'schema',
        raw_llm: parsed
      };
    }
    return { ok: true, data: normalized, source: 'llm' };
  } catch (err) {
    if (!aiConfig.fallbackHeuristics) {
      return { ok: false, error: err.message, source: 'llm' };
    }
    const heuristic = heuristicExtract(trimmed);
    const validation = validateExtraction(heuristic);
    if (!validation.valid) {
      return { ok: false, error: `${err.message}; fallback invalid: ${validation.errors.join('; ')}`, source: 'fallback' };
    }
    return {
      ok: true,
      data: heuristic,
      source: 'heuristic',
      llm_error: err.message
    };
  }
}

function parseJsonFromLlm(raw) {
  const stripped = String(raw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('LLM did not return JSON');
    return JSON.parse(match[0]);
  }
}

/**
 * @param {object} data
 * @param {string} originalText
 */
function pickField(data, ...keys) {
  for (const key of keys) {
    if (data == null) break;
    const v = data[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

function normalizeExtraction(data, originalText) {
  const category = String(
    pickField(data, 'procurement_category', 'procurementCategory', 'category') || 'other'
  ).toLowerCase();
  const allowed = ['office', 'mro', 'steel', 'infra', 'electrical', 'ppe', 'other'];
  const item =
    pickField(data, 'item', 'product', 'product_name', 'productName', 'description', 'title') ||
    guessItem(originalText);
  const qty = pickField(data, 'quantity', 'qty', 'count', 'units');
  const budget = pickField(
    data,
    'maximum_budget',
    'maximumBudget',
    'max_budget',
    'maxBudget',
    'budget',
    'budget_inr',
    'budgetInr'
  );
  const deadline = pickField(
    data,
    'delivery_deadline',
    'deliveryDeadline',
    'deadline',
    'need_by',
    'needBy',
    'delivery_date',
    'deliveryDate'
  );
  const location = pickField(
    data,
    'delivery_location',
    'deliveryLocation',
    'location',
    'ship_to',
    'shipTo',
    'destination'
  );

  const normalized = {
    item: String(item).trim(),
    quantity: toNumber(qty),
    maximum_budget: parseBudgetAmount(budget, originalText),
    currency: pickField(data, 'currency') || 'INR',
    delivery_deadline: normalizeDate(deadline) || parseRelativeDeliveryDate(originalText),
    delivery_location: location ? String(location).trim() : guessLocation(originalText),
    procurement_category: (() => {
      const base = allowed.includes(category) ? category : 'other';
      return base === 'other' ? inferCategory(originalText, base) : base;
    })(),
    preferences: Array.isArray(data.preferences) ? data.preferences.map(String) : [],
    requires_human_approval: inferRequiresHumanApproval(
      originalText,
      pickField(data, 'requires_human_approval', 'requiresHumanApproval')
    ),
    confidence: pickField(data, 'confidence') || 'medium',
    missing_fields: Array.isArray(data.missing_fields)
      ? data.missing_fields
      : Array.isArray(data.missingFields)
        ? data.missingFields
        : []
  };

  return backfillFromText(normalized, originalText);
}

function inferRequiresHumanApproval(text, explicit) {
  if (explicit === true || explicit === 'true' || explicit === 1) return true;
  if (explicit === false || explicit === 'false' || explicit === 0) return false;
  if (/\b(need|needs|require|requires)\s+(manager\s+|human\s+)?approval\b/i.test(text || '')) return true;
  if (/\b(sign[- ]?off|escalat(e|ion))\b/i.test(text || '')) return true;
  return false;
}

function backfillFromText(data, originalText) {
  const text = originalText || '';
  const out = { ...data };
  const weakItem =
    !out.item || out.item.length < 3 || /^procurement request$/i.test(String(out.item).trim());
  if (weakItem) out.item = guessItem(text);
  if (out.quantity == null) out.quantity = parseQuantityFromText(text);
  if (out.maximum_budget == null || out.maximum_budget <= 0) {
    out.maximum_budget = parseBudgetAmount(null, text);
  }
  if (!out.delivery_deadline) out.delivery_deadline = parseRelativeDeliveryDate(text);
  if (!out.delivery_location) out.delivery_location = guessLocation(text);
  return out;
}

function parseQuantityFromText(text) {
  if (!text) return null;
  const patterns = [
    /^(\d+)\s+/,
    /\b(\d+)\s+(?:ergonomic\s+)?(?:office\s+)?chairs?\b/i,
    /\b(\d+)\s+laptops?\b/i,
    /\b(\d+)\s+(?:nitrile\s+)?gloves?\b/i,
    /\b(\d+)\s+(?:safety\s+)?goggles?\b/i,
    /\b(\d+)\s+(?:units?|pairs?|boxes?|sets?|pcs?)\b/i,
    /\bqty(?:uantity)?\s*[:=]?\s*(\d+)/i
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

function validateExtraction(data) {
  const errors = [];
  if (!data.item || data.item.length < 2) errors.push('item is required');
  if (data.maximum_budget != null && data.maximum_budget < 0) errors.push('maximum_budget must be >= 0');
  if (data.quantity != null && data.quantity <= 0) errors.push('quantity must be positive');
  return { valid: errors.length === 0, errors };
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[,₹\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Parse budget from LLM value or fall back to scanning original text (lakhs, 80,000, etc.). */
function parseBudgetAmount(value, originalText) {
  const direct = toNumber(value);
  if (direct != null) return direct;
  const text = originalText || '';
  const lakh = text.match(/(\d+(?:\.\d+)?)\s*lakh/i);
  if (lakh) return Math.round(Number(lakh[1]) * 100000);
  const crore = text.match(/(\d+(?:\.\d+)?)\s*crore/i);
  if (crore) return Math.round(Number(crore[1]) * 10000000);
  const budgetLine =
    text.match(/\bmax(?:imum)?\b[^.\n]{0,32}?(?:₹|rs\.?|inr)\s*([\d,]+)/i) ||
    text.match(/\bbudget\b[^.\n]{0,20}?(?:₹|rs\.?|inr)\s*([\d,]+)/i) ||
    text.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i) ||
    text.match(/([\d,]+)\s*(?:₹|rs\.?|inr)\b/i);
  if (budgetLine) {
    const n = parseInrAmountString(budgetLine[1]);
    if (n != null) return n;
  }
  return null;
}

function parseInrAmountString(raw) {
  if (raw == null || raw === '') return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseRelativeDeliveryDate(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const now = new Date();

  const weeks = lower.match(/(?:in|within|delivery in)\s*(\d+)\s*weeks?/);
  if (weeks) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(weeks[1]) * 7);
    return d.toISOString().slice(0, 10);
  }
  const days = lower.match(/(?:in|within|delivery in)\s*(\d+)\s*days?/);
  if (days) {
    const d = new Date(now);
    d.setDate(d.getDate() + Number(days[1]));
    return d.toISOString().slice(0, 10);
  }
  if (/month\s*end|end of month/i.test(text)) {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return d.toISOString().slice(0, 10);
  }
  if (/next week/i.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }
  if (/friday/i.test(text)) {
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    const d = new Date(now);
    d.setDate(d.getDate() + daysUntilFriday);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function guessLocation(text) {
  const ship = text.match(/\bship\s+to\s+([A-Za-z][A-Za-z0-9\s.\-]{2,56})/i);
  if (ship) return ship[1].replace(/\.\s*$/, '').trim();
  const deliver = text.match(/\bdeliver(?:y)?\s+to\s+([A-Za-z][A-Za-z0-9\s.\-]{2,56})/i);
  if (deliver) return deliver[1].replace(/\.\s*$/, '').trim();
  const m = text.match(
    /\bfor\s+([A-Za-z][A-Za-z0-9\s,\-]{2,48}?)(?=\s+office\b|\s*,|\s+budget|\s+delivery|\s+max|\s+need|\s+in\s+\d|\s*$)/i
  );
  if (m) {
    const place = m[1].trim();
    if (!/^(managers?|team|staff|employees?)$/i.test(place)) return place;
  }
  return null;
}

function inferCategory(text, fallback) {
  const allowed = ['office', 'mro', 'steel', 'infra', 'electrical', 'ppe', 'other'];
  if (allowed.includes(fallback) && fallback !== 'other') return fallback;
  const lower = (text || '').toLowerCase();
  if (/chair|laptop|office|stationery|desk/i.test(lower)) return 'office';
  if (/glove|goggle|ppe|safety/i.test(lower)) return 'ppe';
  if (/mro|nitrile|consumable/i.test(lower)) return 'mro';
  if (/steel|rebar/i.test(lower)) return 'steel';
  if (/electrical|cable|wire/i.test(lower)) return 'electrical';
  return 'other';
}

function normalizeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function guessItem(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 'Procurement request';

  const leadingQty = trimmed.match(
    /^(\d+)\s+(.+?)(?:\s+for\b|\s*,\s*(?:budget|delivery|max|ship|need)\b|\s+budget\b|\s+delivery\b|\s+max\b|$)/i
  );
  if (leadingQty) {
    const phrase = leadingQty[2].replace(/\s+for\s+.+$/i, '').trim();
    if (phrase.length >= 3) {
      return phrase.charAt(0).toUpperCase() + phrase.slice(1);
    }
  }

  const afterNeed = trimmed.match(/\bneed\s+(\d+)\s+(.+?)(?:\s+for\b|,|\s+budget\b|$)/i);
  if (afterNeed) {
    const phrase = afterNeed[2].trim();
    if (phrase.length >= 3) return phrase.charAt(0).toUpperCase() + phrase.slice(1);
  }

  const buyMatch = trimmed.match(/\b(?:buy|purchase|order)\s+(.+?)(?:\s+for\b|,|\s+budget\b|$)/i);
  if (buyMatch && buyMatch[1].length >= 3) {
    return buyMatch[1].trim().charAt(0).toUpperCase() + buyMatch[1].trim().slice(1);
  }

  const afterColon = trimmed.match(/^[A-Za-z0-9\s/&]+\s*:\s*(.+)$/);
  if (afterColon) {
    const body = afterColon[1].split(/\s*,\s*ship\s+to\b/i)[0].trim();
    if (body.length >= 3) return body.charAt(0).toUpperCase() + body.slice(1);
  }

  const lower = trimmed.toLowerCase();
  if (lower.includes('chair')) return 'Ergonomic office chairs';
  if (lower.includes('laptop')) return 'Laptops';
  if (lower.includes('glove')) return 'Nitrile gloves';
  if (lower.includes('goggle')) return 'Safety goggles';
  return trimmed.split(/[,.]/)[0].trim().slice(0, 120) || 'Procurement request';
}

/** Rule-based fallback when the LLM is unavailable or returns unusable JSON */
function heuristicExtract(text) {
  const qtyMatch =
    text.match(/(\d+)\s+(?:ergonomic\s+)?(?:office\s+)?chairs/i) ||
    text.match(/\b(\d+)\s+(?:laptops?|units?|pairs?|boxes?)\b/i) ||
    text.match(/^(\d+)\s+/);

  return normalizeExtraction(
    {
      item: guessItem(text),
      quantity: qtyMatch ? Number(qtyMatch[1]) : null,
      maximum_budget: null,
      currency: 'INR',
      delivery_deadline: null,
      delivery_location: null,
      procurement_category: 'other',
      preferences: [],
      requires_human_approval: false,
      confidence: 'low',
      missing_fields: []
    },
    text
  );
}

/**
 * @param {object} request
 */
export async function explainComparison({ request, policyResult }) {
  const system = `You are a procurement advisor. Explain offer comparison results in 3-5 short bullets.
Never say a purchase is allowed if policy marked it ineligible. Be factual.`;
  const user = JSON.stringify({ request, policyResult }, null, 2);
  try {
    const text = await completeChat({ system, user, temperature: aiConfig.explainTemperature });
    return { ok: true, explanation: text };
  } catch (e) {
    return {
      ok: true,
      explanation: buildDeterministicExplanation(policyResult),
      llm_error: e.message
    };
  }
}

function buildDeterministicExplanation(policyResult) {
  const lines = [];
  const rec = policyResult.recommended_offer_id;
  if (rec) lines.push(`Recommended offer: ${rec} (lowest eligible price under policy).`);
  lines.push(`Eligible offers: ${policyResult.eligible_count ?? 0}.`);
  for (const o of policyResult.offers || []) {
    if (!o.eligible) {
      lines.push(`${o.supplier_name || o.offer_id}: rejected — ${o.violations?.[0]?.message || o.decision_code}.`);
    }
  }
  if (policyResult.approval?.required) {
    lines.push('Human approval is required before payment.');
  }
  return lines.join('\n');
}
