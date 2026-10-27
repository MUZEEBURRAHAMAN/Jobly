import { answerFields, Profile } from './profile';

/**
 * Autofill with review. Nothing is filled without the user seeing it first:
 *   1. scanForm runs in the page (activeTab: only the tab Jobly was opened on, only when asked) and lists its fields.
 *   2. proposeAnswers, in the extension, pairs fields with profile answers. The user reviews and edits them in the popup.
 *   3. fillForm runs in the page and fills only the approved fields. Jobly never presses Submit.
 * scanForm and fillForm are injected with chrome.scripting, so they must be self-contained (no imports or outside names).
 */

export interface ScannedField {
  id: string;            // data-jobly-field on the element
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'radio' | 'file' | 'checkbox';
  type: string;          // input type
  options: string[];     // select options or radio labels
  required: boolean;
  filled: boolean;       // already has a value
}

export interface ScanResult { fields: ScannedField[]; frames: string[] }

export function scanForm(): ScanResult {
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/[*✱]/g, '').trim();
  const visible = (el: Element) => { const r = (el as HTMLElement).getBoundingClientRect(); const cs = getComputedStyle(el); return (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') || (el as HTMLInputElement).type === 'file'; };
  const labelOf = (el: HTMLElement): string => {
    const id = el.getAttribute('id');
    if (id) { const l = document.querySelector(`label[for="${CSS.escape(id)}"]`); if (l) return clean(l.textContent); }
    const by = el.getAttribute('aria-labelledby');
    if (by) { const t = by.split(/\s+/).map((x) => document.getElementById(x)?.textContent ?? '').join(' '); if (clean(t)) return clean(t); }
    if (el.getAttribute('aria-label')) return clean(el.getAttribute('aria-label'));
    const wrap = el.closest('label'); if (wrap) return clean(wrap.textContent);
    // Hiring systems often put the question in a nearby element rather than a <label>.
    let node: Element | null = el;
    for (let i = 0; i < 4 && node; i++) {
      node = node.parentElement;
      const q = node?.querySelector('label, legend, .application-label, [class*="label" i], [class*="question" i]');
      if (q && !q.contains(el) && clean(q.textContent)) return clean(q.textContent).slice(0, 200);
    }
    return clean(el.getAttribute('placeholder') || el.getAttribute('name') || '');
  };
  const out: ScannedField[] = [];
  const seenRadio = new Set<string>();
  let n = 0;
  document.querySelectorAll('input, textarea, select').forEach((node) => {
    const el = node as HTMLInputElement;
    const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'password', 'search'].includes(type) || el.disabled || el.readOnly || !visible(el)) return;
    if (type === 'radio') {
      const name = el.name; if (!name || seenRadio.has(name)) return; seenRadio.add(name);
      const group = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${CSS.escape(name)}"]`));
      const legend = el.closest('fieldset')?.querySelector('legend')?.textContent;
      const id = `jf${n++}`; group.forEach((r) => r.setAttribute('data-jobly-field', id));
      out.push({ id, label: clean(legend) || labelOf(el.closest('fieldset') as HTMLElement ?? el), kind: 'radio', type, options: group.map((r) => labelOf(r)), required: group.some((r) => r.required), filled: group.some((r) => r.checked) });
      return;
    }
    const id = `jf${n++}`;
    el.setAttribute('data-jobly-field', id);
    const kind: ScannedField['kind'] = el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' ? 'select' : type === 'file' ? 'file' : type === 'checkbox' ? 'checkbox' : 'text';
    const options = kind === 'select' ? Array.from((el as unknown as HTMLSelectElement).options).map((o) => clean(o.textContent)).filter(Boolean) : [];
    out.push({ id, label: labelOf(el), kind, type, options, required: el.required || el.getAttribute('aria-required') === 'true', filled: kind === 'file' ? !!el.files?.length : kind === 'checkbox' ? el.checked : !!el.value });
  });
  // Many career sites embed the real form from a hiring system in a frame Chrome won't let Jobly read; offer to open it.
  const frames = Array.from(document.querySelectorAll('iframe')).map((f) => f.src)
    .filter((src) => /greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|recruitee\.com|teamtailor\.com|personio\./.test(src)).slice(0, 3);
  return { fields: out.slice(0, 120), frames };
}

export interface FillItem { id: string; kind: ScannedField['kind']; value: string }
export interface ResumePayload { name: string; type: string; data: string }

