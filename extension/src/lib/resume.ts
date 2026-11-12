import { fullName, linkOrNull, monthLabel, Profile, richBullets, skillGroups } from './profile';

/**
 * Resume templates, written for Jobly. Every template is a single column with standard section headings, so an
 * applicant tracking system reads each one top to bottom in the right order (the ATS check on the Resume page reads
 * the finished page's text the same way). Every template takes an accent colour (black by default).
 * Points can mark words in **bold**; skills can be grouped ("Frontend: React, TypeScript", one group per line).
 */
export const TEMPLATES = [
  { id: 'modern', label: 'Modern', hint: 'Clean sans-serif, accent rules under each section.' },
  { id: 'engineer', label: 'Engineer', hint: 'Serif, small-caps sections, company | title lines, grouped skills and projects. The classic tech resume.' },
  { id: 'classic', label: 'Classic', hint: 'Serif type and a centred name. Safe for any industry.' },
  { id: 'bold', label: 'Bold', hint: 'Large name, contact on the right, strong section lines.' },
  { id: 'executive', label: 'Executive', hint: 'A header band and small-caps sections, for senior roles.' },
  { id: 'accent', label: 'Accent', hint: 'A colour bar down the left edge and accent headings.' },
  { id: 'compact', label: 'Compact', hint: 'Tighter spacing to fit more on one page.' },
  { id: 'minimal', label: 'Minimal', hint: 'Plain and quiet, lots of white space.' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];
/** Template ids that were renamed: the old two-column Sidebar is now Accent. */
export const templateId = (v: unknown): TemplateId | null => { const id = v === 'sidebar' ? 'accent' : v; return TEMPLATES.some((t) => t.id === id) ? id as TemplateId : null; };

export const ACCENTS = [
  { id: 'black', label: 'Black', color: '#18181b' }, { id: 'navy', label: 'Navy', color: '#1e3a8a' }, { id: 'teal', label: 'Teal', color: '#0f766e' },
  { id: 'burgundy', label: 'Burgundy', color: '#881337' }, { id: 'forest', label: 'Forest', color: '#166534' },
] as const;
export type AccentId = (typeof ACCENTS)[number]['id'];
export const accentColor = (a: AccentId) => ACCENTS.find((x) => x.id === a)?.color ?? '#18181b';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const range = (start: string, end: string, current = false) => [monthLabel(start), monthLabel(end, current)].filter(Boolean).join(' – ');

/** Stylesheet per template; scoped under .resume so it never leaks into the app. */
export function resumeCss(t: TemplateId, accent: AccentId = 'black'): string {
  const a = accentColor(accent);
  const base = `.resume{--a:${a};color:#18181b;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.4;padding:40px 48px;box-sizing:border-box}
.resume *{box-sizing:border-box}.resume h1{margin:0;font-size:22pt;line-height:1.1;color:inherit;font-family:inherit;font-weight:bold}.resume .contact{margin:6px 0 0;color:#3f3f46;font-size:9.5pt}
.resume .contact a{color:inherit;text-decoration:none}.resume h2{color:inherit;font-family:inherit;font-weight:bold;margin:18px 0 6px;font-size:11pt;text-transform:uppercase;letter-spacing:.06em}
.resume .item{margin:0 0 10px;break-inside:avoid}.resume .row{display:flex;justify-content:space-between;gap:12px}.resume .what{font-weight:bold}
.resume .when{color:#52525b;white-space:nowrap}.resume .sub{color:#3f3f46}.resume ul{margin:4px 0 0;padding-left:18px}.resume li{margin:2px 0}
.resume p,.resume li,.resume ul,.resume div,.resume span,.resume b,.resume i{color:inherit;font-family:inherit}.resume .lines p{margin:2px 0}.resume .links{white-space:nowrap}.resume p{margin:0}.resume .headline{color:#3f3f46;margin-top:3px}.resume .skills{margin:0}`;
  const extra: Record<TemplateId, string> = {
    modern: `.resume h1{color:var(--a)}.resume h2{color:var(--a);border-bottom:1.5px solid var(--a);padding-bottom:3px}`,
    bold: `.resume header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:3px solid var(--a);padding-bottom:12px}
.resume h1{font-size:26pt;letter-spacing:-.01em}.resume .contact{margin:0;text-align:right;line-height:1.5}.resume .contact span{display:block}
.resume h2{font-size:10.5pt;letter-spacing:.1em;border-bottom:1px solid #d4d4d8;padding-bottom:3px;margin-top:16px}.resume .what{font-size:11pt}`,
    classic: `.resume{font-family:Georgia,'Times New Roman',serif}.resume header{text-align:center}.resume h2{border-bottom:1px solid var(--a);padding-bottom:2px;color:var(--a)}`,
    executive: `.resume{padding:0 0 36px}.resume header{background:var(--a);color:#fff;padding:30px 48px 24px}.resume header .headline,.resume header .contact{color:rgba(255,255,255,.85)}
.resume header h1{color:#fff;font-size:24pt;letter-spacing:.02em}.resume .body{padding:6px 48px 0}.resume h2{font-variant:small-caps;text-transform:none;font-size:13pt;letter-spacing:.04em;color:var(--a);border-bottom:1px solid #d4d4d8;padding-bottom:2px}`,
    engineer: `.resume{font-family:'Latin Modern Roman','CMU Serif','Computer Modern',Cambria,Georgia,'Times New Roman',serif;font-size:10pt;line-height:1.3;padding:34px 44px}
.resume header{text-align:center}.resume h1{font-size:25pt;letter-spacing:.01em}.resume .contact{margin-top:4px;font-size:9.5pt;color:inherit}.resume .contact a{text-decoration:underline;text-underline-offset:2px}
.resume h2{font-variant:small-caps;text-transform:none;font-weight:normal;font-size:13pt;letter-spacing:.03em;margin:12px 0 5px;border-bottom:.8px solid var(--a);padding-bottom:1px;color:var(--a)}
.resume .item{margin:0 0 7px}.resume .what{font-weight:normal}.resume .what b{font-weight:bold}.resume .what i,.resume .sub i{font-style:italic}.resume .when{color:inherit}.resume .edu .sub{display:flex;justify-content:space-between;gap:12px}
.resume ul{margin:2px 0 0;padding-left:16px}.resume li{margin:1px 0}.resume .lines p{margin:1px 0}.resume .links a{color:inherit;text-decoration:underline}`,
    accent: `.resume{border-left:10px solid var(--a);padding-left:42px}.resume h1{font-size:24pt;color:var(--a)}.resume h2{display:flex;align-items:center;gap:8px;color:var(--a)}
.resume h2::before{content:"";width:8px;height:8px;background:var(--a);flex:none}`,
    compact: `.resume{font-size:9.5pt;padding:28px 34px;line-height:1.3}.resume h1{font-size:18pt;color:var(--a)}.resume h2{margin:12px 0 4px;font-size:10pt;border-bottom:1px solid #d4d4d8;color:var(--a)}.resume .item{margin-bottom:6px}`,
    minimal: `.resume h1{font-weight:normal;letter-spacing:-.01em}.resume h2{font-weight:normal;color:var(--a);letter-spacing:.12em;font-size:9.5pt}.resume .what{font-weight:600}`,
  };
  // Scoped to this template's class, so several templates can be on one page (the gallery thumbnails)
  return (base + extra[t]).replace(/\.resume(?![\w-])/g, `.resume.r-${t}`);
}

/** Every template's stylesheet at once, for the gallery. */
export const allResumeCss = (accent: AccentId) => TEMPLATES.map((t) => resumeCss(t.id, accent)).join('\n');

interface Parts { name: string; headline: string; contact: string[]; summary: string; work: string; projects: string; education: string; skills: string; achievements: string }

/** A point with its **bold** marks turned into <b> (the text itself escaped first). */
const rich = (t: string) => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*\*/g, '');
const shortUrl = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
/** "Label: text" lines: the label in bold. */
const labelled = (l: string) => { const m = /^([^:]{2,48}):\s+(.+)$/.exec(l); return m ? `<b>${rich(m[1])}:</b> ${rich(m[2])}` : rich(l); };

