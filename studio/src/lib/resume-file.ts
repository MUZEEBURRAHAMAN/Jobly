// Text out of a resume file, in the browser. PDF via pdf.js (loaded only when needed); text and Markdown as is.
export async function readResumeFile(file: File): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error('That file is over 10 MB. Try a smaller PDF, or paste the text.');
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return readPdf(file);
  if (/\.(txt|md|markdown)$/.test(name) || file.type.startsWith('text/')) return file.text();
  throw new Error('Studio reads PDF, .txt and .md files. For Word, copy the text and paste it instead.');
}

async function readPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 10); i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    let lastY: number | null = null;
    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = item.transform[5];
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(line.trim()); line = ''; }
      line += item.str;
      lastY = y;
    }
    lines.push(line.trim());
    pages.push(lines.filter(Boolean).join('\n'));
  }
  const text = pages.join('\n\n').trim();
  if (!text) throw new Error('This PDF has no text layer (it may be a scan). Paste the text instead.');
  return text;
}
