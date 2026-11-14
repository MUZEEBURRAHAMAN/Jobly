import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bookmark, BookmarkCheck, Briefcase, Building2, Clock, ExternalLink, Flag, MapPin, Share2, Sparkles, Star, X } from '../lib/icons';
import { Job } from '../types';
import { jobData } from '../lib/api';
import { getCompanyLogoUrl } from '../lib/companyLogos';
import { hostOf, safeHttpUrl } from '../lib/url';
import { BOARD_NAMES, EMPLOYMENT_LABELS, EXPERIENCE_LABELS, timeAgo } from '../lib/format';
import { matchScore, useMatch } from '../lib/matchScore';
import { useTrackerContext } from '../lib/trackerContext';
import { QueueButton } from './JobCard';
import { ReportModal } from './ReportModal';

const WORK_MODE: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', on_site: 'On-site' };

type Block = { kind: 'h'; text: string } | { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

/** A plain-text job description as headings, paragraphs and lists. Lines that are page furniture are left out. */
export function describe(text: string): Block[] {
  const JUNK = /^(posted|posted on|date posted|apply( now)?|share( this job)?|back to (all )?jobs|save job|job id|req(uisition)? id|time type|job posted)\b[^a-z]*[:.]?/i;
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !(JUNK.test(l) && l.length < 60));
  const out: Block[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const bullet = /^[-•*▪◦●·]\s+/.test(l);
    if (bullet) {
      const items: string[] = [];
      while (i < lines.length && /^[-•*▪◦●·]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-•*▪◦●·]\s+/, '')); i++; }
      i--; out.push({ kind: 'ul', items }); continue;
    }
    const next = lines[i + 1];
    const heading = l.length <= 60 && !!next && (/:$/.test(l) || (!/[.!?,;]$/.test(l) && l.split(' ').length <= 7 && /^[A-Z]/.test(l)));
    out.push(heading ? { kind: 'h', text: l.replace(/:$/, '') } : { kind: 'p', text: l });
  }
  return out;
}

