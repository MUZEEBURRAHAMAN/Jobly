import type { AiSettings } from '../types';
import { AiError } from './errors';
import type { Task } from './prompts';

/** Pull the first JSON object out of a model's answer (tolerates code fences and stray prose). */
export function parseJsonAnswer<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new AiError('The answer wasn’t JSON. Try again.');
  try {
    return JSON.parse(body.slice(start, end + 1)) as T;
  } catch {
    throw new AiError('The answer wasn’t valid JSON. Try again.');
  }
}

export const aiConfigured = (ai: AiSettings) =>
  ai.provider === 'anthropic' ? !!ai.apiKey : ai.provider === 'openai' ? !!ai.baseUrl && !!ai.model : false;

export async function runTask<T>(task: Task, ai: AiSettings, signal?: AbortSignal): Promise<T> {
  let text: string;
  if (ai.provider === 'anthropic') {
    if (!ai.apiKey) throw new AiError('Add your Anthropic API key in Settings.', 'auth');
    // Loaded on first use: the SDK is most of the bundle, and someone using Claude by hand never needs it.
    const { runAnthropic } = await import('./anthropic');
    text = await runAnthropic(task, ai.apiKey, ai.model || 'claude-opus-5-5', signal);
  } else if (ai.provider === 'openai') {
    const { runOpenAiCompatible } = await import('./openai-compatible');
    text = await runOpenAiCompatible(task, ai.baseUrl, ai.apiKey, ai.model, signal);
  } else {
    throw new AiError('No AI model is set up. Use “Write it with Claude” or add a model in Settings.');
  }
  return parseJsonAnswer<T>(text);
}
