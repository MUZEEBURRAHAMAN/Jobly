import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE } from './defaults';
import { profileFacts } from './facts';
import { guardLetter, guardResume, numbersIn, unsupportedNumbers } from './guard';
import { parseJsonAnswer } from './ai/run';
import { matchScore, readAnalysis } from './workflows';
import type { Profile } from './types';

const profile: Profile = {
  ...EMPTY_PROFILE,
  basics: { ...EMPTY_PROFILE.basics, name: 'Jane Doe', headline: 'Frontend engineer', summary: 'Frontend engineer with 6 years in React.' },
  experience: [
    { id: 'exp_a', title: 'Senior Engineer', company: 'Acme', location: '', start: '2021', end: '', bullets: [
      { id: 'b_1', text: 'Cut page load time by 40% for 1,200,000 monthly users' },
      { id: 'b_2', text: 'Led a team of 4 engineers' },
    ] },
    { id: 'exp_b', title: 'Engineer', company: 'Beta', location: '', start: '2018', end: '2021', bullets: [
      { id: 'b_3', text: 'Built the design system used by 12 product teams' },
    ] },
  ],
  skills: [{ id: 'sk_1', name: 'React', group: '' }, { id: 'sk_2', name: 'TypeScript', group: '' }],
};
const facts = profileFacts(profile);

describe('numbers', () => {
  it('normalises thousands separators and units', () => {
    expect(numbersIn('1,200,000 users and 40% faster')).toEqual(['1200000', '40%']);
  });
  it('accepts a number its cited fact contains', () => {
    expect(unsupportedNumbers('Made pages 40% faster', [facts.find((f) => f.id === 'b_1')!])).toEqual([]);
  });
  it('flags a number no cited fact contains', () => {
    expect(unsupportedNumbers('Made pages 60% faster', [facts.find((f) => f.id === 'b_1')!])).toEqual(['60%']);
  });
});

describe('guardResume', () => {
  const draft = {
    headline: 'Frontend engineer',
    summary: { text: 'React engineer, 6 years.', sources: ['summary'] },
    experience: [
      { id: 'exp_a', bullets: [
        { text: 'Cut load time 40% for 1.2M users', sources: ['b_1'] },           // 1.2m not stated as written: warning
        { text: 'Mentored 10 engineers', sources: [] },                          // no source: removed
        { text: 'Built the design system for 12 teams', sources: ['b_3'] },      // fact from another job: removed
        { text: 'Led four engineers', sources: ['b_2', 'nope'] },                // unknown id dropped, line kept
      ] },
      { id: 'exp_ghost', bullets: [{ text: 'CTO at Ghost', sources: ['b_1'] }] }, // job not in profile: removed
    ],
    projects: [],
    skills: ['sk_2', 'sk_x', 'sk_1'],
    education: ['edu_x'],
  };
  const { doc, issues } = guardResume(draft, profile, facts);

  it('keeps only bullets backed by facts from the same job', () => {
    expect(doc.experience).toHaveLength(1);
    expect(doc.experience[0].bullets.map((b) => b.text)).toEqual(['Cut load time 40% for 1.2M users', 'Led four engineers']);
    expect(doc.experience[0].bullets[1].sources).toEqual(['b_2']);
  });
  it('reports what it removed and why', () => {
    const removed = issues.filter((i) => i.severity === 'removed').map((i) => i.reason);
    expect(removed).toContain('It cites nothing from your profile.');
    expect(removed).toContain('It uses facts from a different job or project.');
    expect(removed).toContain('That job isn’t in your profile.');
  });
  it('flags numbers that are not in the cited facts', () => {
    expect(issues.some((i) => i.severity === 'warning' && i.reason.startsWith('1.2m'))).toBe(true);
  });
  it('drops unknown skills and education, keeps order', () => {
    expect(doc.skills).toEqual(['sk_2', 'sk_1']);
    expect(doc.education).toEqual([]);
  });
});

describe('guardLetter', () => {
  it('allows connecting prose but flags invented numbers', () => {
    const { doc, issues } = guardLetter({
      recipient: 'Acme', greeting: 'Dear team,', closing: 'Best,',
      paragraphs: [
        { text: 'I admire how Acme ships.', sources: [] },
        { text: 'I led a team of 4 and grew revenue 300%.', sources: ['b_2'] },
      ],
    }, facts);
    expect(doc.paragraphs).toHaveLength(2);
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toContain('300%');
  });
});

describe('readAnalysis', () => {
  it('turns an evidence-free match into a gap', () => {
    const { matches } = readAnalysis({
      title: 'Frontend Engineer', company: 'Acme', location: '', contact: '', language: 'English',
      requirements: [{ id: 'r1', text: 'React', must: true }, { id: 'r2', text: 'Go', must: false }],
      matches: [
        { requirementId: 'r1', level: 'met', sources: ['sk_1'], note: '' },
        { requirementId: 'r2', level: 'met', sources: ['made_up'], note: '' },
      ],
    }, 'posting', '', profile);
    expect(matches.map((m) => m.level)).toEqual(['met', 'gap']);
  });
  it('scores required items double', () => {
    const { posting, matches } = readAnalysis({
      title: '', company: '', location: '', contact: '', language: '',
      requirements: [{ id: 'r1', text: 'React', must: true }, { id: 'r2', text: 'Go', must: false }],
      matches: [{ requirementId: 'r1', level: 'met', sources: ['sk_1'], note: '' }],
    }, '', '', profile);
    expect(matchScore(posting, matches)).toBe(67);
  });
});

describe('parseJsonAnswer', () => {
  it('reads JSON inside a code fence with prose around it', () => {
    expect(parseJsonAnswer<{ a: number }>('Here you go:\n```json\n{"a": 1}\n```\nThanks')).toEqual({ a: 1 });
  });
});
