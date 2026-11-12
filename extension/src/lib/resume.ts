import { bulletList, fullName, linkOrNull, monthLabel, Profile, skillList } from './profile';

/**
 * Resume templates, written for Jobly. Six are single-column, which applicant tracking systems read in order;
 * Sidebar puts contact, skills and education in a left column, which reads well to people and most modern systems.
 * Every template takes an accent colour (black by default).
 */
export const TEMPLATES = [
  { id: 'modern', label: 'Modern', hint: 'Clean sans-serif, accent rules under each section.', ats: true },
  { id: 'bold', label: 'Bold', hint: 'Large name, contact on the right, strong section lines.', ats: true },
  { id: 'classic', label: 'Classic', hint: 'Serif type and a centred name. Safe for any industry.', ats: true },
  { id: 'executive', label: 'Executive', hint: 'A header band and small-caps sections, for senior roles.', ats: true },
  { id: 'sidebar', label: 'Sidebar', hint: 'Two columns: contact, skills and education on the left.', ats: false },
  { id: 'compact', label: 'Compact', hint: 'Tighter spacing to fit more on one page.', ats: true },
  { id: 'minimal', label: 'Minimal', hint: 'Plain and quiet, lots of white space.', ats: true },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

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
.resume p,.resume li,.resume ul,.resume div,.resume span{color:inherit;font-family:inherit}.resume p{margin:0}.resume .headline{color:#3f3f46;margin-top:3px}.resume .skills{margin:0}`;
  const extra: Record<TemplateId, string> = {
    modern: `.resume h1{color:var(--a)}.resume h2{color:var(--a);border-bottom:1.5px solid var(--a);padding-bottom:3px}`,
    bold: `.resume header{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;border-bottom:3px solid var(--a);padding-bottom:12px}
.resume h1{font-size:26pt;letter-spacing:-.01em}.resume .contact{margin:0;text-align:right;line-height:1.5}.resume .contact span{display:block}
.resume h2{font-size:10.5pt;letter-spacing:.1em;border-bottom:1px solid #d4d4d8;padding-bottom:3px;margin-top:16px}.resume .what{font-size:11pt}`,
    classic: `.resume{font-family:Georgia,'Times New Roman',serif}.resume header{text-align:center}.resume h2{border-bottom:1px solid var(--a);padding-bottom:2px;color:var(--a)}`,
    executive: `.resume{padding:0 0 36px}.resume header{background:var(--a);color:#fff;padding:30px 48px 24px}.resume header .headline,.resume header .contact{color:rgba(255,255,255,.85)}
.resume header h1{color:#fff;font-size:24pt;letter-spacing:.02em}.resume .body{padding:6px 48px 0}.resume h2{font-variant:small-caps;text-transform:none;font-size:13pt;letter-spacing:.04em;color:var(--a);border-bottom:1px solid #d4d4d8;padding-bottom:2px}`,
    sidebar: `.resume{padding:0;display:grid;grid-template-columns:31% 1fr;min-height:100%}.resume aside{background:#f4f4f5;padding:36px 22px;font-size:9.5pt}
.resume main{padding:36px 34px 36px 30px}.resume aside h2{font-size:9.5pt;margin:18px 0 6px;color:var(--a)}.resume aside h2:first-child{margin-top:0}
.resume aside p,.resume aside li{margin:0 0 5px;overflow-wrap:anywhere}.resume aside ul{list-style:none;padding:0}.resume aside a{color:inherit;text-decoration:none}
.resume h1{font-size:24pt;color:var(--a)}.resume main h2{border-bottom:1.5px solid var(--a);padding-bottom:3px;color:var(--a)}.resume .edu{margin-bottom:8px}`,
    compact: `.resume{font-size:9.5pt;padding:28px 34px;line-height:1.3}.resume h1{font-size:18pt;color:var(--a)}.resume h2{margin:12px 0 4px;font-size:10pt;border-bottom:1px solid #d4d4d8;color:var(--a)}.resume .item{margin-bottom:6px}`,
    minimal: `.resume h1{font-weight:normal;letter-spacing:-.01em}.resume h2{font-weight:normal;color:var(--a);letter-spacing:.12em;font-size:9.5pt}.resume .what{font-weight:600}`,
  };
  // Scoped to this template's class, so several templates can be on one page (the gallery thumbnails)
  return (base + extra[t]).replace(/\.resume(?![\w-])/g, `.resume.r-${t}`);
}

/** Every template's stylesheet at once, for the gallery. */
export const allResumeCss = (accent: AccentId) => TEMPLATES.map((t) => resumeCss(t.id, accent)).join('\n');

interface Parts { name: string; headline: string; contact: string[]; summary: string; work: string; education: string; skills: string[] }

function parts(p: Profile): Parts {
  const contact = [p.email, p.phone, p.location].filter(Boolean).map(esc);
  for (const u of [p.linkedin, p.github, p.portfolio, p.website]) {
    const href = linkOrNull(u);
    if (href) contact.push(`<a href="${esc(href)}">${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`);
  }
  const work = p.work.map((w) => {
    const bullets = bulletList(w.bullets);
    return `<div class="item"><div class="row"><span class="what">${esc(w.title || 'Role')}${w.company ? `, ${esc(w.company)}` : ''}</span><span class="when">${esc(range(w.start, w.end, w.current))}</span></div>`
      + `${w.location ? `<div class="sub">${esc(w.location)}</div>` : ''}${bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('');
  const education = p.education.map((e) => {
    const what = [e.degree, e.field].filter(Boolean).join(', ');
    return `<div class="item edu"><div class="row"><span class="what">${esc(e.school || 'School')}</span><span class="when">${esc(range(e.start, e.end))}</span></div>${what ? `<div class="sub">${esc(what)}</div>` : ''}</div>`;
  }).join('');
  return { name: esc(fullName(p) || 'Your name'), headline: esc(p.headline), contact, summary: esc(p.summary.trim()), work, education, skills: skillList(p).map(esc) };
}

/** The resume as an HTML fragment (`<div class="resume">…</div>`), the same markup for preview, PDF and Word. */
export function resumeHtml(p: Profile, t: TemplateId = 'modern'): string {
  const x = parts(p);
  const sec = (title: string, body: string) => (body ? `<h2>${title}</h2>${body}` : '');
  if (t === 'sidebar') {
    const side = [
      x.contact.length ? `<h2>Contact</h2><ul>${x.contact.map((c) => `<li>${c}</li>`).join('')}</ul>` : '',
      x.skills.length ? `<h2>Skills</h2><ul>${x.skills.map((s) => `<li>${s}</li>`).join('')}</ul>` : '',
      sec('Education', x.education),
    ].join('');
    const main = `<header><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}</header>${sec('Summary', x.summary ? `<p>${x.summary}</p>` : '')}${sec('Experience', x.work)}`;
    return `<div class="resume r-sidebar"><aside>${side}</aside><main>${main}</main></div>`;
  }
  const contact = t === 'bold' ? `<div class="contact">${x.contact.map((c) => `<span>${c}</span>`).join('')}</div>` : x.contact.length ? `<p class="contact">${x.contact.join(' · ')}</p>` : '';
  const header = t === 'bold'
    ? `<header><div><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}</div>${contact}</header>`
    : `<header><h1>${x.name}</h1>${x.headline ? `<p class="headline">${x.headline}</p>` : ''}${contact}</header>`;
  const body = sec('Summary', x.summary ? `<p>${x.summary}</p>` : '') + sec('Experience', x.work) + sec('Education', x.education)
    + sec('Skills', x.skills.length ? `<p class="skills">${x.skills.join(' · ')}</p>` : '');
  return `<div class="resume r-${t}">${header}${t === 'executive' ? `<div class="body">${body}</div>` : body}</div>`;
}

/** A Word-compatible file: Word opens HTML saved with the .doc extension and keeps the styling. Word can't lay out
 *  two CSS columns, so Sidebar is saved as its single-column form. */
export function resumeWordDoc(p: Profile, t: TemplateId, accent: AccentId = 'black'): string {
  const wt: TemplateId = t === 'sidebar' ? 'modern' : t;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(fullName(p) || 'Resume')}</title>`
    + `<style>@page{size:8.5in 11in;margin:0.6in}${resumeCss(wt, accent).replace(/var\(--a\)/g, accentColor(accent)).replace(/\.resume\{([^}]*)padding:[^;}]+;?/, '.resume{$1')}</style></head><body>${resumeHtml(p, wt)}</body></html>`;
}

export const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'resume';

/** Page sizes for the PDF, in CSS pixels (96 per inch). */
export const PAGES = { a4: { label: 'A4', w: 794, h: 1123, css: 'A4' }, letter: { label: 'US Letter', w: 816, h: 1056, css: 'letter' } } as const;
export type PageId = keyof typeof PAGES;
export const defaultPage = (): PageId => (/^en-(US|CA)|^es-(MX|US)/.test(typeof navigator !== 'undefined' ? navigator.language : '') ? 'letter' : 'a4');
