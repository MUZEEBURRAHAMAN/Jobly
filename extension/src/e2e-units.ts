// Entry point used only by the browser tests (e2e/suite.mjs) to run page reading and the fit check inside a real page.
export { extractJobFromPage } from './lib/pageJob';
export { fitCheck, asksFor } from './lib/fit';
export { analyzeJob } from './lib/tailor';
export { emptyProfile, skillList, skillsText, bulletList } from './lib/profile';
export { resumeHtml } from './lib/resume';
export { scanForm, fillForm, proposeAnswers } from './lib/autofill';
export { findContacts, companyDomain } from './lib/integrations';
export { searchProfiles, apolloPeople, parseTitle, sitesFor } from './lib/profileSearch';
export { atsScan } from './lib/atsScan';
export { resumeScore } from './lib/resumeScore';