export function fillForm(items: FillItem[], resume: ResumePayload | null): { filled: number; failed: string[] } {
  let filled = 0; const failed: string[] = [];
  const setNative = (el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) => {
    // Sites built with React ignore plain .value writes; the prototype setter plus input/change events reach them.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const item of items) {
    const els = Array.from(document.querySelectorAll<HTMLInputElement>(`[data-jobly-field="${item.id}"]`));
    const el = els[0];
    if (!el) { failed.push(item.id); continue; }
    try {
      if (item.kind === 'file') {
        if (!resume) { failed.push(item.id); continue; }
        const bytes = Uint8Array.from(atob(resume.data.split(',').pop() ?? ''), (c) => c.charCodeAt(0));
        const dt = new DataTransfer(); dt.items.add(new File([bytes], resume.name, { type: resume.type }));
        el.files = dt.files; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (item.kind === 'select') {
        const sel = el as unknown as HTMLSelectElement;
        const want = norm(item.value);
        const opt = Array.from(sel.options).find((o) => norm(o.textContent ?? '') === want) ?? Array.from(sel.options).find((o) => norm(o.textContent ?? '').startsWith(want) || (want.length > 2 && norm(o.textContent ?? '').includes(want)));
        if (!opt) { failed.push(item.id); continue; }
        setNative(sel, opt.value);
      } else if (item.kind === 'radio') {
        const want = norm(item.value);
        const radio = els.find((r) => { const id = r.id; const l = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`)?.textContent : r.closest('label')?.textContent; return norm(l ?? r.value) === want || norm(r.value) === want; });
        if (!radio) { failed.push(item.id); continue; }
        radio.click();
      } else if (item.kind === 'checkbox') {
        if ((item.value === 'yes') !== el.checked) el.click();
      } else {
        setNative(el, item.value);
      }
      el.style.outline = '2px solid #b83a0a'; el.style.outlineOffset = '2px';
      filled++;
    } catch { failed.push(item.id); }
  }
  return { filled, failed };
}

/** Which profile answer a question asks for. First match wins, so the specific patterns come first. */
const RULES: [RegExp, string][] = [
  [/first\s*name|given\s*name|forename|preferred\s*first/, 'first_name'],
  [/last\s*name|surname|family\s*name/, 'last_name'],
  [/^(your\s*)?(full\s*)?name$|full\s*name|legal\s*name|^name\b/, 'full_name'],
  [/e-?mail/, 'email'],
  [/phone|mobile|telephone|contact\s*number/, 'phone'],
  [/linked\s*in/, 'linkedin'],
  [/git\s*hub/, 'github'],
  [/portfolio|behance|dribbble/, 'portfolio'],
  [/website|personal\s*site|blog|other\s*(url|link)/, 'website'],
  [/sponsor/, 'needs_sponsorship'],
  [/authori[sz]|legally\s*(able|eligible)|right\s*to\s*work|eligible\s*to\s*work/, 'work_authorization'],
  [/years?\s*(of)?\s*(relevant\s*)?experience|how\s*many\s*years/, 'years_experience'],
  [/salary|compensation|pay\s*expect|desired\s*pay|expected\s*(ctc|pay)/, 'salary_expectation'],
  [/notice\s*period|when\s*can\s*you\s*start|start\s*date|availability/, 'notice_period'],
  [/current\s*(company|employer)|company\s*name|most\s*recent\s*(company|employer)/, 'current_company'],
  [/current\s*(job\s*)?(title|role|position)|job\s*title|headline/, 'current_title'],
  [/^(city|location)\b|current\s*location|where\s*(are\s*you|do\s*you)\s*(based|live|located)|^address/, 'location'],
  [/cover\s*letter|why\s*(do\s*you\s*want|are\s*you\s*interested|this\s*role|us)|tell\s*us\s*about\s*yourself|about\s*you|summary|additional\s*information/, 'summary'],
];

export interface Proposal { field: ScannedField; answerId: string | null; value: string; include: boolean }

/** Pairs each scanned field with an answer. Fields Jobly can't answer are listed too, so the user sees what is left. */
export function proposeAnswers(fields: ScannedField[], profile: Profile, hasResume: boolean): Proposal[] {
  const answers = new Map(answerFields(profile).map((a) => [a.id, a.value]));
  return fields.map((field) => {
    const label = field.label.toLowerCase();
    if (field.kind === 'file') {
      const isResume = /resume|cv|curriculum/.test(label) || !/cover/.test(label);
      return { field, answerId: isResume && hasResume ? 'resume' : null, value: isResume && hasResume ? 'Your resume file' : '', include: isResume && hasResume && !field.filled };
    }
    if (field.kind === 'checkbox') return { field, answerId: null, value: '', include: false }; // consent boxes stay the user's call
    const rule = RULES.find(([re]) => re.test(label));
    let id = rule?.[1] ?? null;
    let value = id ? answers.get(id) ?? '' : '';
    if (id === 'work_authorization' && (field.kind === 'select' || field.kind === 'radio')) value = profile.work_authorization ? 'Yes' : '';
    if (id === 'needs_sponsorship' && !(field.kind === 'select' || field.kind === 'radio')) value = answers.get('needs_sponsorship') ?? '';
    if (id === 'website' && !value) value = answers.get('portfolio') ?? '';
    // Choices: only propose an answer that is one of the options.
    if ((field.kind === 'select' || field.kind === 'radio') && value) {
      const opt = field.options.find((o) => o.toLowerCase() === value.toLowerCase()) ?? field.options.find((o) => o.toLowerCase().startsWith(value.toLowerCase()));
      value = opt ?? '';
    }
    if (!value) id = null;
    return { field, answerId: id, value, include: !!value && !field.filled };
  });
}
