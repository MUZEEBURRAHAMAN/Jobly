import { bulletList, fullName, linkOrNull, monthLabel, Profile, skillList } from './profile';

/** Resume layouts. All four are single-column so applicant tracking systems read them in order. */
export const TEMPLATES = [
  { id: 'classic', label: 'Classic', hint: 'Serif headings, centred name. Safe for any industry.' },
  { id: 'modern', label: 'Modern', hint: 'Clean sans-serif with a coloured accent line.' },
  { id: 'compact', label: 'Compact', hint: 'Tighter spacing to fit more on one page.' },
  { id: 'minimal', label: 'Minimal', hint: 'Plain and quiet, lots of white space.' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const range = (start: string, end: string, current = false) => [monthLabel(start), monthLabel(end, current)].filter(Boolean).join(' – ');

/** Stylesheet per template; scoped under .resume so it never leaks into the app. */
export function resumeCss(t: TemplateId): string {
  const base = `.resume{color:#18181b;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.4;padding:40px 48px}
.resume h1{margin:0;font-size:22pt;line-height:1.1}.resume .contact{margin:6px 0 0;color:#3f3f46;font-size:9.5pt}
.resume .contact a{color:inherit;text-decoration:none}.resume h2{margin:18px 0 6px;font-size:11pt;text-transform:uppercase;letter-spacing:.06em}
.resume .item{margin:0 0 10px}.resume .row{display:flex;justify-content:space-between;gap:12px}.resume .what{font-weight:bold}
.resume .when{color:#52525b;white-space:nowrap}.resume .sub{color:#3f3f46}.resume ul{margin:4px 0 0;padding-left:18px}.resume li{margin:2px 0}
.resume p{margin:0}`;
  const extra: Record<TemplateId, string> = {
    classic: `.resume{font-family:Georgia,'Times New Roman',serif}.resume header{text-align:center}.resume h2{border-bottom:1px solid #18181b;padding-bottom:2px}`,
    modern: `.resume h1{color:#b83a0a}.resume h2{color:#b83a0a;border-bottom:2px solid #f3c5ae;padding-bottom:3px}.resume .headline{color:#52525b;margin-top:2px}`,
    compact: `.resume{font-size:9.5pt;padding:28px 34px;line-height:1.3}.resume h1{font-size:18pt}.resume h2{margin:12px 0 4px;font-size:10pt;border-bottom:1px solid #d4d4d8}.resume .item{margin-bottom:6px}`,
    minimal: `.resume h1{font-weight:normal;letter-spacing:-.01em}.resume h2{font-weight:normal;color:#71717a;letter-spacing:.12em;font-size:9.5pt}.resume .what{font-weight:600}`,
  };
  return base + extra[t];
}

/** The resume as an HTML fragment (`<div class="resume">…</div>`), the same markup for preview, print and Word. */
export function resumeHtml(p: Profile): string {
  const name = fullName(p) || 'Your name';
  const contact = [p.email, p.phone, p.location].filter(Boolean).map(esc);
  for (const u of [p.linkedin, p.github, p.portfolio, p.website]) {
    const href = linkOrNull(u);
    if (href) contact.push(`<a href="${esc(href)}">${esc(u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))}</a>`);
  }
  const parts: string[] = [`<header><h1>${esc(name)}</h1>${p.headline ? `<p class="headline">${esc(p.headline)}</p>` : ''}${contact.length ? `<p class="contact">${contact.join(' · ')}</p>` : ''}</header>`];
  if (p.summary.trim()) parts.push(`<h2>Summary</h2><p>${esc(p.summary.trim())}</p>`);
  if (p.work.length) {
    parts.push('<h2>Experience</h2>');
    for (const w of p.work) {
      const bullets = bulletList(w.bullets);
      parts.push(`<div class="item"><div class="row"><span class="what">${esc(w.title || 'Role')}${w.company ? `, ${esc(w.company)}` : ''}</span><span class="when">${esc(range(w.start, w.end, w.current))}</span></div>`
        + `${w.location ? `<div class="sub">${esc(w.location)}</div>` : ''}${bullets.length ? `<ul>${bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`);
    }
  }
  if (p.education.length) {
    parts.push('<h2>Education</h2>');
    for (const e of p.education) {
      const what = [e.degree, e.field].filter(Boolean).join(', ');
      parts.push(`<div class="item"><div class="row"><span class="what">${esc(e.school || 'School')}</span><span class="when">${esc(range(e.start, e.end))}</span></div>${what ? `<div class="sub">${esc(what)}</div>` : ''}</div>`);
    }
  }
  const skills = skillList(p);
  if (skills.length) parts.push(`<h2>Skills</h2><p>${skills.map(esc).join(' · ')}</p>`);
  return `<div class="resume">${parts.join('')}</div>`;
}

/** A Word-compatible file: Word opens HTML saved with the .doc extension and keeps the styling. */
export function resumeWordDoc(p: Profile, t: TemplateId): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(fullName(p) || 'Resume')}</title>`
    + `<style>@page{size:8.5in 11in;margin:0.6in}${resumeCss(t).replace(/\.resume\{([^}]*)padding:[^;}]+;?/, '.resume{$1')}</style></head><body>${resumeHtml(p)}</body></html>`;
}

export const fileSafe = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'resume';
