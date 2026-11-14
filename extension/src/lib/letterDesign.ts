import { bulletList, fullName, linkOrNull, Profile, skillList } from './profile';
import { analyzeJob, coverage } from './tailor';
import { AccentId, accentColor } from './resume';

/**
 * Cover letter designs: how the letter looks on the page. The words are the letter the user wrote or generated; the
 * rest is filled from their profile and the job, never invented:
 *   headline and contact     the profile
 *   impact numbers           experience points that contain a number ("lifting conversion by 18%")
 *   strengths                the first skills in the profile
 *   "Where I could contribute at <company>"   the job description's requirements, each with the profile point that
 *                            shows it (without a job description: the top skills, each with a point that uses it)
 * Rules only, in the browser.
 */
export const LETTER_DESIGNS = [
  { id: 'letterhead', label: 'Letterhead', hint: 'Large name and headline, the role as a title, your impact in the footer.' },
  { id: 'sidebar', label: 'Sidebar', hint: 'A side column with contact, experience, impact and strengths, and what you’d bring to the company.' },
  { id: 'banner', label: 'Banner', hint: 'Your name on a colour band, then a clean letter.' },
  { id: 'plain', label: 'Plain', hint: 'Name and contact, then the letter. Nothing else.' },
] as const;
export type LetterDesignId = (typeof LETTER_DESIGNS)[number]['id'];

