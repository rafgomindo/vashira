import fs from 'node:fs';
import path from 'node:path';
import { extractPdfHints, PdfHints } from './pdf-text';
import { extractDOIFromText, fetchMetadataFromDOI } from './gatherer';
import { translatorService } from './translator-service';
import { normalizeIsbn } from './duplicates';

/**
 * PDF identification (v10.3). Used to read the first 20 KB of raw PDF bytes,
 * which on compressed PDFs is internal PDF syntax — hence titles like
 * "%PDF-1.6" or "/Subtype /Type1". Now, in order of trust:
 *   1. a DOI or ISBN found in the real text of the first pages → online lookup
 *   2. the PDF's own Title/Author fields, when they look like real values
 *   3. the file name ("Author - Title.pdf", "Author_2003_Title.pdf")
 *   4. the first lines of page 1
 */

/** ISBN-10/13 with a valid checksum, from text like "ISBN 978-2-13-041992-2". */
export function findIsbn(text: string): string | null {
  const candidates = text.match(/(?:ISBN(?:-1[03])?[:\s]*)?\b(?:97[89][-\s]?)?\d[\d\s-]{7,15}[\dXx]\b/g) || [];
  for (const c of candidates) {
    const digits = c.replace(/^ISBN(?:-1[03])?[:\s]*/i, '').replace(/[\s-]/g, '').toUpperCase();
    if (digits.length === 13 && /^97[89]\d{10}$/.test(digits)) {
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 ? 3 : 1);
      if ((10 - (sum % 10)) % 10 === Number(digits[12])) return digits;
    } else if (digits.length === 10 && /^\d{9}[\dX]$/.test(digits) && /ISBN/i.test(c)) {
      // Bare 10-digit numbers are too ambiguous; require the "ISBN" label.
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += (digits[i] === 'X' ? 10 : Number(digits[i])) * (10 - i);
      if (sum % 11 === 0) return normalizeIsbn(digits);
    }
  }
  return null;
}

/** Titles that are clearly not titles: PDF internals, binary noise, placeholders. */
export function looksLikeJunkTitle(title?: string | null): boolean {
  const t = (title || '').trim();
  if (t.length < 3) return true;
  if (/�/.test(t) || /[\u0000-\u0008\u000e-\u001f]/.test(t)) return true;
  if (/^%PDF|^\/[A-Z][a-zA-Z]+|^\d{10} \d{5} [nf]\b|^\d+ \d+ obj|endobj|<<|>>/.test(t)) return true;
  if (/^(untitled|imported pdf|document\d*|microsoft word)$/i.test(t)) return true;
  const letters = (t.match(/\p{L}/gu) || []).length;
  return letters / t.length < 0.5;
}

function cleanInfoTitle(t: string): string {
  const cleaned = t.replace(/^Microsoft (Word|PowerPoint) - /i, '').replace(/\.(docx?|pdf|odt|rtf|tex)$/i, '').trim();
  // Publishers often leave the typesetting file name here ("02-096386-Banerjee.qxd",
  // "Aznar-Sánchez_TOGEOGJ"): a real title has at least two words and no file extension.
  if (!/\s/.test(cleaned) || /\.(qxd|indd|tif|eps|ps|dvi)\b/i.test(cleaned) || /_/.test(cleaned)) return '';
  return cleaned;
}

/** "Georges Balandier - Du social par temps incertain" / "Mbembe_2003_Necropolitics_Necropolitica". */
export function parseFileName(fileName: string): { title: string; authors: string; year: string } {
  const base = path.basename(fileName).replace(/\.pdf$/i, '').trim();
  const dash = base.split(/\s+[-–—]\s+/);
  if (dash.length >= 2) {
    return { authors: dash[0].trim(), title: dash.slice(1).join(' - ').trim(), year: '' };
  }
  const parts = base.split(/[_]+/);
  const yearIdx = parts.findIndex(p => /^(1[5-9]\d\d|20\d\d)$/.test(p));
  if (yearIdx > 0 && yearIdx < parts.length - 1) {
    return {
      authors: parts.slice(0, yearIdx).join(' ').replace(/(?<=[a-z])(?=[A-Z])/g, ' ').trim(),
      year: parts[yearIdx],
      title: parts.slice(yearIdx + 1).join(' ').trim(),
    };
  }
  return { title: base.replace(/[_]+/g, ' ').trim(), authors: '', year: '' };
}

/** First plausible title line from page-1 text. */
function titleFromText(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).slice(0, 25);
  for (const l of lines) {
    if (l.length < 8 || l.length > 200) continue;
    if (/^(see discussions|downloaded from|this content downloaded|all use subject|https?:|www\.|doi:|©|copyright|vol\.|volume|issn|isbn|received|accepted|published)/i.test(l)) continue;
    if (/^(open access|research article|original article|review article|article|editorial|short communication|case study|book review|en ligne|artículo)$/i.test(l)) continue;
    // Running headers like "The Open Geography Journal, 2011, 4, 103-114 103".
    if (/(journal|revista|review|revue|quarterly|annals|bulletin)\b.*\d{4}/i.test(l) || (l.match(/\d/g) || []).length > l.length * 0.2) continue;
    if (looksLikeJunkTitle(l)) continue;
    return l;
  }
  return '';
}

export type IdentifiedPdf = { metadata: any; doi: string | null; isbn: string | null; hints: PdfHints | null };

export async function identifyPdf(filePath: string, opts: { online?: boolean } = {}): Promise<IdentifiedPdf> {
  const online = opts.online !== false;
  let hints: PdfHints | null = null;
  try {
    hints = await extractPdfHints(new Uint8Array(await fs.promises.readFile(filePath)));
  } catch (e) {
    console.warn('[Identify] Could not read PDF text:', (e as any)?.message || e);
  }
  const text = hints?.text || '';
  const doi = extractDOIFromText(text) || null;
  const isbn = findIsbn(text);

  let metadata: any = null;
  if (online && doi) {
    try { metadata = await fetchMetadataFromDOI(doi); } catch { /* offline or unknown DOI */ }
  }
  if (online && !metadata && isbn) {
    try { metadata = await translatorService.translate(isbn); } catch { /* offline */ }
  }

  if (!metadata) {
    const fromFile = parseFileName(filePath);
    const infoTitle = cleanInfoTitle(hints?.infoTitle || '');
    const infoAuthor = hints?.infoAuthor || '';
    const fileHasStructure = !!fromFile.authors;
    const title =
      (!looksLikeJunkTitle(infoTitle) && infoTitle.length >= 6 && infoTitle) ||
      (fileHasStructure && fromFile.title) ||
      titleFromText(text) ||
      fromFile.title ||
      'Untitled PDF';
    const authors =
      (infoAuthor && !looksLikeJunkTitle(infoAuthor) && infoAuthor) ||
      fromFile.authors ||
      '';
    const abstract = text.match(/(?:Abstract|Résumé|Resumen)[:.\s]+([\s\S]{80,1200}?)(?:\n\s*\n|Keywords|Mots-clés|Palabras clave|Introduction|$)/i)?.[1]?.replace(/\s+/g, ' ').trim() || '';
    metadata = {
      title,
      authors,
      published: fromFile.year || '',
      itemType: isbn || (hints?.numPages || 0) > 80 ? 'book' : 'document',
      doi: doi || '',
      isbn: isbn || '',
      abstract,
      pages: (hints?.numPages || 0) > 80 ? hints!.numPages : undefined,
    };
  } else {
    if (!metadata.doi && doi) metadata.doi = doi;
    if (!metadata.isbn && isbn) metadata.isbn = isbn;
  }
  return { metadata, doi, isbn, hints };
}
