import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { Job } from '../types';
import { JobCard } from './JobCard';
import { EmptyState } from './EmptyState';

interface SavedJobsViewProps {
  savedJobs: Job[];
  onToggleSave: (job: Job) => void;
  onBrowseJobs: () => void;
  large?: boolean;
}

export const SavedJobsView: React.FC<SavedJobsViewProps> = ({ savedJobs, onToggleSave, onBrowseJobs, large }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = savedJobs.filter((j) => !q || `${j.title} ${j.company_name} ${j.location || ''}`.toLowerCase().includes(q));

  if (savedJobs.length === 0) {
    return <EmptyState art="saved" large={large} title="Nothing saved yet" description="Tap Save on any job to keep it here for later. Saved jobs stay on this device."
      actions={<button type="button" className="btn" onClick={onBrowseJobs}>Browse jobs</button>} />;
  }
  return (
    <div className="section">
      <div><h2>Saved jobs</h2><p className="text-sm">{savedJobs.length} saved</p></div>
      <div className="search"><Search size={16} aria-hidden="true" /><input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search saved jobs…" aria-label="Search saved jobs" /></div>
      {list.length === 0 ? (
        <EmptyState art="search" large={large} title={`No saved jobs match "${query}"`} actions={<button type="button" className="btn" onClick={() => setQuery('')}>Clear search</button>} />
      ) : (
        <div className={large ? 'list grid' : undefined} style={large ? { padding: 0 } : undefined}>{list.map((job) => <JobCard key={job.id} job={job} onToggleSave={onToggleSave} />)}</div>
      )}
    </div>
  );
};