/** The job in a side sheet over the list: everything Jobly knows about it, and Apply, Add to queue and Save. */
export const JobDetail: React.FC<{ job: Job; onToggleSave: (job: Job) => void; onClose: () => void }> = ({ job, onToggleSave, onClose }) => {
  const [desc, setDesc] = useState<string | null | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const tracker = useTrackerContext();
  const { prefs, skills } = useMatch();
  const match = React.useMemo(() => matchScore(job, prefs, skills), [job, prefs, skills]);
  const applyUrl = safeHttpUrl(job.application_url);
  const host = hostOf(job.application_url);
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const reportOpen = useRef(false);
  reportOpen.current = report;

  useEffect(() => {
    let live = true;
    setDesc(undefined); setImgFailed(false);
    if (job.description) { setDesc(job.description); return; }
    jobData.description(job.id).then((d) => { if (live) setDesc(d); }, () => { if (live) setDesc(null); });
    return () => { live = false; };
  }, [job.id, job.description]);

  // A modal sheet: focus moves in, Tab stays inside, Escape closes, focus goes back to the card
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (reportOpen.current) return;
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab') return;
      const items = focusables(); if (!items.length) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (!ref.current?.contains(active)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey, true); document.documentElement.style.overflow = scroll; opener?.focus?.(); };
  }, []);

  const say = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2500); };
  const share = async () => {
    if (!applyUrl) return;
    try { await navigator.clipboard.writeText(applyUrl); say('Link copied'); } catch { say("Couldn't copy"); }
  };
  const posted = job.posted_at ? timeAgo(job.posted_at) : '';
  const blocks = desc ? describe(desc) : [];
  const words = blocks.reduce((n, b) => n + (b.kind === 'ul' ? b.items.join(' ') : b.text).split(/\s+/).length, 0);
  const facts: { icon: React.ReactNode; label: string; value: string }[] = [
    { icon: <Star size={16} aria-hidden="true" />, label: 'Experience', value: (job.experience_tier && EXPERIENCE_LABELS[job.experience_tier]) || 'Not stated' },
    { icon: <MapPin size={16} aria-hidden="true" />, label: 'Location', value: [job.location, job.work_mode && WORK_MODE[job.work_mode]].filter(Boolean).join(' · ') || 'Not stated' },
    { icon: <Briefcase size={16} aria-hidden="true" />, label: 'Pay', value: job.salary_summary || 'Not stated' },
    { icon: <Clock size={16} aria-hidden="true" />, label: 'Job type', value: (job.employment_type && EMPLOYMENT_LABELS[job.employment_type]) || 'Full-time or not stated' },
  ];

  return createPortal(
    <div className="sheet-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className="sheet-top">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close job details"><X size={16} aria-hidden="true" /> Close</button>
          <span className="grow" />
          <span role="status" className="text-xs muted">{note}</span>
          <button type="button" className="btn btn-outline btn-sm btn-icon" onClick={() => void share()} disabled={!applyUrl} title="Copy link" aria-label={`Share: ${job.title}`}><Share2 size={15} aria-hidden="true" /></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReport(true)} aria-label={`Report: ${job.title}`}><Flag size={15} aria-hidden="true" /> Report</button>
        </div>

        <div className="sheet-body">
          <header className="sheet-head">
            <span className="logo sheet-logo" aria-hidden="true">{imgFailed ? <span className="logo-fallback">{job.company_name.slice(0, 2).toUpperCase()}</span> : <img src={getCompanyLogoUrl(job.company_name)} alt="" onError={() => setImgFailed(true)} />}</span>
            <div style={{ minWidth: 0 }}>
              <h2 id={titleId} className="sheet-title">{job.title}</h2>
              <p className="sheet-company">{job.company_name}</p>
            </div>
          </header>

          <div className="sheet-facts">
            {facts.map((f) => <div key={f.label} className="sheet-fact"><span className="sheet-icon">{f.icon}</span><div><span className="sheet-k">{f.label}</span><span className="sheet-v">{f.value}</span></div></div>)}
            <p className="sheet-source"><Building2 size={14} aria-hidden="true" /> {posted ? `Posted ${posted.toLowerCase()}` : 'Posting date not stated'} · applies on {BOARD_NAMES[job.source_type] ?? host ?? 'the company site'}</p>
          </div>

          {match && (
            <section className="sheet-box" aria-labelledby="sheet-fit">
              <h3 id="sheet-fit" className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 6 }}><Sparkles size={15} duo aria-hidden="true" /> How it fits you</span><b>{match.percent}% match</b></h3>
              <ul className="jd-reasons">{match.reasons.map((r) => <li key={r.label} className={r.ok === true ? 'ok' : r.ok === false ? 'no' : ''}>{r.ok === true ? '✓' : r.ok === false ? '✗' : '·'} {r.label}</li>)}</ul>
            </section>
          )}

          <section className="sheet-desc" aria-labelledby="sheet-desc-t">
            <h3 id="sheet-desc-t">Job description</h3>
            {desc === undefined ? <div aria-busy="true" className="stack">{[95, 100, 88, 70].map((w) => <div key={w} className="skeleton" style={{ height: 12, width: `${w}%` }} />)}</div>
              : words < 25 ? (
                <div className="sheet-empty">
                  <p className="text-sm">The full description isn’t in Jobly’s data for this job. It’s on the employer’s page.</p>
                  {applyUrl && <a className="btn btn-outline btn-sm" href={applyUrl} target="_blank" rel="noopener noreferrer">Read it on {host || 'the posting'} <ExternalLink size={13} aria-hidden="true" /></a>}
                </div>
              ) : (
                <div className="jd-text">
                  {blocks.map((b, i) => b.kind === 'h' ? <h4 key={i}>{b.text}</h4> : b.kind === 'ul' ? <ul key={i}>{b.items.map((t, k) => <li key={k}>{t}</li>)}</ul> : <p key={i}>{b.text}</p>)}
                </div>
              )}
          </section>
        </div>

        <div className="sheet-foot">
          {applyUrl
            ? <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="btn sheet-apply" onClick={() => tracker?.noteApplyClick(job)} aria-label={`Apply to ${job.title} at ${job.company_name}${host ? ` (opens ${host})` : ''}`}>Apply <ExternalLink size={14} aria-hidden="true" /></a>
            : <span className="btn btn-secondary sheet-apply" aria-disabled="true">Link unavailable</span>}
          <QueueButton job={job} size="md" onNote={say} />
          <button type="button" className={`btn ${job.is_saved ? 'btn-toggled' : 'btn-outline'}`} onClick={() => onToggleSave(job)} aria-pressed={job.is_saved}
            aria-label={`${job.is_saved ? 'Remove from saved' : 'Save'}: ${job.title} at ${job.company_name}`}>
            {job.is_saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />} {job.is_saved ? 'Saved' : 'Save'}</button>
        </div>
      </div>
      {report && <ReportModal job={job} onClose={() => setReport(false)} />}
    </div>,
    document.body,
  );
};
