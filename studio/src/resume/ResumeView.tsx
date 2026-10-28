import type { CoverLetter, Profile, ResumeStyle, TailoredResume } from '../lib/types';

const range = (start: string, end: string) => (start || end ? `${start}${start ? ' – ' : ''}${end || 'Present'}` : '');
const cleanUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** Lines the fact guard flagged get a highlight on screen (not in the PDF). */
export interface Flags { has(text: string): boolean }
const noFlags: Flags = { has: () => false };

export function ResumeView({ profile, doc, style, flags = noFlags }: { profile: Profile; doc: TailoredResume; style: ResumeStyle; flags?: Flags }) {
  const b = profile.basics;
  const contact = [b.email, b.phone, b.location].filter(Boolean);
  const exp = doc.experience.map((d) => ({ d, e: profile.experience.find((x) => x.id === d.id) })).filter((x) => x.e);
  const prj = doc.projects.map((d) => ({ d, p: profile.projects.find((x) => x.id === d.id) })).filter((x) => x.p);
  const edu = doc.education.map((id) => profile.education.find((x) => x.id === id)).filter(Boolean);
  const skills = doc.skills.map((id) => profile.skills.find((x) => x.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const groups = [...new Set(skills.map((s) => s.group))];
  const grouped = groups.length > 1 || (groups.length === 1 && groups[0] !== '');

  const sections: Record<string, JSX.Element | null> = {
    summary: doc.summary.text ? (
      <section key="summary"><h2>Summary</h2><p className={flags.has(doc.summary.text) ? 'flag' : ''}>{doc.summary.text}</p></section>
    ) : null,
    experience: exp.length ? (
      <section key="experience">
        <h2>Experience</h2>
        {exp.map(({ d, e }) => (
          <div className="r-entry" key={d.id}>
            <div className="r-entry-head"><b>{e!.title}{e!.company ? `, ${e!.company}` : ''}</b><span>{range(e!.start, e!.end)}</span></div>
            {e!.location && <div className="r-sub">{e!.location}</div>}
            {d.bullets.length > 0 && <ul>{d.bullets.map((bl, i) => <li key={i} className={flags.has(bl.text) ? 'flag' : ''}>{bl.text}</li>)}</ul>}
          </div>
        ))}
      </section>
    ) : null,
    projects: prj.length ? (
      <section key="projects">
        <h2>Projects</h2>
        {prj.map(({ d, p }) => (
          <div className="r-entry" key={d.id}>
            <div className="r-entry-head"><b>{p!.name}{p!.role ? ` · ${p!.role}` : ''}</b><span>{range(p!.start, p!.end)}</span></div>
            {p!.url && <div className="r-sub">{cleanUrl(p!.url)}</div>}
            {d.bullets.length > 0 && <ul>{d.bullets.map((bl, i) => <li key={i} className={flags.has(bl.text) ? 'flag' : ''}>{bl.text}</li>)}</ul>}
          </div>
        ))}
      </section>
    ) : null,
    skills: skills.length ? (
      <section key="skills">
        <h2>Skills</h2>
        {grouped
          ? groups.map((g) => <div className="r-skill-group" key={g}><b>{g || 'Other'}:</b> {skills.filter((s) => s.group === g).map((s) => s.name).join(', ')}</div>)
          : <div className="r-skills">{skills.map((s) => <span key={s.id}>{s.name}</span>)}</div>}
      </section>
    ) : null,
    education: edu.length ? (
      <section key="education">
        <h2>Education</h2>
        {edu.map((e) => (
          <div className="r-entry" key={e!.id}>
            <div className="r-entry-head"><b>{e!.degree}{e!.degree && e!.school ? ', ' : ''}{e!.school}</b><span>{range(e!.start, e!.end)}</span></div>
            {e!.details && <div className="r-sub">{e!.details}</div>}
          </div>
        ))}
      </section>
    ) : null,
    languages: profile.languages.length ? (
      <section key="languages"><h2>Languages</h2><p>{profile.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)).join(' · ')}</p></section>
    ) : null,
  };

  return (
    <article className={`page t-${style.theme}${style.paper === 'letter' ? ' letter-size' : ''}`} style={{ ['--accent' as string]: style.theme === 'classic' ? undefined : style.accent }}>
      <header>
        <div>
          <h1>{b.name || 'Your name'}</h1>
          {doc.headline && <div className="r-headline">{doc.headline}</div>}
        </div>
        <div className="r-contact">
          {contact.map((c) => <span key={c}>{c}</span>)}
          {b.links.map((l) => <a key={l.id} href={l.url}>{l.label && l.label !== l.url ? l.label : cleanUrl(l.url)}</a>)}
        </div>
      </header>
      {profile.order.map((k) => sections[k])}
    </article>
  );
}

export function LetterView({ profile, letter, style, company, flags = noFlags }: { profile: Profile; letter: CoverLetter; style: ResumeStyle; company: string; flags?: Flags }) {
  const b = profile.basics;
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article className={`page t-${style.theme}${style.paper === 'letter' ? ' letter-size' : ''}`} style={{ ['--accent' as string]: style.theme === 'classic' ? undefined : style.accent }}>
      <header className="l-head">
        <h1>{b.name || 'Your name'}</h1>
        <div className="r-contact">{[b.email, b.phone, b.location].filter(Boolean).map((c) => <span key={c}>{c}</span>)}</div>
      </header>
      <p className="l-date">{date}</p>
      {(letter.recipient || company) && <p className="l-to">{letter.recipient || company}</p>}
      <div className="l-body">
        <p>{letter.greeting}</p>
        {letter.paragraphs.filter((p) => p.text.trim()).map((p, i) => <p key={i} className={flags.has(p.text) ? 'flag' : ''}>{p.text}</p>)}
      </div>
      <div className="l-sign"><p>{letter.closing}</p><p>{b.name}</p></div>
    </article>
  );
}
