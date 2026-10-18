// Where Jobly's listings come from. Career pages are read directly from the employer's hiring system;
// job boards are remote-job sites whose listings link back to the employer.
export const SOURCES: Record<string, { label: string; kind: 'career' | 'board'; field: string; note: string }> = {
  greenhouse: { label: 'Greenhouse', kind: 'career', field: 'first_published (falls back to updated_at)', note: 'When the job was first published on the careers page' },
  ashby: { label: 'Ashby', kind: 'career', field: 'publishedAt', note: 'When the employer published the job' },
  lever: { label: 'Lever', kind: 'career', field: 'createdAt', note: 'When the posting was created' },
  workday: { label: 'Workday', kind: 'career', field: 'postedOn', note: 'Text such as “Posted 3 Days Ago”, turned into a date' },
  amazon: { label: 'Amazon Jobs', kind: 'career', field: 'updated_time (falls back to posted_date)', note: 'Amazon’s own date for the posting' },
  custom: { label: 'Careers page', kind: 'career', field: 'datePosted (JSON-LD)', note: 'The structured date many careers pages publish for search engines' },
  weworkremotely: { label: 'We Work Remotely', kind: 'board', field: 'published (RSS)', note: 'When the board published the listing' },
  remotive: { label: 'Remotive', kind: 'board', field: 'publication_date', note: 'When the board published the listing' },
  himalayas: { label: 'Himalayas', kind: 'board', field: 'created_at', note: 'When the listing was created' },
  arbeitnow: { label: 'Arbeitnow', kind: 'board', field: 'created_at', note: 'When the listing was created' },
};
export const sourceLabel = (t: string) => SOURCES[t]?.label ?? t;
