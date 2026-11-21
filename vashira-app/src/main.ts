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
  addTag,
  addTagToItem,
  removeTagFromItem,
  getTagsForItem,
  getItemsByTag,
  searchDeep,
  upsertConsensus,
  getConsensus,
  getItemsByCategory,
  addFullText,
  searchFullText,
  trashItem,
  restoreItem,
  getTrashedItems,
  purgeTrashedItems,
  isFileReferenced
} from './database.js';
import { StyleStore } from './styles.js';
import { fetchMetadataFromDOI, extractDOIFromURL, extractDOIFromText, extractISBNFromText } from './gatherer.js';
import { parseBibTeX, parseRIS, extractMetadataFromHeuristics, generateBibTeX, categorizeItems } from './parser.js';
import { discoveryEngine } from './discovery.js';
import { captureSnapshot } from './archiver.js';
import { CitationEngine, MINIMAL_APA_STYLE, MINIMAL_IEEE_STYLE, MINIMAL_MLA_STYLE, TAPUSCRIT_NOTE_STYLE, TAPUSCRIT_AUTHOR_DATE_STYLE } from './citation.js';
import { askTheOracle } from './oracle.js';
import { translatorService } from './translator-service.js';
import { indexItemTask, reindexLibrary } from './indexer.js';
import { identifyPdf, looksLikeJunkTitle } from './pdf-metadata.js';
import { relatedForItem, searchWorks, librarySuggestions, setOpenAlexKey, Candidate } from './openalex.js';
import { CommunityRelay } from './relay-service.js';
import { NatService } from './nat-service.js';
import { ocrService } from './ocr-service.js';
import { scrapeDocx } from './scrapper.js';
import { fetchZoteroLibrary, mapZoteroToVashira } from './zotero-service.js';
import { findDuplicateGroups, findExactDuplicatesFor, findDuplicatesOfItem, mergeItems, undoMerge, markNotDuplicates, pickDefaultMaster, fillBlanksOverrides } from './duplicates.js';
import { getSetting, setSetting, getSecret, setSecret, SETTING_KEYS, SECRET_NAMES, SettingKey, SecretName } from './settings.js';

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

  // LAN sharing is opt-in: until the user says yes (first-run tour, or the one-time
  // prompt for existing users), imports aren't announced and peer requests go unanswered.
  discoveryEngine.setSharingEnabled(getSetting('shareOnLan') === true);

  ipcMain.handle('get-setting', (_, key: SettingKey) => (SETTING_KEYS.includes(key) ? getSetting(key) : undefined));
  ipcMain.handle('set-setting', (_, key: SettingKey, value: unknown) => {
    if (!SETTING_KEYS.includes(key)) return false;
    setSetting(key, value);
    if (key === 'shareOnLan') discoveryEngine.setSharingEnabled(value === true);
    return true;
  });
  ipcMain.handle('get-secret', (_, name: SecretName) => (SECRET_NAMES.includes(name) ? getSecret(name) : null));
  setOpenAlexKey(getSecret('openalex')?.key);
  ipcMain.handle('set-secret', (_, name: SecretName, value: unknown) => {
    if (!SECRET_NAMES.includes(name)) return false;
    setSecret(name, value);
    if (name === 'openalex') setOpenAlexKey((value as any)?.key);
    return true;
  });

  // IPC Handlers
  ipcMain.handle('get-items', () => getItems());
  ipcMain.handle('add-item', (_, item) => addItem(item));
  ipcMain.handle('get-notes', (_, itemId) => getNotes(itemId));
  ipcMain.handle('add-note', (_, itemId, content) => addNote(itemId, content));
  ipcMain.handle('fetch-metadata', (_, doi) => fetchMetadataFromDOI(doi));
  ipcMain.handle('update-item', (_, id, fields) => {
    try {
      updateItem(id, fields);
      return { success: true };
    } catch (e: any) {
      console.error('[Main] Update Item Error:', e);
      return { success: false, error: e.message };
    }
  });
  
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
  
  // OCR for scanned PDFs isn't implemented yet: ocrService.scanPdf only returns a
  // placeholder string, which this handler used to write into the search index.
  // Refuse honestly instead of indexing junk; no UI calls this today.
  ipcMain.handle('run-mastery-scan', async (_, itemId) => {
    const item = getItemById(itemId);
    if (!item || !item.filePath) return { success: false, error: 'File not found' };
    return { success: false, error: 'OCR for scanned PDFs is not available yet.' };
  });

  // Full-text hits for the library search box: [{ itemId, hits: [{ page, snippet }] }]
  ipcMain.handle('search-fulltext', (_, query: string) => searchFullText(query));

  // Discovery (v10.3, OpenAlex). Errors come back as { error } so the UI can show
  // "limit reached" / "offline" without a thrown IPC exception.
  const safe = async <T>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (e: any) {
      const offline = /fetch failed|ENOTFOUND|ETIMEDOUT|ECONNREFUSED/i.test(String(e?.message) + String(e?.cause?.code));
      return { error: offline ? 'Can’t reach OpenAlex — check your internet connection.' : (e?.message || 'Discovery failed.') };
    }
  };
  ipcMain.handle('discovery-related', (_, itemId: number) => safe(async () => {
    const item = getItemById(itemId);
    if (!item) throw new Error('Item not found');
    return relatedForItem(item);
  }));
  ipcMain.handle('discovery-search', (_, query: string) => safe(() => searchWorks(query)));
  ipcMain.handle('discovery-suggestions', () => safe(() => librarySuggestions()));
  ipcMain.handle('discovery-add', (_, c: Candidate, opts: { withPdf?: boolean } = {}) => safe(async () => {
    const fields = {
      title: c.title, authors: c.authors, published: c.published, doi: c.doi, journal: c.journal,
      itemType: c.itemType, abstract: c.abstract, volume: c.volume, issue: c.issue, pages: c.pages, publisher: c.publisher,
    };
    const existing = findExactDuplicatesFor(fields)[0];
    if (existing) return { itemId: existing.id, alreadyInLibrary: true };
    const itemId = Number(await addItem(fields));
    let pdf: string | null = null;
    if (opts.withPdf && c.oaPdfUrl) pdf = await downloadOaPdf(itemId, c.oaPdfUrl, c.title).catch(e => (console.warn('[Discovery] PDF download failed:', e), null));
    // pdf: undefined = not requested, false = requested but the host blocked it / served a web page.
    return { itemId, pdf: opts.withPdf ? !!pdf : undefined };
  }));

  // Trash
  ipcMain.handle('trash-item', (_, itemId: number) => { trashItem(itemId); return true; });
  ipcMain.handle('restore-item', (_, itemId: number) => { restoreItem(itemId); return true; });
  ipcMain.handle('get-trashed-items', () => getTrashedItems());
  ipcMain.handle('empty-trash', (_, ids?: number[]) => {
    const files = purgeTrashedItems(ids);
    // Only delete files Vashira itself stored, and never one another item still uses.
    const storageRoot = path.resolve(getStoragePath()) + path.sep;
    for (const file of files) {
      const resolved = path.resolve(file);
      if (!resolved.startsWith(storageRoot) || isFileReferenced(file)) continue;
      try {
        fs.rmSync(resolved, { force: true });
        const dir = path.dirname(resolved);
        if (dir + path.sep !== storageRoot && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
      } catch (e) {
        console.error('[Trash] Could not remove file:', resolved, e);
      }
    }
    return files.length;
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
             const dup = findExactDuplicatesFor(itemMetadata)[0];
             if (dup) {
               res.writeHead(200, { 'Content-Type': 'application/json' });
               res.end(JSON.stringify({ success: true, itemId: dup.id, alreadyInLibrary: true }));
               return;
             }
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

  // Duplicates (v10.3) — see duplicates.ts
  ipcMain.handle('check-duplicates', (_, itemId: number) => findDuplicatesOfItem(itemId));
  ipcMain.handle('find-duplicate-groups', () => findDuplicateGroups());
  ipcMain.handle('merge-items', (_, masterId: number, otherIds: number[], fieldValues: Record<string, any>) => mergeItems(masterId, otherIds, fieldValues));
  ipcMain.handle('undo-merge', (_, mergeLogId: number) => { undoMerge(mergeLogId); return true; });
  ipcMain.handle('mark-not-duplicates', (_, itemIds: number[]) => { markNotDuplicates(itemIds); return true; });
  ipcMain.handle('merge-all-exact', () => {
    const logIds: number[] = [];
    for (const group of findDuplicateGroups().filter(g => g.kind === 'exact')) {
      const master = pickDefaultMaster(group.items);
      const others = group.items.filter((i: any) => i.id !== master.id);
      logIds.push(mergeItems(master.id, others.map((o: any) => o.id), fillBlanksOverrides(master, others)));
    }
    return logIds;
  });

  ipcMain.handle('get-annotations', (_, itemId) => getAnnotations(itemId));
  ipcMain.handle('add-annotation', (_, itemId, type, content, position, color) => addAnnotation(itemId, type, content, position, color));

  // Guaranteed-offline styles — sovereign/offline-first means citing shouldn't
  // depend on reaching GitHub. Anything else falls through to the live CSL repo.
  const BUILTIN_STYLES: Record<string, string> = {
    apa: MINIMAL_APA_STYLE,
    ieee: MINIMAL_IEEE_STYLE,
    mla: MINIMAL_MLA_STYLE,
    'tapuscrit-note': TAPUSCRIT_NOTE_STYLE,
    'tapuscrit-author-date': TAPUSCRIT_AUTHOR_DATE_STYLE,
  };

  ipcMain.handle('generate-citation', async (_, itemId, styleName = 'apa') => {
    const item = getItemById(itemId);
    if (!item) return null;

    try {
      const styleXml = BUILTIN_STYLES[styleName] || await styleStore.getStyleXml(styleName);
      const engine = new CitationEngine([item], styleXml);
      return engine.formatCitation(itemId);
    } catch (e) {
      console.error(e);
      return "Citation formatting failed.";
    }
  });

  // { text, html } for the clipboard, so pasting into Word keeps italics / small caps.
  ipcMain.handle('generate-citation-rich', async (_, itemId: number, styleName = 'apa') => {
    const item = getItemById(itemId);
    if (!item) return null;
    try {
      const styleXml = BUILTIN_STYLES[styleName] || await styleStore.getStyleXml(styleName);
      return new CitationEngine([item], styleXml).formatCitationRich(itemId);
    } catch (e) {
      console.error('[Cite] Formatting failed:', e);
      return null;
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
  
  ipcMain.handle('announce-metadata', (_, doi, title, itemId) => discoveryEngine.announceMetadata(doi, title, itemId));
  
  // opts.sourcePath + opts.force: "Add anyway" after a duplicate warning, without re-opening the dialog.
  ipcMain.handle('import-pdf', async (_, opts: { sourcePath?: string; force?: boolean } = {}) => {
    let sourcePath = opts?.sourcePath;
    if (!sourcePath) {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      });
      if (canceled || filePaths.length === 0) return { success: false, canceled: true };
      sourcePath = filePaths[0];
    }

    const fileName = path.basename(sourcePath);
    const storagePath = getStoragePath();

    try {
      if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });

      // NOTE: fileHash is the SHA-256 of the first 20 KB, and it doubles as the P2P
      // identifier — don't change how it's computed, or peers on older versions
      // stop matching.
      const handle = await fs.promises.open(sourcePath, 'r');
      const { buffer } = await handle.read(Buffer.alloc(20000), 0, 20000, 0);
      await handle.close();

      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

      // Identify from the real text of the first pages + the PDF's info fields + the file name
      // (the old raw-bytes heuristic produced titles like "%PDF-1.6").
      const { metadata, doi, isbn } = await identifyPdf(sourcePath);

      if (!opts?.force) {
        const existing = findExactDuplicatesFor({ doi: metadata.doi || doi, isbn: metadata.isbn || isbn, fileHash });
        if (existing.length > 0) return { success: false, duplicate: existing[0], sourcePath };
      }

      // Each attachment gets its own folder (vashira_storage/<itemId>/<name>): files used
      // to be copied flat, so two PDFs with the same name overwrote each other.
      const itemId = await addItem({ ...metadata, fileHash });
      const destDir = path.join(storagePath, String(itemId));
      await fs.promises.mkdir(destDir, { recursive: true });
      const destPath = path.join(destDir, fileName);
      await fs.promises.copyFile(sourcePath, destPath);
      updateItem(itemId as number, { filePath: destPath });
      const indexedItem = { ...metadata, filePath: destPath, fileHash };

      if (indexedItem.doi || indexedItem.fileHash) {
        discoveryEngine.announceMetadata(indexedItem.doi || indexedItem.fileHash, indexedItem.title, itemId as number);
      }

      setTimeout(async () => {
        await indexItemTask({ ...indexedItem, id: itemId });
      }, 100);

      return { success: true, item: { ...indexedItem, id: itemId } };
    } catch (error: any) {
      console.error('PDF Import error:', error);
      return { success: false, error: `Mastery interrupted: ${error.message}` };
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
    let skipped = 0;
    for (const item of items) {
       if (findExactDuplicatesFor(item).length > 0) { skipped++; continue; }
       const itemId = await addItem(item);
       results.push({ ...item, id: itemId });
    }
    return { items: results, skipped };
  });

  ipcMain.handle('import-ris', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'RIS', extensions: ['ris'] }]
    });
    if (canceled || filePaths.length === 0) return null;
    const content = fs.readFileSync(filePaths[0], 'utf8');
    const items = parseRIS(content);

    const results = [];
    let skipped = 0;
    for (const item of items) {
       if (findExactDuplicatesFor(item).length > 0) { skipped++; continue; }
       const itemId = await addItem(item);
       results.push({ ...item, id: itemId });
    }
    return { items: results, skipped };
  });

  ipcMain.handle('read-file', async (_, filePath) => {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  });

  ipcMain.handle('get-all-tags', () => getAllTags());
  ipcMain.handle('create-tag', (_, name) => addTag(name));
  ipcMain.handle('add-tag-to-item', (_, itemId, tagId) => addTagToItem(itemId, tagId));
  ipcMain.handle('remove-tag-from-item', (_, itemId, tagId) => removeTagFromItem(itemId, tagId));
  ipcMain.handle('get-tags-for-item', (_, itemId) => getTagsForItem(itemId));
  ipcMain.handle('get-items-by-tag', (_, tagId) => getItemsByTag(tagId));
  ipcMain.handle('search-deep', (_, query) => searchDeep(query));
  ipcMain.handle('ask-oracle', async (_, query: string, config: any) => {
    // Runs in-process (not through IPC) since we're already on the main side.
    return askTheOracle(query, config, { searchDeep: async (q: string) => searchDeep(q) });
  });
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
           if (findExactDuplicatesFor(metadata).length > 0) continue;
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

  discoveryEngine.on('metadata-response', ({ metadata, voterId }: { metadata: any; voterId: string }) => {
    if (metadata) {
      const identifier = metadata.doi || metadata.fileHash;
      if (identifier) upsertConsensus(identifier, metadata, voterId);
    }
  });

  discoveryEngine.on('metadata-request', async ({ doi, peer }: { doi: string; peer: any }) => {
    const allItems = await getItems();
    const item = allItems.find((i: any) => i.doi === doi || i.fileHash === doi);
    if (item) discoveryEngine.sendMetadata(item, peer);
  });

  ipcMain.handle('import-from-peer', async (_, doi, peerIp) => {
    try {
      const metadata: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          discoveryEngine.off('metadata-response', handleResponse);
          reject(new Error('Peer mastery timed out.'));
        }, 5000);

        const handleResponse = ({ metadata: m }: { metadata: any; voterId: string }) => {
          if (m && (m.doi === doi || m.fileHash === doi)) {
            clearTimeout(timeout);
            discoveryEngine.off('metadata-response', handleResponse);
            resolve(m);
          }
        };
        discoveryEngine.on('metadata-response', handleResponse);
        discoveryEngine.requestMetadata(doi, peerIp);
      });

      // The peer's filePath/snapshotPath point at files on THEIR machine, not ours.
      const { filePath, snapshotPath, id, ...remoteFields } = metadata;
      const existing = getItems().find((i: any) =>
        (remoteFields.doi && i.doi === remoteFields.doi) ||
        (remoteFields.fileHash && i.fileHash === remoteFields.fileHash)
      );
      if (existing) return { success: true, item: existing, alreadyOwned: true };

      const itemId = await addItem(remoteFields);
      return { success: true, item: { ...remoteFields, id: itemId } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
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
  
  // Window Control Handlers
  ipcMain.on('window-minimize', () => {
    mainWindow?.minimize();
  });
  
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow?.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  
  ipcMain.on('window-close', () => {
    mainWindow?.close();
  });
  
  ipcMain.handle('is-window-maximized', () => {
    return mainWindow?.isMaximized();
  });

  ipcMain.handle('sync-zotero', async (_, userId, apiKey) => {
    try {
      const zItems = await fetchZoteroLibrary(userId, apiKey);
      let syncCount = 0;
      for (const zItem of zItems) {
        const vItem = mapZoteroToVashira(zItem);
        const existing = findExactDuplicatesFor(vItem).length > 0 || getItems().some((i: any) => i.title === zItem.data.title);
        if (!existing) {
          addItem(vItem);
          syncCount++;
        }
      }
      return { success: true, count: syncCount };
    } catch (e: any) {
      console.error('[Main] Zotero Sync Error:', e);
      return { success: false, error: e.message };
    }
  });

  // Vashira AI Provider / MCP Server (6.0)
  const providerServer = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') { res.end(); return; }

    if (req.url === '/v1/chat/completions') {
       // Mock OpenAI endpoint that uses Vashira context
       // For now, it returns a prompt that suggests using the Vashira App
       res.writeHead(200, { 'Content-Type': 'application/json' });
       res.end(JSON.stringify({
         choices: [{ message: { content: "Vashira AI Provider is active. Connect with MCP for deep research." } }]
       }));
    } else if (req.url === '/mcp') {
       // MCP (Model Context Protocol) JSON-RPC endpoint
       res.writeHead(200, { 'Content-Type': 'application/json' });
       res.end(JSON.stringify({ 
         name: "Vashira Mastery", 
         version: "5.0", 
         capabilities: ["resources", "tools"] 
       }));
    } else {
       res.writeHead(404);
       res.end();
    }
  });

  // Loopback only: this endpoint is for tools on the same computer.
  providerServer.listen(51236, '127.0.0.1', () => {
    console.log('[Main] Vashira AI Provider active on port 51236');
  });

  createWindow();

  // One-time (per extractor version) background pass that replaces the old junk
  // full text with real per-page text; progress shows up as a toast in the UI.
  setTimeout(() => {
    reindexLibrary((done, total) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('index-progress', { done, total });
    })
      .catch(e => console.error('[Deep Search] Library re-index failed:', e))
      .then(() => repairJunkMetadata())
      .then(fixed => {
        if (fixed > 0 && mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('library-repaired', { fixed });
      })
      .catch(e => console.error('[Identify] Metadata repair failed:', e));
  }, 3000);

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
                  if (findExactDuplicatesFor(metadata).length > 0) { res.writeHead(200); res.end('Already in library'); return; }
                  const itemId = await addItem(metadata);
                  if (mainWindow) mainWindow.webContents.send('snatched-item', metadata);
                  res.writeHead(200); res.end('Mastered');
              } else { res.writeHead(404); res.end('Not Found'); }
              return;
          }

          // Default fallback for root POST (extension submissions)
          const item = JSON.parse(body);
          const dup = findExactDuplicatesFor(item)[0];
          if (dup) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'Already in library', id: dup.id }));
            return;
          }
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
  // Loopback only. This used to listen on 0.0.0.0, which let anyone on the same
  // network read the whole library (GET /items, file paths included) and add items.
  // Every extension / Office add-in client talks to localhost / 127.0.0.1.
  snatcher.listen(51235, '127.0.0.1');
});

