import React, { useState } from 'react';
import { Bookmark, BookmarkCheck, ExternalLink, MapPin, Globe, Sparkles, DollarSign, Briefcase, Share2, Flag } from 'lucide-react';
import { ReportModal } from './ReportModal';
import { Job } from '../types';
import { getCompanyLogoUrl } from '../lib/companyLogos';

interface JobCardProps {
  job: Job;
  onToggleSave: (job: Job) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onToggleSave }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const formatRelativeTime = (isoString: string) => {
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 1) return 'JUST NOW';
      if (hours < 24) return `${hours}H AGO`;
      const days = Math.floor(hours / 24);
      return `${days}D AGO`;
    } catch {
      return 'RECENT';
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = { title: job.title, text: `${job.title} at ${job.company_name}`, url: job.application_url };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(job.application_url);
    }
  };

  const getSourceBadgeClass = (source: string) => {
    switch (source.toLowerCase()) {
      case 'ashby':
        return 'badge-violet';
      case 'greenhouse':
        return 'badge-green';
      case 'lever':
        return 'badge-accent';
      case 'workday':
        return 'badge-orange';
      default:
        return 'badge-gray';
    }
  };

  const getGeoHubLabel = (hub: string | undefined | null) => {
    switch (hub) {
      case 'india':
        return 'INDIA';
      case 'us':
        return 'US & CAN';
      case 'europe':
        return 'EUROPE';
      case 'apac':
        return 'APAC';
      default:
        return null;
    }
  };

  const logoUrl = getCompanyLogoUrl(job.company_name);

  return (
    <div className={`radar-card ${job.is_match ? 'featured-card' : ''}`} style={{ marginBottom: 12, width: '100%' }}>
      {/* Top Section: Real Company Logo, Job Title & Metadata */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        {/* Real Company Website Logo (like Weekdays) */}
        <div style={{
          width: 36,
          height: 36,
          minWidth: 36,
          background: '#ffffff',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          padding: 3,
        }}>
          {!imgFailed ? (
            <img
              src={logoUrl}
              alt={job.company_name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={() => setImgFailed(true)}
              loading="lazy"
            />
          ) : (
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontWeight: 800,
              fontSize: 13,
              color: 'var(--accent)',
              background: 'var(--bg-secondary)',
            }}>
              {job.company_name.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        {/* Title, Company & Time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{
              fontSize: 14.5,
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '-0.015em',
              color: 'var(--text-primary)',
              margin: 0,
            }}>
              {job.title}
            </h3>

            <span style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-muted)',
              letterSpacing: '0.04em',
              whiteSpace: 'nowrap',
              marginTop: 2,
            }}>
              {formatRelativeTime(job.first_seen_at)}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
            }}>
              {job.company_name}
            </span>
            <span className={`badge ${getSourceBadgeClass(job.source_type)}`} style={{ fontSize: 8.5, padding: '1px 5px' }}>
              {job.source_type}
            </span>
          </div>
        </div>
      </div>

      {/* Badges: Salary, Radar Match, Experience, Hub/Location (Zero Emojis, Real SVG Icons) */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {/* Verified Salary Disclosure */}
        {job.salary_summary && (
          <span className="badge badge-green" style={{ fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={11} strokeWidth={2.4} />
            <span>{job.salary_summary.replace(/^[💰$]\s*/, '')}</span>
          </span>
        )}

        {/* Match Badge */}
        {job.is_match && (
          <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Sparkles size={10} />
            <span>MATCH</span>
          </span>
        )}

        {/* Experience Tier */}
        {job.experience_tier && (
          <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Briefcase size={10} />
            <span>{job.experience_tier}Y EXP</span>
          </span>
        )}

        {/* Geographic Hub (Clean Text + MapPin) */}
        {getGeoHubLabel(job.geo_hub) && (
          <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <MapPin size={10} />
            <span>{getGeoHubLabel(job.geo_hub)}</span>
          </span>
        )}

        {/* Work Mode */}
        <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {job.work_mode === 'remote' ? (
            <>
              <Globe size={10} color="var(--green)" />
              <span style={{ color: 'var(--green)' }}>REMOTE</span>
            </>
          ) : (
            <>
              <MapPin size={10} />
              <span>{job.location ? job.location.toUpperCase() : 'ON-SITE'}</span>
            </>
          )}
        </span>
      </div>

      {/* Action Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 10,
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Save — text + icon */}
          <button
            onClick={() => onToggleSave(job)}
            className="btn btn-secondary btn-sm"
            style={{
              color: job.is_saved ? 'var(--accent)' : 'var(--text-primary)',
              borderColor: job.is_saved ? 'var(--accent)' : 'var(--border-subtle)',
              background: job.is_saved ? 'var(--accent-soft)' : 'transparent',
              fontSize: 10.5,
              padding: '4px 8px',
              gap: 4,
              fontFamily: 'var(--font-mono)'
            }}
            title={job.is_saved ? 'Remove from saved' : 'Save opportunity'}
          >
            {job.is_saved ? <BookmarkCheck size={12} color="var(--accent)" /> : <Bookmark size={12} />}
            <span>{job.is_saved ? 'SAVED' : 'SAVE'}</span>
          </button>

          {/* Share — icon only */}
          <button
            onClick={handleShare}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 7px', color: 'var(--text-muted)' }}
            title="Share this job"
            aria-label="Share"
          >
            <Share2 size={13} />
          </button>

          {/* Report — icon only */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowReport(true); }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 7px', color: 'var(--text-muted)' }}
            title="Report this listing"
            aria-label="Report"
          >
            <Flag size={13} />
          </button>
        </div>

        <a
          href={job.application_url}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary btn-sm"
          style={{ textDecoration: 'none', gap: 6 }}
        >
          <span>APPLY DIRECT</span>
          <ExternalLink size={12} />
        </a>
      </div>

      {/* Report Modal */}
      {showReport && <ReportModal job={job} onClose={() => setShowReport(false)} />}
    </div>
  );
};
