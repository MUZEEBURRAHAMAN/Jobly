import { proposeAnswers, Proposal, ScannedField } from './autofill';
import { findSaved, SavedAnswer } from './answerBank';
import { Profile } from './profile';

/**
 * Apply assist's answers for one step of a form, each with where it came from:
 *   profile    a fact from the profile (name, email, LinkedIn, years of experience...)
 *   saved      what the user typed for the same question on an earlier form
 *   suggested  a starting point for an open question (the profile summary); the user should read it
 * Required questions with no answer are "action required".
 */
export type Source = 'profile' | 'saved' | 'suggested';
export interface AssistAnswer { id: string; label: string; kind: ScannedField['kind']; value: string; source: Source | null; include: boolean; required: boolean; filled: boolean; savedKey?: string }

export function assistAnswers(fields: ScannedField[], profile: Profile, saved: SavedAnswer[], hasResume: boolean): AssistAnswer[] {
  return proposeAnswers(fields, profile, hasResume).map((p: Proposal) => {
    const f = p.field;
    let value = p.value; let source: Source | null = p.answerId ? (p.answerId === 'summary' ? 'suggested' : 'profile') : null;
    let savedKey: string | undefined;
    // A saved answer beats a suggestion (the user wrote it for this kind of question), never a profile fact
    if ((source === null || source === 'suggested') && f.kind !== 'file' && f.kind !== 'checkbox' && f.kind !== 'custom') {
      const hit = findSaved(saved, f.label);
      const fits = hit && (f.kind === 'select' || f.kind === 'radio' ? f.options.find((o) => o.toLowerCase() === hit.value.toLowerCase()) : hit.value);
      if (hit && fits) { value = typeof fits === 'string' ? fits : hit.value; source = 'saved'; savedKey = hit.key; }
    }
    return { id: f.id, label: f.label, kind: f.kind, value, source: value ? source : null, include: !!value && !f.filled && source !== 'suggested', required: f.required, filled: f.filled, savedKey };
  });
}
