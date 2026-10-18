// Marks the table-of-contents link of the section currently on screen.
const toc = document.querySelector<HTMLElement>('[data-toc]');
if (toc) {
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const targets = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter((el): el is HTMLElement => !!el);
  const mark = (id: string) => links.forEach((a) => a.setAttribute('aria-current', String(a.hash.slice(1) === id)));
  const seen = new Map<string, boolean>();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) seen.set(e.target.id, e.isIntersecting);
    const first = targets.find((t) => seen.get(t.id));
    if (first) mark(first.id);
  }, { rootMargin: '-80px 0px -65% 0px' });
  targets.forEach((t) => io.observe(t));
}