function parts(p: Profile, t: TemplateId): Parts {
  const eng = t === 'engineer';
  const links: string[] = [];
  for (const u of [p.portfolio, p.website, p.linkedin, p.github]) {
    const href = linkOrNull(u);
    if (href) links.push(`<a href="${esc(href)}">${esc(shortUrl(u))}</a>`);
  }
  const contact = eng ? [...links.slice(0, 1), ...[p.email, p.phone].filter(Boolean).map(esc), ...links.slice(1), ...(p.location ? [esc(p.location)] : [])]
    : [...[p.email, p.phone, p.location].filter(Boolean).map(esc), ...links];
  const list = (items: string[]) => (items.length ? `<ul>${items.map((b) => `<li>${rich(b)}</li>`).join('')}</ul>` : '');
  const work = p.work.map((w) => {
    const when = esc(range(w.start, w.end, w.current));
    const what = eng ? `<b>${esc(w.company || 'Company')}</b>${w.title ? ` | <i>${esc(w.title)}</i>` : ''}` : `${esc(w.title || 'Role')}${w.company ? `, ${esc(w.company)}` : ''}`;
    const right = eng ? [esc(w.location), when].filter(Boolean).join(' · ') : when;
    return `<div class="item"><div class="row"><span class="what">${what}</span><span class="when">${right}</span></div>`
      + `${!eng && w.location ? `<div class="sub">${esc(w.location)}</div>` : ''}${list(richBullets(w.bullets))}</div>`;
  }).join('');
  const projects = (p.projects ?? []).filter((x) => x.name.trim()).map((x) => {
    const href = linkOrNull(x.link);
    return `<div class="item"><div class="row"><span class="what"><b>${esc(x.name)}</b>${x.tech ? ` | <i>${esc(x.tech)}</i>` : ''}</span>${href ? `<span class="when links"><a href="${esc(href)}">${esc(shortUrl(x.link))}</a></span>` : ''}</div>${list(richBullets(x.bullets))}</div>`;
  }).join('');
  const education = p.education.map((e) => {
    const what = [e.degree, e.field].filter(Boolean).join(eng ? ' in ' : ', ');
    const when = esc(range(e.start, e.end));
    if (eng) return `<div class="item edu"><div class="row"><span class="what"><b>${esc(e.school || 'School')}</b></span><span class="when">${esc(e.location ?? '')}</span></div>`
      + `${what || when ? `<div class="sub"><i>${esc(what)}</i><i>${when}</i></div>` : ''}${e.grade ? `<div class="sub">${esc(e.grade)}</div>` : ''}</div>`;
    return `<div class="item edu"><div class="row"><span class="what">${esc(e.school || 'School')}</span><span class="when">${when}</span></div>${what ? `<div class="sub">${esc(what)}${e.location ? ` · ${esc(e.location)}` : ''}</div>` : ''}${e.grade ? `<div class="sub">${esc(e.grade)}</div>` : ''}</div>`;
  }).join('');
  const groups = skillGroups(p);
  const skills = !groups.length ? '' : groups.some((g) => g.label)
    ? `<div class="lines">${groups.map((g) => `<p>${g.label ? `<b>${esc(g.label)}:</b> ` : ''}${g.items.map(esc).join(', ')}</p>`).join('')}</div>`
    : `<p class="skills">${groups.flatMap((g) => g.items).map(esc).join(eng ? ', ' : ' · ')}</p>`;
  const lines = (p.achievements ?? '').split('\n').map((l) => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean);
  const achievements = !lines.length ? '' : eng ? `<div class="lines">${lines.map((l) => `<p>${labelled(l)}</p>`).join('')}</div>` : `<ul>${lines.map((l) => `<li>${labelled(l)}</li>`).join('')}</ul>`;
  return { name: esc(fullName(p) || 'Your name'), headline: esc(p.headline), contact, summary: esc(p.summary.trim()), work, projects, education, skills, achievements };
}

