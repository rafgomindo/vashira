import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import started from 'electron-squirrel-startup';
import { initDatabase, getItems, addItem, getNotes, addNote, getStoragePath, updateItem, getAnnotations, addAnnotation } from './database.js';
import { StyleStore } from './styles.js';
import { fetchMetadataFromDOI, extractDOIFromURL, extractDOIFromText, extractISBNFromText } from './gatherer.js';
import { parseBibTeX, parseRIS, extractMetadataFromHeuristics, generateBibTeX, categorizeItems } from './parser.js';
import { discoveryEngine } from './discovery.js';
import { captureSnapshot } from './archiver.js';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'hidden', // Modern titlebar
    backgroundColor: '#0d0d12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/index.html'),
    );
  }

  // Open the DevTools if needed for debugging
  // mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', () => {
  initDatabase();
  const styleStore = new StyleStore(app.getPath('userData'));
  
  // IPC Handlers
  ipcMain.handle('get-items', () => getItems());
  ipcMain.handle('add-item', (_, item) => addItem(item));
  ipcMain.handle('get-notes', (_, itemId) => getNotes(itemId));
  ipcMain.handle('add-note', (_, itemId, content) => addNote(itemId, content));
  ipcMain.handle('fetch-metadata', (_, doi) => fetchMetadataFromDOI(doi));
  ipcMain.handle('update-item', (_, id, fields) => updateItem(id, fields));
  
  // Vashira Sentinel: Local Ingest Server (Port 51239)
  const ingestServer = http.createServer((req, res) => {
    // CORS for Extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }

    if (req.method === 'POST' && req.url === '/ingest') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const { fetchMetadataFromDOI } = require('./gatherer');
          
          let itemMetadata;
          if (data.doi) {
            itemMetadata = await fetchMetadataFromDOI(data.doi);
          } else {
            itemMetadata = data; // Directly from scraper
          }

          if (itemMetadata) {
             const itemId = await addItem(itemMetadata);
             // Broadcast to UI
             if (mainWindow) mainWindow.webContents.send('item-ingested', { ...itemMetadata, id: itemId });
             res.writeHead(200, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ success: true, itemId }));
          } else {
             res.writeHead(400); res.end('Invalid Metadata');
          }
        } catch (e) {
          res.writeHead(500); res.end('Ingest Failed');
        }
      });
    } else {
      res.writeHead(404); res.end();
    }
  });

  ingestServer.listen(51239, '127.0.0.1', () => {
    console.log('Vashira Sentinel Ingest Server live on port 51239');
  });

  ipcMain.handle('check-duplicates', async (_, title) => {
    const { getItems } = require('./database');
    const items = getItems();
    // Basic fuzzy match: common words removal + lowercase
    const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(' ').filter(w => w.length > 3).join(' ');
    const target = clean(title);
    
    return items.filter((item: any) => {
      const current = clean(item.title);
      return current === target || (target.length > 10 && current.includes(target));
    });
  });

  ipcMain.handle('get-annotations', (_, itemId) => getAnnotations(itemId));
  ipcMain.handle('add-annotation', (_, itemId, type, content, position, color) => addAnnotation(itemId, type, content, position, color));

  ipcMain.handle('generate-citation', async (_, itemId, styleName = 'apa') => {
    const { getItemById } = require('./database');
    const { CitationEngine } = require('./citation');
    const item = getItemById(itemId);
    if (!item) return null;
    
    try {
      const styleXml = await styleStore.getStyleXml(styleName);
      const engine = new CitationEngine([item], styleXml);
      return engine.formatCitation(itemId);
    } catch (e) {
      console.error(e);
      return "Citation formatting failed.";
    }
  });

  ipcMain.handle('get-installed-styles', () => styleStore.listCachedStyles());
  ipcMain.handle('install-style', (_, styleName) => styleStore.getStyleXml(styleName));
  
  // Collections
  ipcMain.handle('get-collections', () => require('./database').getCollections());
  ipcMain.handle('create-collection', (_, name, parentId) => require('./database').createCollection(name, parentId));
  ipcMain.handle('add-item-to-collection', (_, itemId, collectionId) => require('./database').addItemToCollection(itemId, collectionId));
  ipcMain.handle('get-items-by-collection', (_, collectionId) => require('./database').getItemsByCollection(collectionId));
  ipcMain.handle('get-sync-log', () => require('./database').getSyncLog());
  ipcMain.handle('get-sync-count', () => require('./database').getSyncCount());
  
  ipcMain.handle('get-peers', () => require('./discovery').discoveryEngine.getOnlinePeers());
  ipcMain.handle('get-discoveries', () => require('./discovery').discoveryEngine.getLocalDiscoveries());
  ipcMain.handle('announce-metadata', (_, doi, title) => require('./discovery').discoveryEngine.announceMetadata(doi, title));
  
  ipcMain.handle('import-pdf', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const sourcePath = filePaths[0];
    const fileName = path.basename(sourcePath);
    const storagePath = getStoragePath();
    const destPath = path.join(storagePath, fileName);

    try {
      // Ensure storage directory exists
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }

      // Copy to vault (async to avoid blocking)
      await fs.promises.copyFile(sourcePath, destPath);

      // Read for metadata (small chunk)
      const handle = await fs.promises.open(destPath, 'r');
      const { buffer } = await handle.read(Buffer.alloc(20000), 0, 20000, 0);
      await handle.close();

      const text = buffer.toString('utf8');
      
      // [VASHIRA 5.0] Content Fingerprinting
      const crypto = require('node:crypto');
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const doi = extractDOIFromText(text);
      const isbn = extractISBNFromText(text);

      let metadata: any = null;
      if (doi) {
        try {
          metadata = await fetchMetadataFromDOI(doi);
        } catch (e) {
          console.warn('DOI fetch failed, checking ISBN or heuristics.');
        }
      }

      if (!metadata && isbn) {
        const { translatorService } = require('./translator-service');
        metadata = await translatorService.translate(isbn);
      }
      
      if (!metadata) {
        const h = extractMetadataFromHeuristics(text);
        metadata = {
            title: h.title || fileName || 'Imported PDF',
            itemType: 'journalArticle',
            authors: 'Extracted Content',
            published: 'N/A',
            doi: doi || '',
            abstract: h.abstract || ''
        };
      }

      const indexedItem = { ...metadata, filePath: destPath, fileHash };
      const itemId = await addItem(indexedItem);
      
      // [VASHIRA 4.0] Trigger P2P Mastery Announcement
      if (indexedItem.doi || indexedItem.fileHash) {
        discoveryEngine.announceMetadata(indexedItem.doi || indexedItem.fileHash, indexedItem.title, itemId as number);
      }

      // [VASHIRA 4.0] Trigger Deep Indexing
      if (destPath) {
        setTimeout(async () => {
          const { indexItemTask } = require('./indexer');
          await indexItemTask({ ...indexedItem, id: itemId });
        }, 100);
      }
      return { ...indexedItem, id: itemId };
    } catch (error: any) {
      console.error('PDF Import error:', error);
      throw new Error(`Mastery interrupted: ${error.message}`);
    }
  });

  ipcMain.handle('import-bibtex', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'BibTeX', extensions: ['bib'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf8');
    const items = parseBibTeX(content);
    
    const results = [];
    for (const item of items) {
       const itemId = await addItem(item);
       results.push({ ...item, id: itemId });
    }
    return results;
  });

  ipcMain.handle('import-ris', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'RIS', extensions: ['ris'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf8');
    return parseRIS(content);
  });

  ipcMain.handle('read-file', async (_, filePath) => {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath);
    }
    return null;
  });

  // Zotero 4.0 Mastery Handlers
  ipcMain.handle('get-all-tags', () => require('./database').getAllTags());
  ipcMain.handle('add-tag-to-item', (_, itemId, tagId) => require('./database').addTagToItem(itemId, tagId));
  ipcMain.handle('remove-tag-from-item', (_, itemId, tagId) => require('./database').removeTagFromItem(itemId, tagId));
  ipcMain.handle('search-deep', (_, query) => require('./database').searchDeep(query));
  ipcMain.handle('index-item', (_, item) => require('./indexer').indexItemTask(item));
  ipcMain.handle('search-global', (_, query) => require('./discovery_api').searchOpenAlex(query));
  
  ipcMain.handle('get-items-by-category', (_, category) => require('./database').getItemsByCategory(category));

  ipcMain.handle('import-metadata', async (_, identifiers: string) => {
    // [VASHIRA 6.0] Split by , | or whitespace
    const ids = identifiers.split(/[ ,|]+/).filter(id => id.trim().length > 0);
    const { translatorService } = require('./translator-service');
    
    const results = [];
    for (const id of ids) {
       try {
         const metadata = await translatorService.translate(id.trim());
         if (metadata) {
           const itemId = await addItem(metadata);
           results.push({ ...metadata, id: itemId });
           
           if (metadata.doi) {
              discoveryEngine.announceMetadata(metadata.doi, metadata.title, itemId as number);
           }
         }
       } catch (e) {
         console.error(`[Batch Import] Failed for \${id}:`, e);
       }
    }
    return results;
  });

  ipcMain.handle('magic-categorize', async () => {
    const { getItems, updateItem } = require('./database');
    const { categorizeItems } = require('./parser');
    const items = getItems();
    const categorizations = categorizeItems(items);
    
    for (const { itemId, category } of categorizations) {
      updateItem(itemId, { extra: category }); // Store in extra for now
    }
    return true;
  });

  ipcMain.handle('export-bibtex', async (_, items) => {
    const bib = generateBibTeX(items);
    const { filePath } = await dialog.showSaveDialog({
      title: 'Export Mastery Hub',
      defaultPath: 'vashira_library.bib',
      filters: [{ name: 'BibTeX', extensions: ['bib'] }]
    });
    if (filePath) {
      fs.writeFileSync(filePath, bib);
      return true;
    }
    return false;
  });

  ipcMain.handle('open-file', async (_, filePath) => {
    const { shell } = require('electron');
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return true;
    }
    return false;
  });

  // P2P Mastery Exchange
  discoveryEngine.on('metadata-response', (metadata: any) => {
    if (metadata) {
      const identifier = metadata.doi || metadata.fileHash;
      if (identifier) {
        require('./database').upsertConsensus(identifier, metadata);
      }
    }
  });

  discoveryEngine.on('discovery', async ({ doi, peer }: { doi: string; peer: any }) => {
    const allItems = await getItems();
    const item = allItems.find((i: any) => i.doi === doi || i.fileHash === doi);
    if (item) {
      discoveryEngine.sendMetadata(item, peer);
    }
  });

  ipcMain.handle('import-from-peer', async (_, doi, peerIp) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        discoveryEngine.off('metadata-response', handleResponse);
        reject(new Error("Peer mastery timed out."));
      }, 5000);

      const handleResponse = (metadata: any) => {
        if (metadata && (metadata.doi === doi || metadata.fileHash === doi)) {
          clearTimeout(timeout);
          discoveryEngine.off('metadata-response', handleResponse);
          resolve(metadata);
        }
      };

      discoveryEngine.on('metadata-response', handleResponse);
      discoveryEngine.requestMetadata(doi, peerIp);
    });
  });

  ipcMain.handle('get-consensus', (_, identifier) => require('./database').getConsensus(identifier));

  createWindow();

  // THE WEB-SNATCHER (5.0) & SCRIBE BRIDGE (6.0)
  const snatcher = http.createServer(async (req, res) => {
    // Enable CORS for Extensions and Word Add-in
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204); res.end(); return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const item = JSON.parse(body);
          const itemId = await addItem(item);
          
          if (mainWindow) {
            mainWindow.webContents.send('snatched-item', item);
          }

          if (item.doi) {
            discoveryEngine.announceMetadata(item.doi, item.title, itemId as number);
          }

          // ASYNC ARCHIVING
          if (item.url) {
            setTimeout(async () => {
              const snapshotPath = await captureSnapshot(item.url, getStoragePath(), itemId as number);
              if (snapshotPath) {
                updateItem(itemId as number, { snapshotPath });
              }
            }, 500);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'Mastered' }));
        } catch (e) {
          res.writeHead(400); res.end('Invalid Metadata');
        }
      });
    } else if (req.method === 'GET' && req.url === '/items') {
      try {
        const items = await getItems();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(items));
      } catch (e) {
        res.writeHead(500); res.end('Hub Error');
      }
    } else if (req.url === '/mobile') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Vashira Sovereign Bridge</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <style>
                    :root { --accent: #a78bfa; --bg: #0d0d12; --glass: rgba(255,255,255,0.05); }
                    body { background: var(--bg); color: white; font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 24px; box-sizing: border-box; }
                    .glass { background: var(--glass); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.1); border-radius: 32px; padding: 40px; text-align: center; width: 100%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
                    h1 { font-size: 1.5rem; margin-bottom: 8px; letter-spacing: -0.02em; }
                    p { font-size: 0.9rem; opacity: 0.6; line-height: 1.5; margin-bottom: 32px; }
                    .btn { background: var(--accent); color: black; border: none; padding: 20px; border-radius: 16px; font-weight: 700; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                    .btn:active { transform: scale(0.95); }
                    #status { margin-top: 24px; font-size: 0.8rem; height: 1.2rem; }
                    .loader { border: 2px solid rgba(255,255,255,0.1); border-top: 2px solid var(--accent); border-radius: 50%; width: 24px; height: 24px; animation: spin 0.8s linear infinite; display: none; margin: 0 auto; }
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </head>
            <body>
                <div class="glass">
                    <div style="background: var(--accent); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <h1>Mobile Bridge</h1>
                    <p>Scan a DOI or ISBN barcode to sync this device with your Sovereign Research Hub.</p>
                    <button id="scan" class="btn">CAPTURE METADATA</button>
                    <div id="status">Ready for Synchronicity.</div>
                    <div id="loader" class="loader"></div>
                </div>
                <script>
                    const btn = document.getElementById('scan');
                    const status = document.getElementById('status');
                    const loader = document.getElementById('loader');
                    
                    btn.onclick = async () => {
                        try {
                            const id = prompt("Manual Capture: Paste DOI/ISBN detected or use system camera.");
                            if (id) {
                                status.innerText = "Propagating Metadata...";
                                loader.style.display = 'block';
                                const res = await fetch('/ingest', { 
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ identifier: id }) 
                                });
                                status.innerText = "Mastered in Vault.";
                                loader.style.display = 'none';
                            }
                        } catch (e) {
                            status.innerText = e.message;
                            loader.style.display = 'none';
                        }
                    }
                </script>
            </body>
            </html>
        `);
    } else if (req.url === '/ingest' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const { identifier } = JSON.parse(body);
                const { translatorService } = require('./translator-service');
                const metadata = await translatorService.translate(identifier);
                if (metadata) {
                    const itemId = await addItem(metadata);
                    if (mainWindow) {
                        mainWindow.webContents.send('snatched-item', metadata);
                    }
                    res.writeHead(200); res.end('Mastered');
                } else {
                    res.writeHead(404); res.end('Not Found');
                }
            } catch (e) { res.writeHead(500); res.end('Vault Failure'); }
        });
    } else if (req.method === 'GET' && req.url?.startsWith('/download/')) {
        const itemId = parseInt(req.url.split('/')[2]);
        const item = (await getItems()).find((i: any) => i.id === itemId);
        if (item && item.filePath && fs.existsSync(item.filePath)) {
            res.writeHead(200, { 
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="\${path.basename(item.filePath)}"` 
            });
            fs.createReadStream(item.filePath).pipe(res);
        } else {
            res.writeHead(404); res.end('File not found in Mastery Hub');
        }
    } else {
      res.writeHead(404); res.end();
    }
  });
  snatcher.listen(51235, '0.0.0.0', () => console.log('[Snatcher] Ready on port 51235 (Global Access)'));
});

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
