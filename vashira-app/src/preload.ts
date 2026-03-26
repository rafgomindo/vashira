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
  generateCitation: (itemId: number) => ipcRenderer.invoke('generate-citation', itemId),
  getSyncLog: () => ipcRenderer.invoke('get-sync-log'),
  getSyncCount: () => ipcRenderer.invoke('get-sync-count'),
  getPeers: () => ipcRenderer.invoke('get-peers'),
  getDiscoveries: () => ipcRenderer.invoke('get-discoveries'),
  announceMetadata: (doi: string, title: string) => ipcRenderer.invoke('announce-metadata', doi, title),
  openFile: (filePath: string) => ipcRenderer.invoke('open-file', filePath),
  importBibTeX: () => ipcRenderer.invoke('import-bibtex'),
  importRIS: () => ipcRenderer.invoke('import-ris'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
});
