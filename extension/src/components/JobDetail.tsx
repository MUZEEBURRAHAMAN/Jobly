import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Briefcase, Clock, ExternalLink, Flag, MapPin, Share2, Sparkles, X } from '../lib/icons';
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
const PREVIEW = 900;

/** The selected job on the wide Jobs page: what it is, why it fits, its description, and every action. */
export const JobDetail: React.FC<{ job: Job; onToggleSave: (job: Job) => void; onClose: () => void }> = ({ job, onToggleSave, onClose }) => {
  const [desc, setDesc] = useState<string | null | undefined>(undefined);
  const [more, setMore] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [report, setReport] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const tracker = useTrackerContext();
  const { prefs, skills } = useMatch();
  const match = React.useMemo(() => matchScore(job, prefs, skills), [job, prefs, skills]);
  const applyUrl = safeHttpUrl(job.application_url);
  const host = hostOf(job.application_url);

  useEffect(() => {
    let live = true;
    setDesc(undefined); setMore(false); setImgFailed(false);
    if (job.description) { setDesc(job.description); return; }
    jobData.description(job.id).then((d) => { if (live) setDesc(d); }, () => { if (live) setDesc(null); });
    return () => { live = false; };
  }, [job.id, job.description]);

  const say = (m: string) => { setNote(m); window.setTimeout(() => setNote(null), 2500); };
  const share = async () => {
    if (!applyUrl) return;
    try { await navigator.clipboard.writeText(applyUrl); say('Link copied'); } catch { say("Couldn't copy"); }
  };
  const posted = job.posted_at ? timeAgo(job.posted_at) : '';
  const salary = job.salary_summary?.split('•')[0].trim();
  const text = desc ?? '';
  const long = text.length > PREVIEW;

  return (
    <aside className="job-detail" aria-label={`${job.title} at ${job.company_name}`}>
      <div className="jd-hero">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="logo" aria-hidden="true">{imgFailed ? <span className="logo-fallback">{job.company_name.slice(0, 1).toUpperCase()}</span> : <img src={getCompanyLogoUrl(job.company_name)} alt="" onError={() => setImgFailed(true)} />}</span>
            <span className="jd-company">{job.company_name}</span>
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-icon jd-close" onClick={onClose} aria-label="Close job details" title="Close"><X size={16} aria-hidden="true" /></button>
        </div>
        <h2 className="jd-title">{job.title}</h2>
        <div className="jd-facts">
          {job.location && <span><MapPin size={14} aria-hidden="true" /> {job.location}</span>}
          {job.work_mode && WORK_MODE[job.work_mode] && <span>{WORK_MODE[job.work_mode]}</span>}
          {salary && <span><Briefcase size={14} aria-hidden="true" /> {salary}</span>}
          {job.employment_type && EMPLOYMENT_LABELS[job.employment_type] && <span>{EMPLOYMENT_LABELS[job.employment_type]}</span>}
          {posted && <span><Clock size={14} aria-hidden="true" /> Posted {posted.toLowerCase()}</span>}
        </div>
      </div>

      <div className="jd-actions">
        {applyUrl
          ? <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="btn" onClick={() => tracker?.noteApplyClick(job)} aria-label={`Apply to ${job.title} at ${job.company_name}${host ? ` (opens ${host})` : ''}`}>Apply <ExternalLink size={14} aria-hidden="true" /></a>
          : <span className="btn btn-secondary" aria-disabled="true">Link unavailable</span>}
        <QueueButton job={job} size="md" onNote={say} />
        <button type="button" className={`btn ${job.is_saved ? 'btn-toggled' : 'btn-outline'}`} onClick={() => onToggleSave(job)} aria-pressed={job.is_saved} aria-label={`${job.is_saved ? 'Remove from saved' : 'Save'}: ${job.title} at ${job.company_name}`}>
          {job.is_saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />} {job.is_saved ? 'Saved' : 'Save'}</button>
        <span className="grow" />
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => void share()} disabled={!applyUrl} title="Copy link" aria-label={`Share: ${job.title}`}><Share2 size={16} aria-hidden="true" /></button>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setReport(true)} title="Report this listing" aria-label={`Report: ${job.title}`}><Flag size={16} aria-hidden="true" /></button>
      </div>
      <span role="status" className="text-xs muted">{note}</span>

      {match && (
        <section className="jd-box" aria-labelledby="jd-match">
          <h3 id="jd-match" className="row" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 6 }}><Sparkles size={14} duo aria-hidden="true" /> How it fits you</span><b>{match.percent}%</b></h3>
          <ul className="jd-reasons">{match.reasons.map((r) => <li key={r.label} className={r.ok === true ? 'ok' : r.ok === false ? 'no' : ''}>{r.ok === true ? '✓' : r.ok === false ? '✗' : '·'} {r.label}</li>)}</ul>
        </section>
      )}

      <section className="jd-box" aria-labelledby="jd-facts-t">
        <h3 id="jd-facts-t">Details</h3>
        <dl className="jd-dl">
          <div><dt>Pay</dt><dd>{job.salary_summary || 'Not stated'}</dd></div>
          <div><dt>Level</dt><dd>{(job.experience_tier && EXPERIENCE_LABELS[job.experience_tier]) || 'Not stated'}</dd></div>
          <div><dt>Applies on</dt><dd>{BOARD_NAMES[job.source_type] ?? host ?? 'The company site'}</dd></div>
        </dl>
      </section>

      <section className="jd-desc" aria-labelledby="jd-desc-t">
        <h3 id="jd-desc-t">About the job</h3>
        {desc === undefined ? <div aria-busy="true" className="stack">{[90, 100, 70].map((w) => <div key={w} className="skeleton" style={{ height: 12, width: `${w}%` }} />)}</div>
          : !text ? <p className="text-sm muted">The description isn’t in Jobly’s data. Open the posting to read it.</p>
          : <>
            <div className="jd-text">{(more || !long ? text : `${text.slice(0, PREVIEW).trimEnd()}…`).split(/\n{2,}|\n(?=[-•*])/).map((para, i) => <p key={i}>{para}</p>)}</div>
            {long && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? 'Show less' : 'Show the full description'}</button>}
          </>}
      </section>
      {report && <ReportModal job={job} onClose={() => setReport(false)} />}
    </aside>
  );
};
