// Hash routes, so the app works from any static host (and offline) with no server rewrites.
import { useSyncExternalStore } from 'react';

export type Route =
  | { page: 'dashboard' } | { page: 'profile' } | { page: 'resume' } | { page: 'applications' }
  | { page: 'new' } | { page: 'application'; id: string } | { page: 'jobs' } | { page: 'settings' };

export function parse(hash: string): Route {
  const [, a = '', b = ''] = hash.replace(/^#/, '').split('/');
  switch (a) {
    case 'profile': return { page: 'profile' };
    case 'resume': return { page: 'resume' };
    case 'applications': return { page: 'applications' };
    case 'new': return { page: 'new' };
    case 'app': return b ? { page: 'application', id: decodeURIComponent(b) } : { page: 'applications' };
    case 'jobs': return { page: 'jobs' };
    case 'settings': return { page: 'settings' };
    default: return { page: 'dashboard' };
  }
}

export const href = (r: Route): string => (r.page === 'dashboard' ? '#/' : r.page === 'application' ? `#/app/${encodeURIComponent(r.id)}` : `#/${r.page}`);

export function go(r: Route): void { location.hash = href(r); }

let hash = location.hash;
export function useRoute(): Route {
  const h = useSyncExternalStore((l) => {
    const on = () => { hash = location.hash; l(); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, () => hash);
  return parse(h);
}
