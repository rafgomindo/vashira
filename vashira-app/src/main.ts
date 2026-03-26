import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { initDatabase, getItems, addItem, getNotes, addNote } from './database';
import { fetchMetadataFromDOI, extractDOIFromURL, extractDOIFromText } from './gatherer';

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
  
  // IPC Handlers
  ipcMain.handle('get-items', () => getItems());
  ipcMain.handle('add-item', (_, item) => addItem(item));
  ipcMain.handle('get-notes', (_, itemId) => getNotes(itemId));
  ipcMain.handle('add-note', (_, itemId, content) => addNote(itemId, content));
  ipcMain.handle('fetch-metadata', (_, doi) => fetchMetadataFromDOI(doi));
  
  ipcMain.handle('generate-citation', async (_, itemId) => {
    const { getItemById, getItems } = require('./database');
    const { CitationEngine } = require('./citation');
    const item = getItemById(itemId);
    if (!item) return null;
    
    // We pass all items for context or just the one? citeproc-js usually needs the full set or at least the target.
    const engine = new CitationEngine([item]);
    return engine.formatCitation(itemId);
  });
  
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

    const filePath = filePaths[0];
    try {
      // Read the first 10KB to sample for a DOI
      const buffer = Buffer.alloc(10000);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 10000, 0);
      fs.closeSync(fd);

      const text = buffer.toString('utf8');
      const doi = extractDOIFromText(text);

      if (doi) {
        const metadata = await fetchMetadataFromDOI(doi);
        if (metadata) {
          return { ...metadata, filePath };
        }
      }
      
      // Fallback: title from filename
      return {
        title: path.basename(filePath),
        itemType: 'attachment',
        doi: '',
        authors: 'Local File',
        published: 'N/A',
        filePath
      };
    } catch (error) {
      console.error('PDF Import error:', error);
      return null;
    }
  });

  createWindow();
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
