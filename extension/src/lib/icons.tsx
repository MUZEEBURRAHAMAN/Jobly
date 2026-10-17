// Hugeicons (free Stroke Rounded set, MIT) as small React components with the same names the app used before.
// Outline by default; `duo` adds a soft second tone (a light fill of the icon colour on closed shapes).
import React from 'react';
import {
  SquareArrowUpRightIcon, Cancel01Icon, FilterHorizontalIcon, Search01Icon, Tick02Icon, Bookmark02Icon, Sun03Icon,
  RefreshIcon, Moon02Icon, Building06Icon, Briefcase01Icon, SparklesIcon, Share08Icon, FloppyDiskIcon, ArrowTurnBackwardIcon,
  Add01Icon, Location01Icon, Flag02Icon, CheckmarkCircle02Icon, BookmarkCheck02Icon, Notification03Icon, ArrowRight01Icon,
  ArrowLeft01Icon, ChromeIcon,
} from '@hugeicons/core-free-icons';

type Node = readonly [string, Readonly<Record<string, string | number>>];
export interface IconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> { size?: number; duo?: boolean }

const camel = (k: string) => k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
const closed = (tag: string, a: Readonly<Record<string, string | number>>) =>
  ['circle', 'rect', 'ellipse', 'polygon'].includes(tag) || (tag === 'path' && /z\s*$/i.test(String(a.d ?? '')));

function make(data: readonly Node[], name: string) {
  const C = ({ size = 16, duo = false, className, ...rest }: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none"
      className={['hi', duo ? 'hi-duo' : '', className].filter(Boolean).join(' ')} focusable="false" {...rest}>
      {data.map(([tag, attrs], i) => {
        const props: Record<string, unknown> = { key: i };
        for (const [k, v] of Object.entries(attrs)) if (k !== 'key') props[camel(k)] = v;
        if (duo && closed(tag, attrs)) props.className = 'hi-tone';
        return React.createElement(tag, props);
      })}
    </svg>
  );
  C.displayName = name;
  return C;
}

const n = (d: unknown) => d as readonly Node[];
export const ExternalLink = make(n(SquareArrowUpRightIcon), 'ExternalLink');
export const X = make(n(Cancel01Icon), 'X');
export const SlidersHorizontal = make(n(FilterHorizontalIcon), 'SlidersHorizontal');
export const Search = make(n(Search01Icon), 'Search');
export const Check = make(n(Tick02Icon), 'Check');
export const Bookmark = make(n(Bookmark02Icon), 'Bookmark');
export const Sun = make(n(Sun03Icon), 'Sun');
export const RefreshCw = make(n(RefreshIcon), 'RefreshCw');
export const Moon = make(n(Moon02Icon), 'Moon');
export const Building2 = make(n(Building06Icon), 'Building2');
export const Briefcase = make(n(Briefcase01Icon), 'Briefcase');
export const Sparkles = make(n(SparklesIcon), 'Sparkles');
export const Share2 = make(n(Share08Icon), 'Share2');
export const Save = make(n(FloppyDiskIcon), 'Save');
export const RotateCcw = make(n(ArrowTurnBackwardIcon), 'RotateCcw');
export const Plus = make(n(Add01Icon), 'Plus');
export const MapPin = make(n(Location01Icon), 'MapPin');
export const Flag = make(n(Flag02Icon), 'Flag');
export const CheckCircle2 = make(n(CheckmarkCircle02Icon), 'CheckCircle2');
export const BookmarkCheck = make(n(BookmarkCheck02Icon), 'BookmarkCheck');
export const Bell = make(n(Notification03Icon), 'Bell');
export const ArrowRight = make(n(ArrowRight01Icon), 'ArrowRight');
export const ArrowLeft = make(n(ArrowLeft01Icon), 'ArrowLeft');
export const Chrome = make(n(ChromeIcon), 'Chrome');
export type IconComponent = ReturnType<typeof make>;
