import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vashiraAPI', {
  getItems: () => ipcRenderer.invoke('get-items'),
  addItem: (item: any) => ipcRenderer.invoke('add-item', item),
  getNotes: (itemId: number) => ipcRenderer.invoke('get-notes', itemId),
  addNote: (itemId: number, content: string) => ipcRenderer.invoke('add-note', itemId, content),
  fetchMetadata: (doi: string) => ipcRenderer.invoke('fetch-metadata', doi),
  importPDF: () => ipcRenderer.invoke('import-pdf'),
  getCollections: () => ipcRenderer.invoke('get-collections'),
  createCollection: (name: string, parentId?: number) => ipcRenderer.invoke('create-collection', name, parentId),
  addItemToCollection: (itemId: number, collectionId: number) => ipcRenderer.invoke('add-item-to-collection', itemId, collectionId),
  getItemsByCollection: (collectionId: number) => ipcRenderer.invoke('get-items-by-collection', collectionId),
  getSyncLog: () => ipcRenderer.invoke('get-sync-log'),
  getSyncCount: () => ipcRenderer.invoke('get-sync-count'),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getDiscoveries: () => ipcRenderer.invoke('get-discoveries'),
  announceMetadata: (doi: string, title: string) => ipcRenderer.invoke('announce-metadata', doi, title),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  importBibTeX: () => ipcRenderer.invoke('import-bibtex'),
  importRIS: () => ipcRenderer.invoke('import-ris'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  importFromPeer: (doi: string, peerIp: string) => ipcRenderer.invoke('import-from-peer', doi, peerIp),
  exportBibTeX: (items: any[]) => ipcRenderer.invoke('export-bibtex', items),
  magicCategorize: () => ipcRenderer.invoke('magic-categorize'),
  generateCitation: (itemId: number, styleName?: string) => ipcRenderer.invoke('generate-citation', itemId, styleName),
  getInstalledStyles: () => ipcRenderer.invoke('get-installed-styles'),
  installStyle: (styleName: string) => ipcRenderer.invoke('install-style', styleName),
  searchDeep: (query: string) => ipcRenderer.invoke('search-deep', query),
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),
  searchGlobal: (query: string) => ipcRenderer.invoke('search-global', query),
  
  // Vashira 5.0: Web-Snatcher Listener
  onSnatchedItem: (callback: (item: any) => void) => {
    ipcRenderer.on('snatched-item', (_, item) => callback(item));
  }
});