/**
 * Items imported before v10.3 got titles from raw PDF bytes ("%PDF-1.6", "/Subtype /Type1",
 * "0000000016 00000 n"). Re-identify those from the PDF itself. Only touches items whose
 * title is clearly junk, and only fills author/year/abstract where they're placeholders.
 */
async function repairJunkMetadata(): Promise<number> {
  const victims = getItems().filter((i: any) =>
    looksLikeJunkTitle(i.title) && i.filePath && i.filePath.toLowerCase().endsWith('.pdf') && fs.existsSync(i.filePath));
  let fixed = 0;
  for (const item of victims) {
    try {
      const { metadata: m } = await identifyPdf(item.filePath);
      if (!m?.title || looksLikeJunkTitle(m.title)) continue;
      const placeholder = (v: any) => !v || /^(extracted content|unknown|n\/a)$/i.test(String(v).trim());
      const fields: any = { title: m.title };
      if (placeholder(item.authors) && m.authors) fields.authors = m.authors;
      if (placeholder(item.published) && m.published) fields.published = m.published;
      if (!item.abstract && m.abstract) fields.abstract = m.abstract;
      if (!item.doi && m.doi) fields.doi = m.doi;
      if (!item.isbn && m.isbn) fields.isbn = m.isbn;
      if (m.itemType && (item.itemType === 'journalArticle' || !item.itemType)) fields.itemType = m.itemType;
      for (const k of ['journal', 'publisher', 'volume', 'issue', 'pages']) if (!item[k] && m[k]) fields[k] = m[k];
      updateItem(item.id, fields);
      fixed++;
      console.log(`[Identify] Repaired: "${item.title.slice(0, 30)}" → "${m.title}"`);
    } catch (e) {
      console.error('[Identify] Could not repair item', item.id, e);
    }
  }
  return fixed;
}

/**
 * Downloads a legal open-access PDF (a URL OpenAlex lists as an OA location) straight
 * from the publisher/repository — never via peers — and attaches it to the item.
 */
async function downloadOaPdf(itemId: number, url: string, title: string): Promise<string | null> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Vashira/10.3 (+https://vashira.org)', Accept: 'application/pdf,*/*' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 150 * 1024 * 1024) throw new Error('PDF too large');
  // Many "PDF" links land on an HTML page (paywall, captcha); only keep real PDFs.
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('Not a PDF');
  const dir = path.join(getStoragePath(), String(itemId));
  await fs.promises.mkdir(dir, { recursive: true });
  const safeName = (title || 'paper').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'paper';
  const filePath = path.join(dir, safeName + '.pdf');
  await fs.promises.writeFile(filePath, buf);
  const fileHash = crypto.createHash('sha256').update(buf.subarray(0, 20000)).digest('hex');
  updateItem(itemId, { filePath, fileHash });
  setTimeout(() => indexItemTask({ ...getItemById(itemId), id: itemId }), 100);
  return filePath;
}

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });


// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