/** The resume as an HTML fragment (`<div class="resume">…</div>`), the same markup for preview, PDF and Word. */
export function resumeHtml(p: Profile, t: TemplateId = 'modern'): string {
  const x = parts(p, t);
  const sec = (title: string, body: string) => (body ? `<h2>${title}</h2>${body}` : '');
  const summary = sec('Summary', x.summary ? `<p>${x.summary}</p>` : '');
  if (t === 'engineer') {
    const header = `<header><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}${x.contact.length ? `<p class="contact">${x.contact.join(' | ')}</p>` : ''}</header>`;
    return `<div class="resume r-engineer">${header}${summary}${sec('Work Experience', x.work)}${sec('Technical Skills', x.skills)}${sec('Projects', x.projects)}${sec('Achievements', x.achievements)}${sec('Education', x.education)}</div>`;
  }
  const contact = t === 'bold' ? `<div class="contact">${x.contact.map((c) => `<span>${c}</span>`).join('')}</div>` : x.contact.length ? `<p class="contact">${x.contact.join(' · ')}</p>` : '';
  const header = t === 'bold'
    ? `<header><div><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}</div>${contact}</header>`
    : `<header><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}${contact}</header>`;
  const body = summary + sec('Experience', x.work) + sec('Projects', x.projects) + sec('Education', x.education) + sec('Skills', x.skills) + sec('Achievements', x.achievements);
  return `<div class="resume r-${t}">${header}${t === 'executive' ? `<div class="body">${body}</div>` : body}</div>`;
}

/** A Word-compatible file: Word opens HTML saved with the .doc extension and keeps the styling. */
export function resumeWordDoc(p: Profile, t: TemplateId, accent: AccentId = 'black'): string {
  const wt = t;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(fullName(p) || 'Resume')}</title>`
    + `<style>@page{size:8.5in 11in;margin:0.6in}${resumeCss(wt, accent).replace(/var\(--a\)/g, accentColor(accent)).replace(/\.resume\{([^}]*)padding:[^;}]+;?/, '.resume{$1')}</style></head><body>${resumeHtml(p, wt)}</body></html>`;
}

export const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'resume';

/** Page sizes for the PDF, in CSS pixels (96 per inch). */
export const PAGES = { a4: { label: 'A4', w: 794, h: 1123, css: 'A4' }, letter: { label: 'US Letter', w: 816, h: 1056, css: 'letter' } } as const;
export type PageId = keyof typeof PAGES;
export const defaultPage = (): PageId => (/^en-(US|CA)|^es-(MX|US)/.test(typeof navigator !== 'undefined' ? navigator.language : '') ? 'letter' : 'a4');
