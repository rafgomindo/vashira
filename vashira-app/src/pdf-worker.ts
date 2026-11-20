/**
 * Utility-process entry for PDF text extraction (forked by indexer.ts via
 * Electron's utilityProcess), so parsing a 300-page book never blocks the
 * main process that serves IPC to the UI. Built as .vite/build/pdf-worker.js.
 */
import fs from 'node:fs';
import { extractPdfPages } from './pdf-text';

const port = (process as any).parentPort;

port.on('message', async (event: any) => {
  const { id, filePath } = event.data || {};
  try {
    const data = new Uint8Array(await fs.promises.readFile(filePath));
    const pages = await extractPdfPages(data);
    port.postMessage({ id, pages });
  } catch (e: any) {
    port.postMessage({ id, error: e?.message || String(e) });
  }
});
