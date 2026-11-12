import { aiConfig } from '../../config/aiConfig.js';

/**
 * @param {{ system: string; user: string; temperature?: number }} params
 * @returns {Promise<string>}
 */
export async function completeChat({ system, user, temperature = 0.2 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiConfig.timeoutMs);

  try {
    if (aiConfig.provider === 'ollama') {
      return await ollamaChat({ system, user, temperature, signal: controller.signal });
    }
    return await openAiCompatibleChat({ system, user, temperature, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaChat({ system, user, temperature, signal }) {
  const url = `${aiConfig.ollamaBaseUrl}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: aiConfig.ollamaModel,
      stream: false,
      options: { temperature },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.message?.content ?? json.response;
  if (!content) throw new Error('Ollama returned empty response');
  return String(content).trim();
}

async function openAiCompatibleChat({ system, user, temperature, signal }) {
  const url = `${aiConfig.openaiCompatibleBaseUrl}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (aiConfig.agentApiKey) {
    headers.Authorization = `Bearer ${aiConfig.agentApiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal,
    body: JSON.stringify({
      model: aiConfig.model,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LLM API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned empty response');
  return String(content).trim();
}

export async function checkLlmHealth() {
  try {
    if (aiConfig.provider === 'ollama') {
      const res = await fetch(`${aiConfig.ollamaBaseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return { ok: false, provider: 'ollama', message: `HTTP ${res.status}` };
      const json = await res.json();
      const models = (json.models || []).map((m) => m.name);
      const hasModel = models.some((n) => n === aiConfig.ollamaModel || n.startsWith(`${aiConfig.ollamaModel}:`));
      return {
        ok: hasModel,
        provider: 'ollama',
        model: aiConfig.ollamaModel,
        models_available: models.slice(0, 10),
        message: hasModel ? 'ready' : `Model ${aiConfig.ollamaModel} not pulled`
      };
    }
    return {
      ok: Boolean(aiConfig.agentApiKey),
      provider: 'openai_compatible',
      model: aiConfig.model,
      message: aiConfig.agentApiKey ? 'configured' : 'AI_AGENT_API_KEY missing'
    };
  } catch (e) {
    return { ok: false, provider: aiConfig.provider, message: e.message };
  }
}
