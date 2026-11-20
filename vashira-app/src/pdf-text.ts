/**
 * Sovereign Text Extraction (v10.2)
 * Real per-page text from PDFs via pdf.js. Replaces the old raw-bytes "strings"
 * extractor, which captured PDF object syntax instead of the page text on any
 * compressed PDF — i.e. nearly all of them.
 *
 * Pure function, no Electron dependency: runs inside the utility process
 * (pdf-worker.ts) in the app, and in-process for headless use/tests.
 */

const MAX_PAGES = 2000;

export type PdfHints = { infoTitle: string; infoAuthor: string; numPages: number; text: string };

/** Quick look at a PDF for identification: document-info fields + the first pages' text. */
export async function extractPdfHints(data: Uint8Array, pages = 3): Promise<PdfHints> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data, verbosity: 0, isEvalSupported: false, disableFontFace: true }).promise;
  try {
    const meta = await doc.getMetadata().catch(() => null);
    let text = '';
    for (let p = 1; p <= Math.min(doc.numPages, pages); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      for (const item of content.items as any[]) {
        if (typeof item.str === 'string') text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      text += '\n';
      page.cleanup();
    }
    return {
      infoTitle: String(meta?.info?.Title || '').trim(),
      infoAuthor: String(meta?.info?.Author || '').trim(),
      numPages: doc.numPages,
      text: text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim(),
    };
  } finally {
    await doc.destroy();
  }
}

export async function extractPdfPages(data: Uint8Array, maxPages = MAX_PAGES): Promise<string[]> {
  // pdfjs-dist is ESM-only and kept external to the esbuild bundle (see build:main),
  // so it's loaded at runtime from node_modules.
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data,
    verbosity: 0,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  }).promise;

  const pages: string[] = [];
  try {
    const count = Math.min(doc.numPages, maxPages);
    for (let p = 1; p <= count; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items as any[]) {
        if (typeof item.str !== 'string') continue;
        text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim());
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
