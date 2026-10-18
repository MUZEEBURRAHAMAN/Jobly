// Where Jobly's jobs are: the shape of /api/geo, and a build-time copy so the map section has real numbers
// without JavaScript. The browser refreshes them live (scripts/job-map.ts).
import { SITE } from './site';

export type GeoPlace = { name: string; kind: 'hub' | 'country'; country: string; lat: number; lng: number; jobs: number; employers: number; roles: Record<string, number> };
export type GeoCountry = { country: string; jobs: number; employers: number; roles: Record<string, number> };
export type Geo = { total: number; countries: number; employers: number; unplaced: number; roles: Record<string, number>; places: GeoPlace[]; by_country: GeoCountry[] };

export const ROLE_LABELS: Record<string, string> = {
  product_design: 'Product design', frontend_engineering: 'Frontend', product_management: 'Product management', ai_ml: 'AI & ML', fullstack_engineering: 'Fullstack',
};

let cached: Promise<Geo | null> | undefined;
/** Fetched once per build (several pages show the map). Null when the server doesn't answer: the browser then fills it in. */
export function geoAtBuild(): Promise<Geo | null> {
  cached ??= fetch(`${SITE.api}/api/geo`, { signal: AbortSignal.timeout(60000) })
    .then((r) => (r.ok ? (r.json() as Promise<Geo>) : null))
    .then((g) => (g && g.total > 0 ? g : null))
    .catch(() => null);
  return cached;
}
