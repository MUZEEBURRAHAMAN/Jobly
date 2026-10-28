import { useEffect } from 'react';
import { HandoffModal } from './components/HandoffModal';
import { Icon } from './components/Icon';
import { Toasts } from './components/ui';
import { aiConfigured } from './lib/ai/run';
import { href, useRoute, type Route } from './lib/router';
import { useReady, useSaveError, useStudio } from './lib/store';
import { ApplicationPage } from './pages/Application';
import { Applications } from './pages/Applications';
import { Dashboard } from './pages/Dashboard';
import { FindJobs } from './pages/FindJobs';
import { NewApplication } from './pages/NewApplication';
import { ProfilePage } from './pages/Profile';
import { ResumePage } from './pages/Resume';
import { SettingsPage } from './pages/Settings';
import { Welcome } from './pages/Welcome';

const NAV: { route: Route; label: string; icon: string }[] = [
  { route: { page: 'dashboard' }, label: 'Dashboard', icon: 'home' },
  { route: { page: 'new' }, label: 'New application', icon: 'plus' },
  { route: { page: 'applications' }, label: 'Applications', icon: 'board' },
  { route: { page: 'jobs' }, label: 'Find jobs', icon: 'search' },
  { route: { page: 'profile' }, label: 'Profile', icon: 'user' },
  { route: { page: 'resume' }, label: 'Base resume', icon: 'file' },
  { route: { page: 'settings' }, label: 'Settings', icon: 'settings' },
];

function useTheme() {
  const theme = useStudio((s) => s.settings.theme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
    };
    apply();
    try { localStorage.setItem('studio-theme', theme); } catch { /* storage blocked: theme still applies */ }
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export function App() {
  useTheme();
  const ready = useReady();
  const route = useRoute();
  const onboarded = useStudio((s) => s.settings.onboarded);
  const ai = useStudio((s) => s.settings.ai);
  const saveError = useSaveError();

  useEffect(() => { window.scrollTo(0, 0); }, [route.page, route.page === 'application' ? route.id : '']);

  if (!ready) return null;
  if (!onboarded) return <><Welcome /><HandoffModal /><Toasts /></>;

  const active = route.page === 'application' ? 'applications' : route.page;
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="#/">
          <img src="/icon-128.png" alt="" />
          <span>Jobly Studio<small>Apply smarter</small></span>
        </a>
        <nav className="nav" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.label} href={href(n.route)} aria-current={n.route.page === active ? 'page' : undefined}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-foot small muted">
          <span className="row"><Icon name="lock" /> Saved in this browser only</span>
          <span>{ai.provider === 'none' || !aiConfigured(ai) ? 'AI: write with Claude' : `AI: ${ai.model}`}</span>
        </div>
      </aside>
      <main className="main" id="main">
        {saveError && <div className="banner" role="alert">{saveError}</div>}
        {route.page === 'dashboard' && <Dashboard />}
        {route.page === 'profile' && <ProfilePage />}
        {route.page === 'resume' && <ResumePage />}
        {route.page === 'applications' && <Applications />}
        {route.page === 'new' && <NewApplication />}
        {route.page === 'application' && <ApplicationPage id={route.id} />}
        {route.page === 'jobs' && <FindJobs />}
        {route.page === 'settings' && <SettingsPage />}
      </main>
      <HandoffModal />
      <Toasts />
    </div>
  );
}
