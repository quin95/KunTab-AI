import type { AppSettings } from '../models';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function chat(
  settings: AppSettings,
  messages: Message[],
  options?: { signal?: AbortSignal; onChunk?: (text: string) => void }
): Promise<string> {
  const provider = settings.aiProvider;
  if (provider === 'none') {
    throw new Error('AI 未启用，请在设置中配置 AI 服务商和 API Key。');
  }

  if (provider === 'openai') {
    return chatOpenAI(settings, messages, options?.signal, options?.onChunk);
  } else if (provider === 'anthropic') {
    return chatAnthropic(settings, messages, options?.signal, options?.onChunk);
  }

  throw new Error(`不支持的 AI 提供商: ${provider}`);
}

async function chatOpenAI(
  settings: AppSettings,
  messages: Message[],
  signal?: AbortSignal,
  onChunk?: (text: string) => void
): Promise<string> {
  if (!settings.aiApiKey) throw new Error('缺少 API Key');
  const baseUrl = (settings.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = settings.aiModel || 'gpt-4o-mini';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.1,
      stream: !!onChunk,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI API 错误 (${res.status}): ${text.slice(0, 300)}`);
  }

  if (onChunk) {
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应数据流');
    }
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullText += content;
                onChunk(fullText);
              }
            } catch (e) {
              // Ignore parsing errors for partial/malformed stream packets
            }
          }
        }
      }
      
      // Parse any remaining buffer
      const finalLine = buffer.trim();
      if (finalLine.startsWith('data: ')) {
        const dataStr = finalLine.slice(6).trim();
        if (dataStr !== '[DONE]') {
          try {
            const parsed = JSON.parse(dataStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullText += content;
              onChunk(fullText);
            }
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }
    return fullText;
  } else {
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (content === undefined) {
      throw new Error('未在 OpenAI 响应中找到回复内容。');
    }
    return content;
  }
}

async function chatAnthropic(
  settings: AppSettings,
  messages: Message[],
  signal?: AbortSignal,
  onChunk?: (text: string) => void
): Promise<string> {
  if (!settings.aiApiKey) throw new Error('缺少 API Key');
  const baseUrl = (settings.aiBaseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const model = settings.aiModel || 'claude-3-5-sonnet-latest';

  const systemMsg = messages.find((m) => m.role === 'system')?.content;
  const restMessages = messages.filter((m) => m.role !== 'system');

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': settings.aiApiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemMsg,
      messages: restMessages.map((m) => ({ role: m.role, content: m.content })),
      temperature: 0.1,
      stream: !!onChunk,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic API 错误 (${res.status}): ${text.slice(0, 300)}`);
  }

  if (onChunk) {
    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应数据流');
    }
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanLine = line.trim();
          if (!cleanLine) continue;
          if (cleanLine.startsWith('data: ')) {
            const dataStr = cleanLine.slice(6).trim();
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullText += parsed.delta.text;
                onChunk(fullText);
              }
            } catch {}
          }
        }
      }

      // Parse any remaining buffer
      const finalLine = buffer.trim();
      if (finalLine.startsWith('data: ')) {
        const dataStr = finalLine.slice(6).trim();
        try {
          const parsed = JSON.parse(dataStr);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            fullText += parsed.delta.text;
            onChunk(fullText);
          }
        } catch {}
      }
    } finally {
      reader.releaseLock();
    }
    return fullText;
  } else {
    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (content === undefined) {
      throw new Error('未在 Anthropic 响应中找到回复内容。');
    }
    return content;
  }
}

export async function testAi(settings: AppSettings): Promise<{
  ok: boolean;
  latencyMs: number;
  message: string;
}> {
  const start = performance.now();
  try {
    const pingMessage: Message[] = [{ role: 'user', content: 'Say "OK"' }];
    let reply = '';

    if (settings.aiProvider === 'openai') {
      reply = await chatOpenAI(settings, pingMessage);
    } else if (settings.aiProvider === 'anthropic') {
      reply = await chatAnthropic(settings, pingMessage);
    } else {
      throw new Error('未选择合法的 AI 提供商');
    }

    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: true,
      latencyMs,
      message: reply.trim().slice(0, 60),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      ok: false,
      latencyMs,
      message: err?.message || String(err),
    };
  }
}
