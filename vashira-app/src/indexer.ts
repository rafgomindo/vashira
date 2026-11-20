import fs from 'node:fs';
import path from 'node:path';
import { addFullText, setPageText, updateItem, getItemsNeedingTextIndex } from './database';

/**
 * Sovereign Indexer 10.2
 * Extracts real per-page text from PDFs (pdf.js) into the FTS5 `page_text` index,
 * which powers Deep Search and the Oracle's context.
 *
 * Bump TEXT_INDEX_VERSION whenever extraction changes meaningfully: items indexed
 * under an older version are re-indexed in the background on next launch.
 */
export const TEXT_INDEX_VERSION = 1;
const EXTRACT_TIMEOUT_MS = 120_000;
// Below this much text in the whole document we treat it as a scan (needs OCR).
const MIN_TEXT_CHARS = 200;

let worker: any = null;
let nextRequestId = 1;
const pending = new Map<number, { resolve: (pages: string[]) => void; reject: (e: Error) => void; timer: any }>();

/** Fork (once) the utility process that does the parsing; null when not running inside Electron. */
function getWorker() {
  let electron: any;
  try { electron = require('electron'); } catch { return null; }
  if (!electron?.app?.isReady?.() || !electron.utilityProcess) return null;

  if (!worker) {
    worker = electron.utilityProcess.fork(path.join(__dirname, 'pdf-worker.js'), [], { serviceName: 'Vashira PDF Text' });
    worker.on('message', ({ id, pages, error }: any) => {
      const req = pending.get(id);
      if (!req) return;
      pending.delete(id);
      clearTimeout(req.timer);
      if (error) req.reject(new Error(error)); else req.resolve(pages);
    });
    worker.on('exit', () => {
      worker = null;
      for (const [id, req] of pending) {
        clearTimeout(req.timer);
        req.reject(Object.assign(new Error('PDF text worker exited'), { workerCrashed: true }));
        pending.delete(id);
      }
    });
  }
  return worker;
}

async function extractInProcess(filePath: string): Promise<string[]> {
  const { extractPdfPages } = await import('./pdf-text');
  return extractPdfPages(new Uint8Array(await fs.promises.readFile(filePath)));
}

async function extractPages(filePath: string): Promise<string[]> {
  let w: any = null;
  try { w = getWorker(); } catch (e) { console.error('[Deep Search] Could not start PDF text worker:', e); }
  // Headless (tests, vashira-node), or the worker can't start: parse in-process.
  if (!w) return extractInProcess(filePath);
  try {
    return await extractViaWorker(w, filePath);
  } catch (e: any) {
    // A crashed worker says nothing about the PDF — retry in-process rather than
    // marking the file unreadable. Timeouts and real parse errors propagate.
    if (e?.workerCrashed) return extractInProcess(filePath);
    throw e;
  }
}

function extractViaWorker(w: any, filePath: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const id = nextRequestId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      // A wedged parse would block every later request — restart the worker.
      try { w.kill(); } catch { /* already gone */ }
      reject(new Error(`Text extraction timed out: ${path.basename(filePath)}`));
    }, EXTRACT_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    w.postMessage({ id, filePath });
  });
}

export async function indexItemTask(item: any) {
  if (!item?.id || !item.filePath || !item.filePath.toLowerCase().endsWith('.pdf')) return;
  if (!fs.existsSync(item.filePath)) return;

  try {
    const pages = await extractPages(item.filePath);
    const totalChars = pages.reduce((n, p) => n + p.length, 0);

    setPageText(item.id, pages);
    // Legacy flat copy, kept until nothing reads search_index any more.
    addFullText(item.id, pages.join('\n\n').substring(0, 1_000_000));
    updateItem(item.id, {
      masteryStatus: totalChars < MIN_TEXT_CHARS ? 'unreadable' : 'indexed',
      textIndexVersion: TEXT_INDEX_VERSION,
    });
    console.log(`[Deep Search] Indexed ${pages.length} page(s): ${item.title} (${totalChars} chars)`);
  } catch (error) {
    console.error(`[Deep Search] Indexing failed for ${item.title}:`, error);
    // Record the attempt so a broken file isn't retried on every launch.
    updateItem(item.id, { masteryStatus: 'unreadable', textIndexVersion: TEXT_INDEX_VERSION });
  }
}

/** Background pass over every PDF not yet indexed with the current extractor. */
export async function reindexLibrary(onProgress?: (done: number, total: number) => void) {
  const items = getItemsNeedingTextIndex(TEXT_INDEX_VERSION);
  if (items.length === 0) return 0;
  console.log(`[Deep Search] Re-indexing ${items.length} item(s) with extractor v${TEXT_INDEX_VERSION}...`);
  let done = 0;
  onProgress?.(done, items.length);
  for (const item of items) {
    await indexItemTask(item);
    done++;
    onProgress?.(done, items.length);
  }
  return items.length;
}
