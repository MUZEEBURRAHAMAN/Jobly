// Claude, called straight from the browser with the user's own API key (the key never passes through a Jobly server).
import Anthropic from '@anthropic-ai/sdk';
import type { Task } from './prompts';
import { AiError } from './errors';

export async function runAnthropic(task: Task, apiKey: string, model: string, signal?: AbortSignal): Promise<string> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
  // Haiku has no server-side fallback; on the others a policy decline is retried on Anthropic's recommended model.
  const fallback = model.startsWith('claude-haiku') ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };
  try {
    const message = await client.beta.messages
      .stream(
        {
          model,
          max_tokens: 32000,
          system: task.system,
          messages: [{ role: 'user', content: task.prompt }],
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium', format: { type: 'json_schema', schema: task.schema } },
          ...fallback,
        },
        { signal },
      )
      .finalMessage();
    if (message.stop_reason === 'refusal') throw new AiError('The model declined this request. Try rewording it.');
    if (message.stop_reason === 'max_tokens') throw new AiError('The answer was cut off. Try again, or shorten the posting.');
    const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
    if (!text.trim()) throw new AiError('The model returned an empty answer. Try again.');
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.APIUserAbortError) throw new AiError('Stopped.', 'aborted');
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Anthropic didn’t accept the API key. Check it in Settings.', 'auth');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('This API key can’t use that model. Pick another in Settings.', 'auth');
    if (e instanceof Anthropic.NotFoundError) throw new AiError(`Anthropic doesn’t know the model “${model}”. Pick another in Settings.`);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Anthropic’s rate limit was reached. Wait a minute and try again.');
    if (e instanceof Anthropic.BadRequestError) throw new AiError(`Anthropic rejected the request: ${e.message}`);
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Couldn’t reach Anthropic. Check your connection.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic had a problem (${e.status ?? 'unknown'}). Try again shortly.`);
    throw e;
  }
}
