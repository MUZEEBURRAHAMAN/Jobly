import { readKey, writeKey } from './userData';

/**
 * AI for rewording, all optional:
 *   chrome     Chrome's built-in model (Gemini Nano), on this computer: nothing leaves the device.
 *   anthropic  Claude with the user's own API key, called straight from the browser (no Jobly server in between).
 * Every answer is checked against the profile by aiGuard.ts before it is shown.
 */
export type AiProvider = 'off' | 'chrome' | 'anthropic';
export interface AiSettings { provider: AiProvider; model: string }
export interface AiTask { system: string; prompt: string; schema: Record<string, unknown> }

export const AI_KEY = 'aiSettings';
export const ANTHROPIC_KEY = 'anthropicApiKey';   // never included in backups
export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best writing)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (cheapest)' },
];
export const DEFAULT_AI: AiSettings = { provider: 'off', model: 'claude-opus-5-5' };

export class AiError extends Error {}

export async function loadAi(): Promise<AiSettings> {
  const s = await readKey<AiSettings>(AI_KEY);
  return { provider: s?.provider === 'chrome' || s?.provider === 'anthropic' ? s.provider : 'off', model: CLAUDE_MODELS.some((m) => m.id === s?.model) ? s!.model : DEFAULT_AI.model };
}
export const saveAi = (s: AiSettings) => writeKey(AI_KEY, s);
export const loadAnthropicKey = async () => (await readKey<string>(ANTHROPIC_KEY)) ?? '';
export const saveAnthropicKey = (k: string) => writeKey(ANTHROPIC_KEY, k.trim());

// Chrome's Prompt API (Chrome 138+ in extensions). Typed loosely: it isn't in the TypeScript DOM types yet.
type LM = {
  availability: (o?: unknown) => Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create: (o?: unknown) => Promise<{ prompt: (t: string, o?: unknown) => Promise<string>; destroy: () => void }>;
};
const lm = (): LM | undefined => (globalThis as unknown as { LanguageModel?: LM }).LanguageModel;
const LM_OPTIONS = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };

export async function chromeAiStatus(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'> {
  try { return (await lm()?.availability(LM_OPTIONS)) ?? 'unavailable'; } catch { return 'unavailable'; }
}

/** Pulls the JSON object out of a model's answer (tolerates code fences and stray text). */
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced ? fenced[1] : text).trim();
  const a = body.indexOf('{'); const b = body.lastIndexOf('}');
  if (a < 0 || b <= a) throw new AiError("The AI's answer wasn't in the expected format. Try again.");
  try { return JSON.parse(body.slice(a, b + 1)) as T; } catch { throw new AiError("The AI's answer wasn't in the expected format. Try again."); }
}

async function runChrome(task: AiTask): Promise<string> {
  const api = lm();
  if (!api) throw new AiError("This Chrome doesn't have built-in AI. Use Claude with your own key in Settings, or update Chrome.");
  const status = await chromeAiStatus();
  if (status === 'unavailable') throw new AiError("Chrome's built-in AI isn't available on this computer. Use Claude with your own key in Settings.");
  const session = await api.create({ ...LM_OPTIONS, initialPrompts: [{ role: 'system', content: task.system }] });
  try { return await session.prompt(task.prompt, { responseConstraint: task.schema }); }
  finally { session.destroy(); }
}

async function runClaude(task: AiTask, model: string): Promise<string> {
  const apiKey = await loadAnthropicKey();
  if (!apiKey) throw new AiError('Add your Anthropic API key in Settings › AI.');
  // Loaded on first use: the SDK is large and only people who use Claude need it
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  // On a policy decline, the API re-runs the request on a fallback model (not available for Haiku)
  const fallback = model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
  try {
    const message = await client.beta.messages.stream({
      model, max_tokens: 16000, system: task.system, messages: [{ role: 'user', content: task.prompt }],
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: task.schema } }, ...fallback,
    }).finalMessage();
    if (message.stop_reason === 'refusal') throw new AiError('Claude declined this request. Try again, or edit your profile text.');
    if (message.stop_reason === 'max_tokens') throw new AiError('The answer was cut off. Try again.');
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!text.trim()) throw new AiError('Claude returned an empty answer. Try again.');
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("Anthropic didn't accept the API key. Check it in Settings › AI.");
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError("This API key can't use that model. Pick another in Settings › AI.");
    if (e instanceof Anthropic.NotFoundError) throw new AiError(`Anthropic doesn't know the model "${model}". Pick another in Settings › AI.`);
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Anthropic's rate limit was reached. Wait a minute and try again.");
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`Anthropic rejected the request: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError("Couldn't reach Anthropic. Check your connection.");
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic had a problem (${e.status ?? 'unknown'}). Try again shortly.`);
    throw new AiError("Couldn't get an answer from Claude. Try again.");
  }
}

export async function runAi<T>(task: AiTask, settings: AiSettings): Promise<T> {
  if (settings.provider === 'off') throw new AiError('AI is off. Turn it on in Settings › AI.');
  const text = settings.provider === 'chrome' ? await runChrome(task) : await runClaude(task, settings.model);
  return parseJson<T>(text);
}
