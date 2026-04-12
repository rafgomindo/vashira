import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import started from 'electron-squirrel-startup';
import { 
  initDatabase, 
  getItems, 
  addItem, 
  getNotes, 
  addNote, 
  getStoragePath, 
  updateItem, 
  getAnnotations, 
  addAnnotation,
  getItemById,
  getCollections,
  createCollection,
  addItemToCollection,
  getItemsByCollection,
  getSyncLog,
  getSyncCount,
  getAllTags,
  addTagToItem,
  removeTagFromItem,
  searchDeep,
  upsertConsensus,
  getConsensus,
  getItemsByCategory,
  addFullText
} from './database.js';
import { StyleStore } from './styles.js';
import { fetchMetadataFromDOI, extractDOIFromURL, extractDOIFromText, extractISBNFromText } from './gatherer.js';
import { parseBibTeX, parseRIS, extractMetadataFromHeuristics, generateBibTeX, categorizeItems } from './parser.js';
import { discoveryEngine } from './discovery.js';
import { captureSnapshot } from './archiver.js';
import { CitationEngine, MINIMAL_APA_STYLE } from './citation.js';
import { translatorService } from './translator-service.js';
import { indexItemTask } from './indexer.js';
import { CommunityRelay } from './relay-service.js';
import { NatService } from './nat-service.js';
import { ocrService } from './ocr-service.js';
import { scrapeDocx } from './scrapper.js';
// import { discoveryEngine as disc } from './discovery_api.js'; // Removed invalid import

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
    icon: path.join(__dirname, '../../assets/icon.png'), // Adjusted path for .vite/build/
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d12',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../renderer/main_window/index.html'),
    );
  }
};

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
  
  let relay: CommunityRelay | null = null;
  let nat: NatService | null = null;

  ipcMain.handle('toggle-community-mode', async (_, enabled: boolean) => {
    if (enabled) {
        relay = new CommunityRelay(discoveryEngine.nodeId);
        relay.startAutoCheckIn();
        
        // UPnP Automation
        nat = new NatService();
        const natSuccess = await nat.mapPorts();
        
        const globalPeers = await relay.getGlobalPeers();
        globalPeers.forEach(ip => discoveryEngine.addRemotePeer(ip));
        
        return { success: true, nat: natSuccess };
    } else {
        if (relay) relay.stop();
        if (nat) await nat.unmapPorts();
        relay = null;
        nat = null;
        discoveryEngine.clearRemotePeers();
        return { success: false, nat: false };
    }
  });

  app.on('will-quit', async () => {
    if (nat) await nat.unmapPorts();
  });

  ipcMain.handle('get-peers', () => discoveryEngine.getOnlinePeers());
  ipcMain.handle('get-discoveries', () => discoveryEngine.getLocalDiscoveries());
  
  ipcMain.handle('run-mastery-scan', async (_, itemId) => {
    const item = getItemById(itemId);
    if (!item || !item.filePath) return { success: false, error: 'File not found' };
    
    try {
      const buffer = fs.readFileSync(item.filePath);
      const results = await ocrService.scanPdf(buffer);
      const fullText = results.join('\n');
      
      addFullText(itemId, fullText);
      updateItem(itemId, { masteryStatus: 'indexed' });
      
      return { success: true, text: fullText };
    } catch (e: any) {
      console.error('[OCR] Mastery Scan Error:', e);
      return { success: false, error: e.message };
    }
  });
  
  // Vashira Sentinel: Local Ingest Server (Port 51239)
  const ingestServer = http.createServer((req, res) => {
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
          let itemMetadata;
          if (data.doi) {
            itemMetadata = await fetchMetadataFromDOI(data.doi);
          } else {
            itemMetadata = data;
          }

          if (itemMetadata) {
             const itemId = await addItem(itemMetadata);
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

  ingestServer.listen(51239, '127.0.0.1');

  ipcMain.handle('check-duplicates', async (_, title) => {
    const items = getItems();
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
  ipcMain.handle('get-collections', () => getCollections());
  ipcMain.handle('create-collection', (_, name, parentId) => createCollection(name, parentId));
  ipcMain.handle('add-item-to-collection', (_, itemId, collectionId) => addItemToCollection(itemId, collectionId));
  ipcMain.handle('get-items-by-collection', (_, collectionId) => getItemsByCollection(collectionId));
  ipcMain.handle('get-sync-log', () => getSyncLog());
  ipcMain.handle('get-sync-count', () => getSyncCount());
  
  ipcMain.handle('get-peers', () => discoveryEngine.getOnlinePeers());
  ipcMain.handle('get-discoveries', () => discoveryEngine.getLocalDiscoveries());
  ipcMain.handle('announce-metadata', (_, doi, title, itemId) => discoveryEngine.announceMetadata(doi, title, itemId));
  
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
      if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
      await fs.promises.copyFile(sourcePath, destPath);

      const handle = await fs.promises.open(destPath, 'r');
      const { buffer } = await handle.read(Buffer.alloc(20000), 0, 20000, 0);
      await handle.close();

      const text = buffer.toString('utf8');
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const doi = extractDOIFromText(text);
      const isbn = extractISBNFromText(text);

      let metadata: any = null;
      if (doi) {
        try { metadata = await fetchMetadataFromDOI(doi); } catch (e) {}
      }

      if (!metadata && isbn) {
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
      
      if (indexedItem.doi || indexedItem.fileHash) {
        discoveryEngine.announceMetadata(indexedItem.doi || indexedItem.fileHash, indexedItem.title, itemId as number);
      }

      setTimeout(async () => {
        await indexItemTask({ ...indexedItem, id: itemId });
      }, 100);

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
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  });

  ipcMain.handle('get-all-tags', () => getAllTags());
  ipcMain.handle('add-tag-to-item', (_, itemId, tagId) => addTagToItem(itemId, tagId));
  ipcMain.handle('remove-tag-from-item', (_, itemId, tagId) => removeTagFromItem(itemId, tagId));
  ipcMain.handle('search-deep', (_, query) => searchDeep(query));
  ipcMain.handle('index-item', (_, item) => indexItemTask(item));
  
  // For global search, we keep the dynamic require for OpenAlex api if it's separate
  ipcMain.handle('search-global', (_, query) => require('./discovery_api').searchOpenAlex(query));
  
  ipcMain.handle('get-items-by-category', (_, category) => getItemsByCategory(category));

  ipcMain.handle('import-metadata', async (_, identifiers: string) => {
    const ids = identifiers.split(/[ ,|]+/).filter(id => id.trim().length > 0);
    const results = [];
    for (const id of ids) {
       try {
         const metadata = await translatorService.translate(id.trim());
         if (metadata) {
           const itemId = await addItem(metadata);
           results.push({ ...metadata, id: itemId });
           if (metadata.doi) discoveryEngine.announceMetadata(metadata.doi, metadata.title, itemId as number);
         }
       } catch (e) {
         console.error(`[Batch Import] Failed:`, e);
       }
    }
    return results;
  });

  ipcMain.handle('magic-categorize', async () => {
    const items = getItems();
    const categorizations = categorizeItems(items);
    for (const { itemId, category } of categorizations) {
      updateItem(itemId, { extra: category });
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
    if (filePath && fs.existsSync(filePath)) {
      await shell.openPath(filePath);
      return true;
    }
    return false;
  });

  discoveryEngine.on('metadata-response', (metadata: any) => {
    if (metadata) {
      const identifier = metadata.doi || metadata.fileHash;
      if (identifier) upsertConsensus(identifier, metadata);
    }
  });

  discoveryEngine.on('discovery', async ({ doi, peer }: { doi: string; peer: any }) => {
    const allItems = await getItems();
    const item = allItems.find((i: any) => i.doi === doi || i.fileHash === doi);
    if (item) discoveryEngine.sendMetadata(item, peer);
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

  ipcMain.handle('get-consensus', (_, identifier) => getConsensus(identifier));

  ipcMain.handle('graphify-item', async (_, itemId) => {
    const item = getItemById(itemId);
    if (!item || !item.filePath || !item.filePath.toLowerCase().endsWith('.docx')) {
      return { success: false, error: 'Valid .docx file not found' };
    }
    
    try {
      const connections = await scrapeDocx(item.filePath);
      return { success: true, connections };
    } catch (e: any) {
      console.error('[Main] Graphify Error:', e);
      return { success: false, error: e.message };
    }
  });

  createWindow();

  const snatcher = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = url.pathname;

    if (req.method === 'GET') {
      if (pathname === '/items' || pathname === '/api/v1/items') {
        try {
          const items = await getItems();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(items));
        } catch (e) { res.writeHead(500); res.end('Hub Error'); }
      } else if (pathname === '/api/v1/collections') {
        try {
          const collections = await getCollections();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(collections));
        } catch (e) { res.writeHead(500); res.end(); }
      } else if (pathname === '/api/v1/tags') {
        try {
          const tags = await getAllTags();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(tags));
        } catch (e) { res.writeHead(500); res.end(); }
      } else if (pathname === '/api/v1/gefyra-status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '7.0', app: 'vashira' }));
      } else if (pathname === '/mobile') {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
              <!DOCTYPE html>
              <html>
              <head><title>Vashira Sovereign Bridge</title></head>
              <body><h1>Mobile Bridge Ready</h1></body>
              </html>
          `);
      } else { res.writeHead(404); res.end(); }
    } else if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          if (pathname === '/api/v1/format-bibliography') {
             const data = JSON.parse(body);
             const itemIds = data.itemIds || [];
             const itemsFormat = [];
             for (const id of itemIds) {
                 const it = await getItemById(id);
                 if (it) itemsFormat.push(it);
             }
             const engine = new CitationEngine(itemsFormat, MINIMAL_APA_STYLE);
             const bibs = itemsFormat.map(it => `${it.authors} (${it.published}). ${it.title}. ${it.journal || ''} ${it.publisher || ''}.`).join('\n\n');
             res.writeHead(200, { 'Content-Type': 'application/json' });
             res.end(JSON.stringify({ bibliography: bibs }));
             return;
          }

          if (pathname === '/ingest') {
              const { identifier } = JSON.parse(body);
              const metadata = await translatorService.translate(identifier);
              if (metadata) {
                  const itemId = await addItem(metadata);
                  if (mainWindow) mainWindow.webContents.send('snatched-item', metadata);
                  res.writeHead(200); res.end('Mastered');
              } else { res.writeHead(404); res.end('Not Found'); }
              return;
          }

          // Default fallback for root POST (extension submissions)
          const item = JSON.parse(body);
          const itemId = await addItem(item);
          if (mainWindow) mainWindow.webContents.send('snatched-item', item);
          if (item.doi) discoveryEngine.announceMetadata(item.doi, item.title, itemId as number);

          if (item.url && item.htmlContent) {
            // we could save htmlContent directly here if we had an archiver method for it, but for now just rely on captureSnapshot 
            setTimeout(async () => {
              const snapshotPath = await captureSnapshot(item.url, getStoragePath(), itemId as number);
              if (snapshotPath) updateItem(itemId as number, { snapshotPath });
            }, 500);
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'Mastered', id: itemId }));
        } catch (e) {
          console.error(e);
          res.writeHead(400); res.end('Invalid Metadata');
        }
      });
    } else { res.writeHead(404); res.end(); }
  });
  snatcher.listen(51235, '0.0.0.0');
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
