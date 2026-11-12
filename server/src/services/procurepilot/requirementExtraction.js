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
Use INR for Indian rupee amounts. Infer category from context (chairs/office supplies -> office).`;

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
  const stripped = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(stripped);
}

/**
 * @param {object} data
 * @param {string} originalText
 */
function normalizeExtraction(data, originalText) {
  const category = String(data.procurement_category || 'other').toLowerCase();
  const allowed = ['office', 'mro', 'steel', 'infra', 'electrical', 'ppe', 'other'];
  return {
    item: data.item || guessItem(originalText),
    quantity: toNumber(data.quantity),
    maximum_budget: toNumber(data.maximum_budget),
    currency: data.currency || 'INR',
    delivery_deadline: normalizeDate(data.delivery_deadline),
    delivery_location: data.delivery_location || null,
    procurement_category: allowed.includes(category) ? category : 'other',
    preferences: Array.isArray(data.preferences) ? data.preferences.map(String) : [],
    requires_human_approval: Boolean(data.requires_human_approval ?? true),
    confidence: data.confidence || 'medium',
    missing_fields: Array.isArray(data.missing_fields) ? data.missing_fields : []
  };
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
  const n = Number(String(v).replace(/[,₹]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function normalizeDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function guessItem(text) {
  const lower = text.toLowerCase();
  if (lower.includes('chair')) return 'Office chairs';
  if (lower.includes('laptop')) return 'Laptops';
  return 'Procurement request';
}

/** Rule-based fallback for demos when Ollama is down */
function heuristicExtract(text) {
  const budgetMatch = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i) || text.match(/([\d,]+)\s*(?:₹|rs)/i);
  const qtyMatch = text.match(/(\d+)\s+(?:ergonomic\s+)?(?:office\s+)?chairs/i) || text.match(/\b(\d+)\s+units?\b/i);
  const locMatch = text.match(/\b(?:for|to|at)\s+([A-Za-z][A-Za-z\s]{2,40})/i);

  let deadline = null;
  const friday = /friday/i.test(text);
  if (friday) {
    const now = new Date();
    const day = now.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    const d = new Date(now);
    d.setDate(d.getDate() + daysUntilFriday);
    deadline = d.toISOString().slice(0, 10);
  }

  const category = /chair|office|stationery|supplies/i.test(text) ? 'office' : 'other';

  return normalizeExtraction(
    {
      item: guessItem(text),
      quantity: qtyMatch ? Number(qtyMatch[1]) : null,
      maximum_budget: budgetMatch ? Number(budgetMatch[1].replace(/,/g, '')) : null,
      currency: 'INR',
      delivery_deadline: deadline,
      delivery_location: locMatch ? locMatch[1].trim() : null,
      procurement_category: category,
      preferences: [],
      requires_human_approval: true,
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
