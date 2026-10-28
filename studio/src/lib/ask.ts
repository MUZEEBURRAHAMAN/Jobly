// One entry point for every AI step. With a model set up, the step runs directly. Without one, it becomes a
// hand-off: Studio shows the prompt to paste into Claude (claude.ai, on the user's own plan) and waits for the JSON answer.
import { useSyncExternalStore } from 'react';
import { AiError } from './ai/errors';
import { handoffPrompt, type Task } from './ai/prompts';
import { aiConfigured, parseJsonAnswer, runTask } from './ai/run';
import { getState } from './store';

export interface Handoff { task: Task; prompt: string; resolve: (text: string) => void; reject: (e: Error) => void }

let pending: Handoff | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useHandoff(): Handoff | null {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => pending);
}

export function finishHandoff(text: string | null): void {
  const h = pending;
  pending = null;
  emit();
  if (!h) return;
  if (text === null) h.reject(new AiError('Stopped.', 'aborted'));
  else h.resolve(text);
}

export async function ask<T>(task: Task, signal?: AbortSignal): Promise<T> {
  const ai = getState().settings.ai;
  if (aiConfigured(ai)) return runTask<T>(task, ai, signal);
  const text = await new Promise<string>((resolve, reject) => {
    pending = { task, prompt: handoffPrompt(task), resolve, reject };
    emit();
    signal?.addEventListener('abort', () => finishHandoff(null));
  });
  return parseJsonAnswer<T>(text);
}
