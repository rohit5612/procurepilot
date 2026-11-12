import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function normalizeOllamaBaseUrl(raw) {
  let url = (raw || 'http://localhost:11434').replace(/\/$/, '');
  // llmClient calls `${base}/api/chat` — cloud docs use host https://ollama.com (not …/api).
  if (url.endsWith('/api')) url = url.slice(0, -4);
  return url;
}

export const aiConfig = {
  provider: (process.env.AI_PROVIDER || 'ollama').toLowerCase(),
  agentApiKey: process.env.AI_AGENT_API_KEY || '',
  ollamaBaseUrl: normalizeOllamaBaseUrl(process.env.OLLAMA_BASE_URL),
  ollamaApiKey: process.env.OLLAMA_API_KEY || process.env.AI_AGENT_API_KEY || '',
  ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  openaiCompatibleBaseUrl: (process.env.OPENAI_COMPATIBLE_BASE_URL || 'https://api.openai.com/v1').replace(
    /\/$/,
    ''
  ),
  model: process.env.AI_MODEL || 'gpt-4o-mini',
  timeoutMs: Number(process.env.AI_REQUEST_TIMEOUT_MS || 120000),
  extractionTemperature: Number(process.env.AI_EXTRACTION_TEMPERATURE || 0.1),
  explainTemperature: Number(process.env.AI_EXPLAIN_TEMPERATURE || 0.4),
  fallbackHeuristics: process.env.AI_FALLBACK_HEURISTICS !== 'false',
  demoOffers: process.env.PROCUREPILOT_DEMO_OFFERS !== 'false',
  persistAiBuy: process.env.PROCUREPILOT_PERSIST_AI_BUY !== 'false'
};

export const paypalConfig = {
  enabled: process.env.PAYPAL_ENABLED === 'true',
  mode: process.env.PAYPAL_MODE || 'sandbox',
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  publicClientId: process.env.PAYPAL_PUBLIC_CLIENT_ID || process.env.PAYPAL_CLIENT_ID || '',
  webhookId: process.env.PAYPAL_WEBHOOK_ID || '',
  returnUrl: process.env.PAYPAL_RETURN_URL || '',
  cancelUrl: process.env.PAYPAL_CANCEL_URL || '',
  checkoutCurrency: (process.env.PAYPAL_CHECKOUT_CURRENCY || 'USD').toUpperCase(),
  inrToUsdRate: Number(process.env.PAYPAL_INR_TO_USD_RATE || 83)
};

export const channel3Config = {
  enabled: process.env.CHANNEL3_ENABLED === 'true',
  baseUrl: (process.env.CHANNEL3_API_BASE_URL || '').replace(/\/$/, ''),
  apiKey: process.env.CHANNEL3_API_KEY || '',
  searchLimit: Number(process.env.CHANNEL3_SEARCH_LIMIT || 12),
  timeoutMs: Number(process.env.CHANNEL3_TIMEOUT_MS || 45000),
  usdToInr: Number(process.env.CHANNEL3_USD_TO_INR || process.env.PAYPAL_INR_TO_USD_RATE || 83)
};
