import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vashiraAPI', {
  getItems: () => ipcRenderer.invoke('get-items'),
  addItem: (item: any) => ipcRenderer.invoke('add-item', item),
  getNotes: (itemId: number) => ipcRenderer.invoke('get-notes', itemId),
  addNote: (itemId: number, content: string) => ipcRenderer.invoke('add-note', itemId, content),
  fetchMetadata: (doi: string) => ipcRenderer.invoke('fetch-metadata', doi),
  importPDF: (opts?: { sourcePath?: string; force?: boolean }) => ipcRenderer.invoke('import-pdf', opts),
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
  generateCitationRich: (itemId: number, styleName?: string) => ipcRenderer.invoke('generate-citation-rich', itemId, styleName),
  graphifyItem: (itemId: number) => ipcRenderer.invoke('graphify-item', itemId),
  getInstalledStyles: () => ipcRenderer.invoke('get-installed-styles'),
  installStyle: (styleName: string) => ipcRenderer.invoke('install-style', styleName),
  searchDeep: (query: string) => ipcRenderer.invoke('search-deep', query),
  searchFullText: (query: string) => ipcRenderer.invoke('search-fulltext', query),
  onIndexProgress: (callback: (p: { done: number; total: number }) => void) => {
    const listener = (_: any, p: any) => callback(p);
    ipcRenderer.on('index-progress', listener);
    return () => ipcRenderer.removeListener('index-progress', listener);
  },
  getSetting: (key: string) => ipcRenderer.invoke('get-setting', key),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('set-setting', key, value),
  getSecret: (name: string) => ipcRenderer.invoke('get-secret', name),
  setSecret: (name: string, value: unknown) => ipcRenderer.invoke('set-secret', name, value),
  onLibraryRepaired: (callback: (p: { fixed: number }) => void) => {
    const listener = (_: any, p: any) => callback(p);
    ipcRenderer.on('library-repaired', listener);
    return () => ipcRenderer.removeListener('library-repaired', listener);
  },
  trashItem: (itemId: number) => ipcRenderer.invoke('trash-item', itemId),
  restoreItem: (itemId: number) => ipcRenderer.invoke('restore-item', itemId),
  getTrashedItems: () => ipcRenderer.invoke('get-trashed-items'),
  emptyTrash: (ids?: number[]) => ipcRenderer.invoke('empty-trash', ids),
  getAllTags: () => ipcRenderer.invoke('get-all-tags'),
  createTag: (name: string) => ipcRenderer.invoke('create-tag', name),
  addTagToItem: (itemId: number, tagId: number) => ipcRenderer.invoke('add-tag-to-item', itemId, tagId),
  removeTagFromItem: (itemId: number, tagId: number) => ipcRenderer.invoke('remove-tag-from-item', itemId, tagId),
  getTagsForItem: (itemId: number) => ipcRenderer.invoke('get-tags-for-item', itemId),
  getItemsByTag: (tagId: number) => ipcRenderer.invoke('get-items-by-tag', tagId),
  searchGlobal: (query: string) => ipcRenderer.invoke('search-global', query),
  getAnnotations: (itemId: number) => ipcRenderer.invoke('get-annotations', itemId),
  addAnnotation: (itemId: number, type: string, content: string, position: string, color: string) => ipcRenderer.invoke('add-annotation', itemId, type, content, position, color),
  onItemIngested: (callback: any) => {
    const listener = (_: any, item: any) => callback(item);
    ipcRenderer.on('item-ingested', listener);
    return () => ipcRenderer.removeListener('item-ingested', listener);
  },
  updateItem: (id: number, fields: any) => ipcRenderer.invoke('update-item', id, fields),
  toggleCommunityMode: (enabled: boolean) => ipcRenderer.invoke('toggle-community-mode', enabled),
  syncZotero: (userId: string, apiKey: string) => ipcRenderer.invoke('sync-zotero', userId, apiKey),
  checkDuplicates: (itemId: number) => ipcRenderer.invoke('check-duplicates', itemId),
  findDuplicateGroups: () => ipcRenderer.invoke('find-duplicate-groups'),
  mergeItems: (masterId: number, otherIds: number[], fieldValues: Record<string, any>) => ipcRenderer.invoke('merge-items', masterId, otherIds, fieldValues),
  mergeAllExact: () => ipcRenderer.invoke('merge-all-exact'),
  undoMerge: (mergeLogId: number) => ipcRenderer.invoke('undo-merge', mergeLogId),
  markNotDuplicates: (itemIds: number[]) => ipcRenderer.invoke('mark-not-duplicates', itemIds),
  askOracle: (query: string, config: any) => ipcRenderer.invoke('ask-oracle', query, config),
  getConsensus: (identifier: string) => ipcRenderer.invoke('get-consensus', identifier),
  
  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isMaximized: () => ipcRenderer.invoke('is-window-maximized'),
  
  // Vashira 5.0: Web-Snatcher Listener
  onSnatchedItem: (callback: (item: any) => void) => {
    ipcRenderer.on('snatched-item', (_, item) => callback(item));
  },
  runMasteryScan: (itemId: number) => ipcRenderer.invoke('run-mastery-scan', itemId)
});
