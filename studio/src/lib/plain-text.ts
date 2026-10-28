// Plain-text versions, for pasting into application forms and applicant tracking systems.
import type { CoverLetter, Profile, TailoredResume } from './types';

const range = (s: string, e: string) => (s || e ? `${s}${s ? ' – ' : ''}${e || 'Present'}` : '');

export function resumeText(profile: Profile, doc: TailoredResume): string {
  const b = profile.basics;
  const out: string[] = [b.name, doc.headline, [b.email, b.phone, b.location, ...b.links.map((l) => l.url)].filter(Boolean).join(' | '), ''];
  for (const key of profile.order) {
    if (key === 'summary' && doc.summary.text) out.push('SUMMARY', doc.summary.text, '');
    if (key === 'experience' && doc.experience.length) {
      out.push('EXPERIENCE');
      for (const d of doc.experience) {
        const e = profile.experience.find((x) => x.id === d.id);
        if (!e) continue;
        out.push(`${e.title}, ${e.company}${e.location ? ` (${e.location})` : ''} | ${range(e.start, e.end)}`, ...d.bullets.map((x) => `- ${x.text}`), '');
      }
    }
    if (key === 'projects' && doc.projects.length) {
      out.push('PROJECTS');
      for (const d of doc.projects) {
        const p = profile.projects.find((x) => x.id === d.id);
        if (!p) continue;
        out.push(`${p.name}${p.role ? `, ${p.role}` : ''}${p.url ? ` | ${p.url}` : ''}`, ...d.bullets.map((x) => `- ${x.text}`), '');
      }
    }
    if (key === 'skills' && doc.skills.length) {
      out.push('SKILLS', doc.skills.map((id) => profile.skills.find((s) => s.id === id)?.name).filter(Boolean).join(', '), '');
    }
    if (key === 'education' && doc.education.length) {
      out.push('EDUCATION');
      for (const id of doc.education) {
        const e = profile.education.find((x) => x.id === id);
        if (e) out.push(`${[e.degree, e.school].filter(Boolean).join(', ')} | ${range(e.start, e.end)}${e.details ? `\n${e.details}` : ''}`);
      }
      out.push('');
    }
    if (key === 'languages' && profile.languages.length) {
      out.push('LANGUAGES', profile.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(', '), '');
    }
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function letterText(profile: Profile, letter: CoverLetter): string {
  return [letter.greeting, '', ...letter.paragraphs.filter((p) => p.text.trim()).flatMap((p) => [p.text, '']), letter.closing, profile.basics.name].join('\n').trim();
}
