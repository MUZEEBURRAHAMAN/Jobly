import React, { useState } from 'react';
import { Bookmark, Search, X, Radio } from 'lucide-react';
import { Job } from '../types';
import { JobCard } from './JobCard';

interface SavedJobsViewProps {
  savedJobs: Job[];
  onToggleSave: (job: Job) => void;
  onBrowseJobs: () => void;
}

export const SavedJobsView: React.FC<SavedJobsViewProps> = ({
  savedJobs,
  onToggleSave,
  onBrowseJobs,
}) => {
  const [search, setSearch] = useState('');

  const filteredSaved = savedJobs.filter((j) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const corpus = `${j.title} ${j.company_name} ${j.location || ''} ${j.normalized_role || ''}`.toLowerCase();
    return corpus.includes(q);
  });

  return (
    <div style={{ padding: '16px', width: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <span className="eyebrow">BOOKMARKED SHORTLIST</span>
        <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.01em', marginTop: 2, color: 'var(--text-primary)' }}>
          Saved Positions ({savedJobs.length})
        </h3>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Your high-priority shortlist for direct applications
        </p>
      </div>

      {/* Search Input when savedJobs > 1 */}
      {savedJobs.length > 1 && (
        <div style={{ position: 'relative', marginBottom: 10, width: '100%' }}>
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            className="input-text"
            placeholder="Search saved positions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 30, paddingRight: search ? 30 : 12, fontSize: 12, height: 34, width: '100%' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 2,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {savedJobs.length === 0 ? (
        // Edge Case 1: Shortlist is empty
        <div style={{
          textAlign: 'center',
          padding: '44px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Bookmark size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
            SHORTLIST EMPTY
          </span>
          <h4 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4, color: 'var(--text-primary)' }}>
            No Bookmarked Opportunities
          </h4>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', maxWidth: 280, margin: '0 auto 14px', lineHeight: 1.4 }}>
            Click the "SAVE" button on any card in the radar stream to pin positions here for active tracking.
          </p>
          <button onClick={onBrowseJobs} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
            <Radio size={12} />
            <span>BROWSE RADAR MATCHES</span>
          </button>
        </div>
      ) : filteredSaved.length === 0 ? (
        // Edge Case 2: Search in saved jobs returned 0
        <div style={{
          textAlign: 'center',
          padding: '36px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Search size={22} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <span className="eyebrow" style={{ fontSize: 9.5, color: 'var(--accent)', display: 'block', marginBottom: 4 }}>
            0 SHORTLIST MATCHES
          </span>
          <h4 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4, color: 'var(--text-primary)' }}>
            No Saved Jobs Match "{search.trim()}"
          </h4>
          <p style={{ fontSize: 11.5, color: 'var(--text-muted)', maxWidth: 260, margin: '0 auto 14px', lineHeight: 1.4 }}>
            None of your {savedJobs.length} bookmarked opportunities contain this keyword.
          </p>
          <button onClick={() => setSearch('')} className="btn btn-secondary btn-sm" style={{ gap: 6 }}>
            <X size={12} />
            <span>CLEAR SEARCH</span>
          </button>
        </div>
      ) : (
        filteredSaved.map((job) => (
          <JobCard key={`saved-${job.source_type}-${job.external_id}`} job={job} onToggleSave={onToggleSave} />
        ))
      )}
    </div>
  );
};
