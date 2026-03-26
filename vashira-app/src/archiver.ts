import { BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';

export async function captureSnapshot(url: string, storagePath: string, itemId: number): Promise<string | null> {
  const fileName = `snapshot_\${itemId}_\${Date.now()}.pdf`;
  const fullPath = path.join(storagePath, fileName);

  return new Promise((resolve) => {
    let win: BrowserWindow | null = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true
      }
    });

    const cleanup = () => {
      if (win) {
        win.destroy();
        win = null;
      }
    };

    const timeout = setTimeout(() => {
      console.warn(`[Archiver] Timeout reached for ${url}`);
      cleanup();
      resolve(null);
    }, 30000);

    win.webContents.on('did-finish-load', async () => {
      try {
        const data = await win!.webContents.printToPDF({
          printBackground: true,
          displayHeaderFooter: false,
          pageSize: 'A4'
        });
        
        fs.writeFileSync(fullPath, data);
        clearTimeout(timeout);
        cleanup();
        resolve(fullPath);
      } catch (e) {
        console.error(`[Archiver] Print failed for ${url}:`, e);
        clearTimeout(timeout);
        cleanup();
        resolve(null);
      }
    });

    win.webContents.on('did-fail-load', () => {
      console.error(`[Archiver] Failed to load ${url}`);
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    });

    win.loadURL(url).catch((e) => {
      console.error(`[Archiver] LoadURL error for ${url}:`, e);
      clearTimeout(timeout);
      cleanup();
      resolve(null);
    });
  });
}
