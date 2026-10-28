// Any server that speaks the OpenAI chat-completions format: OpenAI, OpenRouter, or a local Ollama / LM Studio.
// Local servers keep the profile on the user's own computer.
import type { Task } from './prompts';
import { AiError } from './errors';

interface ChatResponse { choices?: { message?: { content?: string }; finish_reason?: string }[]; error?: { message?: string } }

async function post(baseUrl: string, apiKey: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AiError('Stopped.', 'aborted');
    const local = /localhost|127\.0\.0\.1/.test(baseUrl);
    throw new AiError(local
      ? `Couldn’t reach ${baseUrl}. Is the server running, and does it allow this site? For Ollama, start it with OLLAMA_ORIGINS set to this site’s address.`
      : `Couldn’t reach ${baseUrl}. Check the address and your connection.`);
  }
}

export async function runOpenAiCompatible(task: Task, baseUrl: string, apiKey: string, model: string, signal?: AbortSignal): Promise<string> {
  if (!baseUrl) throw new AiError('Set the server address in Settings.');
  if (!model) throw new AiError('Set the model name in Settings.');
  const messages = [{ role: 'system', content: task.system }, { role: 'user', content: task.prompt }];
  let res = await post(baseUrl, apiKey, {
    model, messages, response_format: { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: task.schema } },
  }, signal);
  // Some servers don't support json_schema yet: ask for plain JSON and describe the shape in the prompt instead.
  if (res.status === 400 || res.status === 422) {
    res = await post(baseUrl, apiKey, {
      model,
      messages: [messages[0], { role: 'user', content: `${task.prompt}\n\nAnswer with only a JSON object matching this JSON Schema:\n${JSON.stringify(task.schema)}` }],
      response_format: { type: 'json_object' },
    }, signal);
  }
  const data = (await res.json().catch(() => ({}))) as ChatResponse;
  if (res.status === 401 || res.status === 403) throw new AiError('The server didn’t accept the API key. Check it in Settings.', 'auth');
  if (res.status === 404) throw new AiError(`The server doesn’t know the model “${model}”, or the address is wrong.`);
  if (res.status === 429) throw new AiError('Rate limit reached. Wait a minute and try again.');
  if (!res.ok) throw new AiError(data.error?.message ?? `The server returned an error (${res.status}).`);
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') throw new AiError('The answer was cut off. Try a model with a larger output limit.');
  const text = choice?.message?.content ?? '';
  if (!text.trim()) throw new AiError('The model returned an empty answer. Try again.');
  return text;
}
