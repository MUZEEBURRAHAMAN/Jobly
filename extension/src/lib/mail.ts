import { SUPPORT_EMAIL } from './config';

/** A mailto: link to Jobly's support address. Jobly never sends anything itself: the user's email app does. */
export function supportMailto(subject: string, lines: string[]): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

/** Opens the user's email app with a prepared message. */
export function openMail(href: string): void {
  const a = Object.assign(document.createElement('a'), { href, target: '_blank', rel: 'noopener' });
  document.body.appendChild(a); a.click(); a.remove();
}