export interface LetterDesignInput { profile: Profile | null; role: string; company: string; text: string; description?: string; tagline?: string }
export interface Impact { lead: string; text: string; short: string }
export interface Contribution { lead: string; text: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/[\s,;:.-]+\S*$/, '')}…` : s);
const NUMBER = /(?:[$₹€£]\s?\d[\d,.]*\s?[kKmMbB]?\+?|\d[\d,.]*\s?(?:%|x|×|\+)|\b\d[\d,.]*\b(?!\s*(?:am|pm)))/;

/** Points from the experience that show a result with a number, best first. */
export function impacts(p: Profile, n = 3): Impact[] {
  const points = p.work.flatMap((w) => bulletList(w.bullets));
  const out: Impact[] = [];
  for (const b of points) {
    const m = NUMBER.exec(b);
    if (!m || /^(19|20)\d\d$/.test(m[0].trim())) continue;
    const token = m[0].trim();
    const words = b.split(/\s+/);
    const at = words.findIndex((w) => w.includes(token.split(/\s/)[0]));
    // "lifting conversion by 18%" (a percentage reads after its words); "6 product teams" (a count reads before them)
    // A count reads with the words after it ("6 product teams"); a percentage, or a number that ends a phrase, with
    // the words before it ("lifting conversion by 18%", "eight steps to 3")
    const after = words.slice(at + 1, at + 3);
    const forward = !/[%x×]$/.test(token) && !/[,;:.]$/.test(words[at]) && after.length > 0 && /^[a-z]/i.test(after[0]);
    let short: string;
    if (forward) {
      const take: string[] = [words[at]];
      for (const w of after) { take.push(w); if (/[,;:.]$/.test(w)) break; }
      short = take.join(' ');
    } else {
      let from = Math.max(0, at - 3);
      for (let k = at - 1; k >= from; k--) if (/[,;:]$/.test(words[k])) { from = k + 1; break; }
      short = words.slice(from, at + 1).join(' ');
    }
    short = short.replace(/[,.;:]+$/, '');
    out.push({ lead: short, text: clip(b, 90), short });
    if (out.length >= n) break;
  }
  return out;
}

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the user would bring: the job's requirements with the profile point that shows each. */
export function contributions(p: Profile, description = '', n = 3): Contribution[] {
  if (description.trim().length > 80) {
    const job = analyzeJob(description, skillList(p));
    const cov = coverage(p, job);
    const out = cov.matches.filter((m) => m.status !== 'missing' && m.evidence && !['Skills', 'Profile', 'Headline', 'Education'].includes(m.evidence.where))
      .map((m) => ({ lead: title(m.requirement.keywords[0] ?? m.requirement.text.split(/\s+/).slice(0, 4).join(' ').replace(/[,.;:]+$/, '')), text: clip(m.evidence!.text, 140) }));
    const seen = new Set<string>();
    const uniq = out.filter((c) => !seen.has(c.text) && seen.add(c.text));
    if (uniq.length) return uniq.slice(0, n);
  }
  const points = p.work.flatMap((w) => bulletList(w.bullets));
  const out: Contribution[] = [];
  for (const s of skillList(p)) {
    const stem = s.toLowerCase().replace(/(ies|es|s)$/, '');  // "Design systems" matches "the design system"
    const hit = points.find((b) => b.toLowerCase().includes(stem) && !out.some((o) => o.text === clip(b, 140)));
    if (hit) out.push({ lead: s, text: clip(hit, 140) });
    if (out.length >= n) break;
  }
  return out;
}

/** "PRODUCT DESIGN" for a designer, and a tagline that fits the kind of role. */
export function roleFamily(role: string): { eyebrow: string; tagline: string } {
  const r = role.toLowerCase();
  if (/design|ux|ui\b|researcher/.test(r)) return { eyebrow: 'Product design', tagline: 'Making complex journeys feel simple.' };
  if (/product manager|product owner|\bpm\b/.test(r)) return { eyebrow: 'Product management', tagline: 'Turning hard problems into shipped products.' };
  if (/data|machine learning|\bml\b|\bai\b|scientist|analyst/.test(r)) return { eyebrow: 'Data and AI', tagline: 'Turning data into decisions people trust.' };
  if (/engineer|developer|devops|sre|architect/.test(r)) return { eyebrow: 'Engineering', tagline: 'Building software that ships and scales.' };
  if (/market|growth|brand|content/.test(r)) return { eyebrow: 'Marketing', tagline: 'Growing products people talk about.' };
  if (/sales|account|business development|partnership/.test(r)) return { eyebrow: 'Sales', tagline: 'Building relationships that grow revenue.' };
  return { eyebrow: role.trim() || 'Application', tagline: 'Bringing proven results to the team.' };
}

interface Parts { greeting: string; body: string[]; signoff: string; name: string }

/** The letter's text as greeting, paragraphs and sign-off (the name and contact lines under it are dropped: the design shows them). */
function split(text: string, p: Profile | null): Parts {
  const paras = text.replace(/\r/g, '').split(/\n{2,}/).map((x) => x.trim()).filter(Boolean);
  let greeting = '';
  if (paras[0] && /^(dear|hi|hello|to whom)/i.test(paras[0])) greeting = paras.shift()!;
  let signoff = '';
  let name = p ? fullName(p) : '';
  const last = paras[paras.length - 1] ?? '';
  const SIGN = /^(best regards|kind regards|warm regards|regards|sincerely|yours sincerely|yours faithfully|thank you|thanks|best|cheers),?$/i;
  const lines = last.split('\n');
  const at = lines.findIndex((l) => SIGN.test(l.trim()));
  if (at >= 0) {
    paras.pop();
    if (at > 0) paras.push(lines.slice(0, at).join('\n'));
    signoff = lines[at].trim();
    if (lines[at + 1]?.trim()) name = lines[at + 1].trim();
  }
  return { greeting, body: paras, signoff: signoff || 'Best regards,', name: name || '[name]' };
}

const para = (s: string) => `<p>${esc(s).replace(/\n/g, '<br>')}</p>`;
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/** The letter as an HTML fragment (`<div class="ld ld-…">`), the same markup for preview and PDF. */
export function letterHtml(design: LetterDesignId, x: LetterDesignInput): string {
  const p = x.profile;
  const parts = split(x.text, p);
  const name = esc(p ? fullName(p) || 'Your name' : 'Your name');
  const role = x.role.trim();
  const company = x.company.trim();
  const headline = esc(p?.headline ?? '');
  const links = p ? [p.portfolio || p.website, p.linkedin, p.github].filter(Boolean).map((u) => { const h = linkOrNull(u); return h ? `<a href="${esc(h)}">${esc(host(u))}</a>` : ''; }).filter(Boolean) : [];
  const contact = [...(p ? [p.location, p.email, p.phone].filter(Boolean).map(esc) : []), ...links];
  const sign = `<div class="ld-sign"><p class="ld-signoff">${esc(parts.signoff)}</p><p class="ld-name">${esc(parts.name)}</p></div>`;
  const greeting = parts.greeting ? para(parts.greeting) : '';
  const subject = role || company ? `<h2 class="ld-subject">${esc([role, company].filter(Boolean).join(design === 'sidebar' ? ' | ' : ' — '))}</h2>` : '';
  const imp = p ? impacts(p) : [];
  const years = p?.years_experience ? `${esc(p.years_experience)}+ years` : '';

  if (design === 'sidebar') {
    const fam = roleFamily(role);
    const contrib = p ? contributions(p, x.description) : [];
    const body = parts.body;
    const split2 = Math.min(2, body.length);
    const strengths = p ? skillList(p).slice(0, 6) : [];
    const aside = `<aside>
      <h1>${name}</h1>${headline ? `<p class="ld-head">${headline}</p>` : ''}
      ${contact.length ? `<h3>Contact</h3><ul>${contact.map((c) => `<li>${c}</li>`).join('')}</ul>` : ''}
      ${years ? `<h3>Experience</h3><p><b>${years}</b>${p?.summary ? `<br>${esc(clip(p.summary.split(/(?<=[.!?])\s/)[0], 110))}` : ''}</p>` : ''}
      ${imp.length ? `<h3>Selected impact</h3>${imp.map((i) => `<p class="ld-imp"><b>${esc(i.lead)}</b><br>${esc(i.text)}</p>`).join('')}` : ''}
      ${strengths.length ? `<h3>Core strengths</h3><ul>${strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}
    </aside>`;
    const main = `<main>
      <p class="ld-eyebrow">Application · ${esc(fam.eyebrow)}</p>
      <h1 class="ld-tagline">${esc(x.tagline?.trim() || fam.tagline)}</h1>
      ${subject}${greeting}${body.slice(0, split2).map(para).join('')}
      ${contrib.length ? `<h3 class="ld-section">Where I could contribute${company ? ` at ${esc(company)}` : ''}</h3>${contrib.map((c) => `<p><b>${esc(c.lead)}.</b> ${esc(c.text)}</p>`).join('')}` : ''}
      ${body.slice(split2).map(para).join('')}${sign}
      ${p?.portfolio ? `<p class="ld-foot">Portfolio: ${esc(host(p.portfolio))}</p>` : ''}
    </main>`;
    return `<div class="ld ld-sidebar">${aside}${main}</div>`;
  }

  const header = design === 'banner'
    ? `<header class="ld-band"><h1>${name}</h1>${headline ? `<p class="ld-head">${headline}</p>` : ''}${contact.length ? `<p class="ld-contact">${contact.join(' · ')}</p>` : ''}</header>`
    : design === 'plain'
      ? `<header><h1>${name}</h1>${contact.length ? `<p class="ld-contact">${contact.join(' · ')}</p>` : ''}</header>`
      : `<header><h1>${name}</h1>${headline ? `<p class="ld-head">${headline}</p>` : ''}${contact.length ? `<p class="ld-contact">${contact.join(' · ')}</p>` : ''}</header>`;
  const footer = design === 'letterhead' && (years || imp.length)
    ? `<p class="ld-foot">Selected impact: ${[years && `${years}${role ? ` in ${esc(roleFamily(role).eyebrow.toLowerCase())}` : ''}`, ...imp.map((i) => esc(i.short))].filter(Boolean).join(' · ')}</p>` : '';
  return `<div class="ld ld-${design}">${header}<div class="ld-body">${design === 'plain' ? '' : subject}${greeting}${parts.body.map(para).join('')}${sign}${footer}</div></div>`;
}

