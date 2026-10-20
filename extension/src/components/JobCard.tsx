import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, Flag, MapPin, Share2, Sparkles } from '../lib/icons';
import { ReportModal } from './ReportModal';
import { Job } from '../types';
import { getCompanyLogoUrl } from '../lib/companyLogos';
import { hostOf, safeHttpUrl } from '../lib/url';
import { BOARD_NAMES, EXPERIENCE_LABELS, timeAgo } from '../lib/format';

interface JobCardProps {
  job: Job;
  onToggleSave: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onToggleSave }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const applyUrl = safeHttpUrl(job.application_url); // third-party data: never render javascript:/data: links
  const applyHost = hostOf(job.application_url);

  const handleShare = async () => {
    if (!applyUrl) return;
    const data = { title: job.title, text: `${job.title} at ${job.company_name}`, url: applyUrl };
    try {
      if (navigator.share && navigator.canShare?.(data)) await navigator.share(data);
      else { await navigator.clipboard.writeText(applyUrl); setShareNote('Link copied'); }
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') setShareNote("Couldn't copy");
    }
    window.setTimeout(() => setShareNote(null), 2000);
  };

  const place = job.location || null;
  const posted = job.posted_at ? timeAgo(job.posted_at) : '';

  return (
    <article className="card job" aria-label={`${job.title} at ${job.company_name}`}>
      <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="logo" aria-hidden="true">
          {!imgFailed ? (
            <img src={getCompanyLogoUrl(job.company_name)} alt="" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <span className="logo-fallback">{job.company_name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        <div className="grow">
          <h3 className="break" style={{ fontSize: 'var(--text-lg)', lineHeight: 'var(--leading-lg)' }}>{job.title}</h3>
          <p className="text-sm break">
            {job.company_name}
            {place && <> · <MapPin size={12} style={{ verticalAlign: '-1px' }} aria-hidden="true" /> {place}</>}
          </p>
        </div>
        {posted && <span className="text-xs muted" style={{ flex: 'none' }}>{posted}</span>}
      </div>

      <div className="row wrap" style={{ gap: 6 }}>
        {job.is_match && <span className="badge badge-brand"><Sparkles size={12} duo aria-hidden="true" /> Matches you</span>}
        {job.work_mode === 'remote' && <span className="badge badge-success">Remote</span>}
        {job.experience_tier && EXPERIENCE_LABELS[job.experience_tier] && <span className="badge badge-outline">{EXPERIENCE_LABELS[job.experience_tier]}</span>}
        {job.salary_summary && <span className="badge badge-outline">{job.salary_summary.split('•')[0].trim()}</span>}
        {BOARD_NAMES[job.source_type] && <span className="badge badge-outline">via {BOARD_NAMES[job.source_type]}</span>}
      </div>

      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <div className="row" style={{ gap: 4 }}>
          <button
            type="button"
            className={`btn btn-sm ${job.is_saved ? 'btn-toggled' : 'btn-outline'}`}
            onClick={() => onToggleSave(job)}
            aria-pressed={job.is_saved}
            aria-label={`${job.is_saved ? 'Remove from saved' : 'Save'}: ${job.title} at ${job.company_name}`}
          >
            {job.is_saved ? <BookmarkCheck size={14} aria-hidden="true" /> : <Bookmark size={14} aria-hidden="true" />}
            {job.is_saved ? 'Saved' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={handleShare} disabled={!applyUrl} title="Copy link" aria-label={`Share: ${job.title}`}>
            <Share2 size={14} aria-hidden="true" />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setShowReport(true)} title="Report this listing" aria-label={`Report: ${job.title}`}>
            <Flag size={14} aria-hidden="true" />
          </button>
          <span role="status" className="text-xs muted">{shareNote}</span>
        </div>
        {applyUrl ? (
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm"
            title={applyHost ? `Opens ${applyHost}` : undefined}
            aria-label={`Apply to ${job.title} at ${job.company_name}${applyHost ? ` (opens ${applyHost})` : ''}`}
          >
            Apply <ExternalLink size={14} aria-hidden="true" />
          </a>
        ) : (
          <span className="btn btn-secondary btn-sm" aria-disabled="true">Link unavailable</span>
        )}
      </div>

      {showReport && <ReportModal job={job} onClose={() => setShowReport(false)} />}
    </article>
  );
};
