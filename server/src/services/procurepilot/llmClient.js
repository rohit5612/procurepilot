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

function ollamaAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (aiConfig.ollamaApiKey) {
    headers.Authorization = `Bearer ${aiConfig.ollamaApiKey}`;
  }
  return headers;
}

async function ollamaChat({ system, user, temperature, signal }) {
  const url = `${aiConfig.ollamaBaseUrl}/api/chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: ollamaAuthHeaders(),
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
      const isCloudHost = /ollama\.com/i.test(aiConfig.ollamaBaseUrl);
      if (isCloudHost && !aiConfig.ollamaApiKey) {
        return {
          ok: false,
          provider: 'ollama',
          model: aiConfig.ollamaModel,
          message: 'OLLAMA_API_KEY missing (required for Ollama Cloud)'
        };
      }
      const res = await fetch(`${aiConfig.ollamaBaseUrl}/api/tags`, {
        headers: ollamaAuthHeaders(),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) {
        if (isCloudHost && aiConfig.ollamaApiKey) {
          return {
            ok: true,
            provider: 'ollama',
            host: 'cloud',
            model: aiConfig.ollamaModel,
            message: 'cloud key set (tags unavailable; chat will be attempted on use)'
          };
        }
        return { ok: false, provider: 'ollama', message: `HTTP ${res.status}` };
      }
      const json = await res.json();
      const models = (json.models || []).map((m) => m.name);
      const hasModel =
        isCloudHost ||
        models.some((n) => n === aiConfig.ollamaModel || n.startsWith(`${aiConfig.ollamaModel}:`));
      return {
        ok: hasModel,
        provider: 'ollama',
        host: isCloudHost ? 'cloud' : 'local',
        model: aiConfig.ollamaModel,
        models_available: models.slice(0, 10),
        message: hasModel
          ? isCloudHost
            ? 'cloud ready'
            : 'ready'
          : `Model ${aiConfig.ollamaModel} not pulled locally`
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