/** Styles for every design, scoped under .ld (the extension's security policy needs them in a constructed sheet). */
export function letterCss(accent: AccentId = 'navy'): string {
  const a = accentColor(accent);
  return `.ld{--a:${a};box-sizing:border-box;background:#fff;color:#1f2937;font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;line-height:1.5;width:100%;min-height:100%}
.ld *{box-sizing:border-box}.ld p{margin:0 0 9px;color:inherit}.ld a{color:inherit;text-decoration:none}.ld h1,.ld h2,.ld h3{font-family:inherit;margin:0}
.ld .ld-subject{font-size:13pt;font-weight:bold;color:#111827;margin:0 0 10px}.ld .ld-sign{margin-top:14px}.ld .ld-signoff{margin:0;font-weight:bold}.ld .ld-name{margin:0}
.ld .ld-foot{margin-top:18px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:8.5pt;color:#6b7280}
.ld-letterhead{padding:48px 56px}.ld-letterhead header{padding-bottom:12px;border-bottom:1px solid #e5e7eb;margin-bottom:18px}
.ld-letterhead h1{font-size:26pt;line-height:1.1;font-weight:800;letter-spacing:-.01em;text-transform:uppercase;color:#111827}
.ld-letterhead .ld-head{margin:6px 0 4px;font-size:10pt;text-transform:uppercase;letter-spacing:.02em;color:var(--a)}
.ld-letterhead .ld-contact{margin:0;font-size:8.5pt;color:#6b7280}.ld-letterhead .ld-contact a{color:var(--a)}
.ld-plain{padding:56px 64px}.ld-plain header{margin-bottom:28px}.ld-plain h1{font-size:20pt;color:#111827}.ld-plain .ld-contact{margin:4px 0 0;font-size:9pt;color:#6b7280}
.ld-banner .ld-band{background:var(--a);color:#fff;padding:36px 56px 26px}.ld-banner h1{font-size:24pt;font-weight:800;color:#fff}
.ld-banner .ld-head{margin:4px 0 6px;color:rgba(255,255,255,.88);text-transform:uppercase;font-size:9.5pt;letter-spacing:.04em}.ld-banner .ld-contact{margin:0;color:rgba(255,255,255,.8);font-size:8.5pt}
.ld-banner .ld-body{padding:28px 56px 40px}
.ld-sidebar{display:grid;grid-template-columns:30% 1fr;grid-template-rows:1fr;min-height:1123px}
.ld-sidebar aside{background:var(--a);color:#e5e7eb;padding:44px 26px;font-size:8.8pt;line-height:1.4}
.ld-sidebar aside h1{font-size:19pt;line-height:1.1;font-weight:800;color:#fff;text-transform:uppercase;overflow-wrap:anywhere}
.ld-sidebar aside .ld-head{margin:6px 0 14px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.25);text-transform:uppercase;font-size:8pt;letter-spacing:.03em;color:rgba(255,255,255,.8)}
.ld-sidebar aside h3{margin:14px 0 6px;font-size:8pt;letter-spacing:.08em;text-transform:uppercase;color:#99f6e4}
.ld-sidebar aside ul{list-style:none;margin:0;padding:0}.ld-sidebar aside li{margin:0 0 3px;overflow-wrap:anywhere}.ld-sidebar aside b{color:#fff}
.ld-sidebar aside .ld-imp{margin:0 0 8px}
.ld-sidebar main{padding:44px 44px 36px 36px}
.ld-sidebar .ld-eyebrow{margin:0 0 6px;font-size:8.5pt;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#0f766e}
.ld-sidebar .ld-tagline{font-size:22pt;line-height:1.15;font-weight:800;color:#111827;margin:0 0 12px}
.ld-sidebar .ld-subject{font-size:10.5pt;margin:0 0 4px}
.ld-sidebar .ld-section{margin:14px 0 6px;font-size:10pt;font-weight:bold;letter-spacing:.03em;text-transform:uppercase;color:#111827}`;
}
