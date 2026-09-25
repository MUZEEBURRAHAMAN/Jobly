import React from 'react';
import { Bookmark } from 'lucide-react';
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

      {savedJobs.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '44px 20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
        }}>
          <Bookmark size={24} color="var(--accent)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4, color: 'var(--text-primary)' }}>
            No Bookmarked Opportunities
          </h4>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 260, margin: '0 auto 14px' }}>
            Click the "SAVE" button on any card in the radar stream to pin it here.
          </p>
          <button onClick={onBrowseJobs} className="btn btn-primary btn-sm">
            BROWSE RADAR MATCHES
          </button>
        </div>
      ) : (
        savedJobs.map((job) => (
          <JobCard key={`saved-${job.source_type}-${job.external_id}`} job={job} onToggleSave={onToggleSave} />
        ))
      )}
    </div>
  );
};
