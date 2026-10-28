// "Download PDF" = the browser's own print-to-PDF: real, selectable text, exact page size, nothing uploaded.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { ReactElement } from 'react';

export function printDocument(node: ReactElement, fileTitle: string, paper: 'a4' | 'letter'): void {
  const host = document.getElementById('print-root')!;
  const root = createRoot(host);
  flushSync(() => root.render(node));
  const page = document.createElement('style');
  page.textContent = `@page { size: ${paper === 'letter' ? 'letter' : 'A4'}; margin: 0; }`;
  document.head.append(page);
  const title = document.title;
  // The PDF's suggested file name comes from the document title.
  document.title = fileTitle;
  const done = () => {
    document.title = title;
    page.remove();
    root.unmount();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // Fonts must be ready, or the first print can fall back to a system font.
  document.fonts.ready.then(() => window.print());
}

export const fileName = (...parts: string[]) => parts.filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, '').slice(0, 120);
