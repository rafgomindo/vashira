import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Zap,
  PenTool
} from 'lucide-react';

// Refactored Components
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import LibraryGrid from './components/LibraryGrid';
import KnowledgeHub from './components/KnowledgeHub';
import OracleUI from './components/OracleUI';
import SettingsUI from './components/SettingsUI';
import Scribe from './components/Scribe';
import SharedVault from './components/SharedVault';
import Tour from './components/Tour';
import SharingPrompt from './components/SharingPrompt';
import DuplicatesView from './components/DuplicatesView';
import DiscoverView from './components/DiscoverView';

type ToastAction = { label: string; onClick: () => void };

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [showTour, setShowTour] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'graph'>('grid');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Feature States
  const [communityMode, setCommunityMode] = useState(false);
  // LAN sharing opt-in: null = still loading, undefined = never asked yet.
  const [shareOnLan, setShareOnLan] = useState<boolean | undefined | null>(null);
  const [natStatus, setNatStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert'; actions?: ToastAction[] } | null>(null);
  const toastTimer = React.useRef<any>(null);
  // Item whose duplicate group the Duplicates view should open straight into.
  const [dupFocusItemId, setDupFocusItemId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeItemConnections, setActiveItemConnections] = useState<any[]>([]);
  const [dupes, setDupes] = useState<any[]>([]);

  // Oracle States
  const [oracleQuery, setOracleQuery] = useState('');
  const [oracleResponse, setOracleResponse] = useState<string | null>(null);
  const [isOracleLoading, setIsOracleLoading] = useState(false);
  const [oracleConfig, setOracleConfig] = useState({ baseUrl: '', apiKey: '', model: '' });

  // Settings / Sync States
  const [zoteroConfig, setZoteroConfig] = useState({ userId: '', apiKey: '' });
  const [citationStyle, setCitationStyle] = useState('apa');

  // Collections & Tags
  const [collections, setCollections] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [libraryFilter, setLibraryFilter] = useState<{ type: 'all' | 'collection' | 'tag' | 'trash' | 'duplicates'; id?: number; label?: string }>({ type: 'all' });
  const [displayedItems, setDisplayedItems] = useState<any[]>([]);

  // Reader States
  const [showPdfReader, setShowPdfReader] = useState(false);
  const [pdfPath, setPdfPath] = useState('');
  const [annotations, setAnnotations] = useState<any[]>([]);

  useEffect(() => {
    loadItems();
    loadConfigs();
    loadCollectionsAndTags();

    if (!localStorage.getItem('vashira_onboarded')) {
      setShowTour(true);
    }

    // Live-update the library when an item arrives from the browser extension /
    // Word add-in (snatched-item) or from a peer's push (item-ingested), instead
    // of only picking it up on the next manual reload.
    const unsubscribeIngested = (window as any).vashiraAPI.onItemIngested((item: any) => {
      showToast(`Received: ${item.title}`);
      loadItems();
    });

    (window as any).vashiraAPI.onSnatchedItem((item: any) => {
      showToast(`Captured: ${item.title}`);
      loadItems();
    });

    // Background (re-)indexing of PDF text — a persistent toast while it runs.
    const unsubscribeIndex = (window as any).vashiraAPI.onIndexProgress(({ done, total }: { done: number; total: number }) => {
      if (done < total) {
        setToast({ message: `Indexing PDF text: ${done}/${total}…`, type: 'success' });
      } else {
        showToast(`Full-text search ready (${total} PDF${total === 1 ? '' : 's'} indexed).`);
      }
    });

    // Items imported with junk titles ("%PDF-1.6"…) get re-identified in the background.
    const unsubscribeRepaired = (window as any).vashiraAPI.onLibraryRepaired(({ fixed }: { fixed: number }) => {
      showToast(`Fixed the titles of ${fixed} imported PDF${fixed === 1 ? '' : 's'}.`);
      loadItems();
    });

    return () => {
      if (unsubscribeIngested) unsubscribeIngested();
      if (unsubscribeIndex) unsubscribeIndex();
      if (unsubscribeRepaired) unsubscribeRepaired();
    };
  }, []);

  const chooseLanSharing = async (share: boolean) => {
    await (window as any).vashiraAPI.setSetting('shareOnLan', share);
    setShareOnLan(share);
    showToast(share ? 'Sharing with Vashira users on your network.' : 'Kept private. Change it anytime in Settings.');
  };

  const handleTrashItem = async (itemId: number) => {
    await (window as any).vashiraAPI.trashItem(itemId);
    setIsDetailsOpen(false);
    setSelectedItem(null);
    showToast('Moved to Trash. Restore it from Trash in the sidebar.');
    loadItems();
  };

  // Re-query the Trash view after a change there (the flat `items` list excludes trashed items).
  const refreshTrash = async () => setDisplayedItems(await (window as any).vashiraAPI.getTrashedItems());

  const handleRestoreItem = async (itemId: number) => {
    await (window as any).vashiraAPI.restoreItem(itemId);
    showToast('Restored to your library.');
    await refreshTrash();
    loadItems();
  };

  const handleDeleteForever = async (itemId: number) => {
    await (window as any).vashiraAPI.emptyTrash([itemId]);
    showToast('Deleted permanently.');
    refreshTrash();
  };

  const handleEmptyTrash = async () => {
    const n = await (window as any).vashiraAPI.emptyTrash();
    showToast(`Trash emptied (${n} item${n === 1 ? '' : 's'} deleted).`);
    refreshTrash();
  };

  const loadItems = async () => {
    try {
      const result = await (window as any).vashiraAPI.getItems();
      setItems(result);
    } catch (e) {
      console.error('Failed to load library:', e);
    }
  };

  const loadConfigs = async () => {
    const api = (window as any).vashiraAPI;
    // API keys live in the main process, encrypted with the OS keychain. Older
    // versions kept them in plaintext localStorage: move them over once.
    for (const [name, key, setter] of [
      ['oracle', 'vashira_oracle_config', setOracleConfig],
      ['zotero', 'vashira_zotero_config', setZoteroConfig],
    ] as const) {
      try {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          await api.setSecret(name, JSON.parse(legacy));
          localStorage.removeItem(key);
        }
        const saved = await api.getSecret(name);
        if (saved) (setter as (v: any) => void)(saved);
      } catch (e) {
        console.error(`Failed to load ${name} config:`, e);
      }
    }

    try {
      setShareOnLan(await api.getSetting('shareOnLan'));
    } catch {
      setShareOnLan(false);
    }

    const cm = localStorage.getItem('vashira_community_mode') === 'true';
    setCommunityMode(cm);

    const savedStyle = localStorage.getItem('vashira_citation_style');
    if (savedStyle) setCitationStyle(savedStyle);
  };

  const loadCollectionsAndTags = async () => {
    try {
      const [c, t] = await Promise.all([
        (window as any).vashiraAPI.getCollections(),
        (window as any).vashiraAPI.getAllTags()
      ]);
      setCollections(c || []);
      setTags(t || []);
    } catch (e) {
      console.error('Failed to load collections/tags:', e);
    }
  };

  // Re-derive the visible library list whenever the sidebar filter or the
  // underlying library changes. Collection/tag membership isn't part of the
  // flat `items` rows, so a filtered view means asking the DB directly.
  useEffect(() => {
    const applyFilter = async () => {
      try {
        if (libraryFilter.type === 'collection' && libraryFilter.id != null) {
          setDisplayedItems(await (window as any).vashiraAPI.getItemsByCollection(libraryFilter.id));
        } else if (libraryFilter.type === 'tag' && libraryFilter.id != null) {
          setDisplayedItems(await (window as any).vashiraAPI.getItemsByTag(libraryFilter.id));
        } else if (libraryFilter.type === 'trash') {
          setDisplayedItems(await (window as any).vashiraAPI.getTrashedItems());
        } else {
          setDisplayedItems(items);
        }
      } catch (e) {
        console.error('Failed to apply library filter:', e);
        setDisplayedItems(items);
      }
    };
    applyFilter();
  }, [libraryFilter, items]);

  const handleCreateCollection = async (name: string) => {
    if (!name.trim()) return;
    await (window as any).vashiraAPI.createCollection(name.trim());
    loadCollectionsAndTags();
  };

  const handleAddItemToCollection = async (itemId: number, collectionId: number) => {
    await (window as any).vashiraAPI.addItemToCollection(itemId, collectionId);
    showToast('Added to collection.');
    if (libraryFilter.type === 'collection' && libraryFilter.id === collectionId) {
      setDisplayedItems(await (window as any).vashiraAPI.getItemsByCollection(collectionId));
    }
  };

  const handleAddTagToItem = async (itemId: number, tagName: string) => {
    if (!tagName.trim()) return;
    const tagId = await (window as any).vashiraAPI.createTag(tagName.trim());
    await (window as any).vashiraAPI.addTagToItem(itemId, tagId);
    loadCollectionsAndTags();
  };

  const handleRemoveTagFromItem = async (itemId: number, tagId: number) => {
    await (window as any).vashiraAPI.removeTagFromItem(itemId, tagId);
  };

  const handleExportBibTeX = async () => {
    try {
      const exported = await (window as any).vashiraAPI.exportBibTeX(displayedItems);
      showToast(exported ? 'Library exported.' : 'Export canceled.');
    } catch (e: any) {
      showToast(e.message || 'Export failed.', 'alert');
    }
  };

  const handleImportBibTeX = async () => {
    try {
      const result = await (window as any).vashiraAPI.importBibTeX();
      if (result) {
        const skipped = result.skipped ? ` (${result.skipped} already in your library, skipped)` : '';
        showToast(`Imported ${result.items.length} item(s) from BibTeX${skipped}.`);
        loadItems();
      }
    } catch (e: any) {
      showToast(e.message || 'BibTeX import failed.', 'alert');
    }
  };

  const handleImportRIS = async () => {
    try {
      const result = await (window as any).vashiraAPI.importRIS();
      if (result) {
        const skipped = result.skipped ? ` (${result.skipped} already in your library, skipped)` : '';
        showToast(`Imported ${result.items.length} item(s) from RIS${skipped}.`);
        loadItems();
      }
    } catch (e: any) {
      showToast(e.message || 'RIS import failed.', 'alert');
    }
  };

  // Toasts with actions (Undo, Add anyway…) stay up longer so there's time to click.
  const showToast = (message: string, type: 'success' | 'alert' = 'success', action?: ToastAction | ToastAction[]) => {
    const actions = action ? (Array.isArray(action) ? action : [action]) : undefined;
    setToast({ message, type, actions });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), actions ? 8000 : 3000);
  };

  // Discovery (OpenAlex): a paper was added → refresh; "In library" → open its record.
  const handleDiscoveryAdded = (_itemId: number, info: { alreadyInLibrary?: boolean; pdf?: boolean }) => {
    showToast(
      info.alreadyInLibrary ? 'Already in your library.'
        : info.pdf === true ? 'Added with its free PDF.'
        : info.pdf === false ? 'Added. The free PDF couldn’t be downloaded automatically (the site blocked it) — use the DOI link to get it.'
        : 'Added to your library.',
      info.pdf === false ? 'alert' : 'success'
    );
    loadItems();
  };
  const openItemById = async (itemId: number) => {
    const all = await (window as any).vashiraAPI.getItems();
    setItems(all);
    const item = all.find((i: any) => i.id === itemId);
    if (!item) return;
    setActiveTab('library');
    setLibraryFilter({ type: 'all' });
    handleSelectItem(item);
  };

  const openDuplicates = (focusItemId: number | null = null) => {
    setDupFocusItemId(focusItemId);
    setIsDetailsOpen(false);
    setActiveTab('library');
    setLibraryFilter({ type: 'duplicates', label: 'Duplicates' });
  };

  const handleSelectItem = async (item: any) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
    try {
      const d = await (window as any).vashiraAPI.checkDuplicates(item.id);
      setDupes(d || []);
    } catch (e) {
      console.error('Duplicate check failed:', e);
      setDupes([]);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await (window as any).vashiraAPI.setSecret('zotero', zoteroConfig);
      const result = await (window as any).vashiraAPI.syncZotero(zoteroConfig.userId, zoteroConfig.apiKey);
      if (result.success) {
        showToast(`Sync Complete: ${result.count} new item(s) added.`);
        loadItems();
      } else {
        showToast(result.error, 'alert');
      }
    } catch (e) {
      showToast('Sync failed.', 'alert');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOracleAsk = async () => {
    if (!oracleQuery) return;
    setIsOracleLoading(true);
    try {
      const resp = await (window as any).vashiraAPI.askOracle(oracleQuery, oracleConfig);
      setOracleResponse(resp);
    } catch (e) {
      showToast('Oracle is silent. Check API config.', 'alert');
    } finally {
      setIsOracleLoading(false);
    }
  };

  const handleImport = async (opts?: { sourcePath?: string; force?: boolean }) => {
    try {
      const result = await (window as any).vashiraAPI.importPDF(opts);
      if (result.success) {
        showToast('Artifact Mastered.');
        loadItems();
      } else if (result.duplicate) {
        const existing = result.duplicate;
        showToast(`Already in your library: “${existing.title}”`, 'alert', [
          { label: 'OPEN IT', onClick: () => { setToast(null); setLibraryFilter({ type: 'all' }); handleSelectItem(existing); } },
          { label: 'ADD ANYWAY', onClick: () => { setToast(null); handleImport({ sourcePath: result.sourcePath, force: true }); } },
        ]);
      } else if (!result.canceled) {
        showToast(result.error || 'Import failed.', 'alert');
      }
    } catch (e: any) {
      showToast(e.message || 'Import failed.', 'alert');
    }
  };

  return (
    <div className="app-container">
      <TopBar />
      
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => { setActiveTab(tab); if (tab === 'library') setLibraryFilter({ type: 'all' }); }}
        communityMode={communityMode}
        natStatus={natStatus}
        collections={collections}
        tags={tags}
        libraryFilter={libraryFilter}
        onSelectFilter={(f) => { setDupFocusItemId(null); setLibraryFilter(f); setActiveTab("library"); }}
        onCreateCollection={handleCreateCollection}
      />

      <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        {activeTab === 'library' && libraryFilter.type === 'duplicates' && (
          <DuplicatesView
            onShowToast={showToast}
            onChanged={() => { loadItems(); loadCollectionsAndTags(); }}
            focusItemId={dupFocusItemId}
          />
        )}

        {activeTab === 'library' && libraryFilter.type !== 'duplicates' && (
          <LibraryGrid
            items={displayedItems}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSelectItem={handleSelectItem}
            selectedItemId={selectedItem?.id}
            activeItemConnections={activeItemConnections}
            onSync={handleSync}
            isSyncing={isSyncing}
            onImport={handleImport}
            filterLabel={libraryFilter.type === 'all' ? null : libraryFilter.label}
            onClearFilter={() => setLibraryFilter({ type: 'all' })}
            onExportBibTeX={handleExportBibTeX}
            onImportBibTeX={handleImportBibTeX}
            onImportRIS={handleImportRIS}
            isTrash={libraryFilter.type === 'trash'}
            onRestoreItem={handleRestoreItem}
            onDeleteForever={handleDeleteForever}
            onEmptyTrash={handleEmptyTrash}
          />
        )}

        {activeTab === 'discover' && (
          <DiscoverView onAdded={handleDiscoveryAdded} onOpenItem={openItemById} onError={(m) => showToast(m, 'alert')} />
        )}

        {activeTab === 'shared' && (
          <SharedVault items={items} onShowToast={showToast} onItemImported={loadItems} />
        )}

        {activeTab === 'scribe' && (
          <Scribe hubItems={items} onShowToast={showToast} />
        )}

        {activeTab === 'oracle' && (
          <OracleUI 
            query={oracleQuery}
            setQuery={setOracleQuery}
            response={oracleResponse}
            isLoading={isOracleLoading}
            onAsk={handleOracleAsk}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsUI 
            oracleConfig={oracleConfig}
            setOracleConfig={setOracleConfig}
            zoteroConfig={zoteroConfig}
            setZoteroConfig={setZoteroConfig}
            communityMode={communityMode}
            onToggleCommunity={async (s) => {
              setCommunityMode(s);
              localStorage.setItem('vashira_community_mode', s.toString());
              const result = await (window as any).vashiraAPI.toggleCommunityMode(s);
              setNatStatus(s ? (result?.nat ? 'Mesh Active • NAT Mapped' : 'Mesh Active • Manual Port Forward Required') : 'P2P Standby');
            }}
            onSyncZotero={handleSync}
            onSaveOracle={async () => {
              await (window as any).vashiraAPI.setSecret('oracle', oracleConfig);
              showToast('Oracle config saved (encrypted).');
            }}
            shareOnLan={shareOnLan === true}
            onToggleShareOnLan={() => chooseLanSharing(shareOnLan !== true)}
            isSyncing={isSyncing}
            natStatus={natStatus}
            citationStyle={citationStyle}
            onChangeCitationStyle={(style: string) => {
              setCitationStyle(style);
              localStorage.setItem('vashira_citation_style', style);
            }}
            onReplayTour={() => setShowTour(true)}
          />
        )}

        <KnowledgeHub 
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
          isDetailsOpen={isDetailsOpen}
          setIsDetailsOpen={setIsDetailsOpen}
          onUpdate={async () => {
            const res = await (window as any).vashiraAPI.updateItem(selectedItem.id, selectedItem);
            if (res.success) {
              showToast('Record Updated.');
              loadItems();
            }
          }}
          onGraphify={async () => {
             const result = await (window as any).vashiraAPI.graphifyItem(selectedItem.id);
             if (result.success) {
               setActiveItemConnections(result.connections);
               setViewMode('graph');
               showToast('Network Scanned.');
             } else {
               showToast(result.error, 'alert');
             }
          }}
          onCite={async () => {
             const cite = await (window as any).vashiraAPI.generateCitationRich(selectedItem.id, citationStyle);
             if (!cite) { showToast('Citation formatting failed.', 'alert'); return; }
             try {
               // Rich copy: Word / LibreOffice keep the style's italics and small caps.
               await navigator.clipboard.write([new ClipboardItem({
                 'text/plain': new Blob([cite.text], { type: 'text/plain' }),
                 'text/html': new Blob([cite.html], { type: 'text/html' }),
               })]);
             } catch {
               await navigator.clipboard.writeText(cite.text);
             }
             const styleLabel: Record<string, string> = { apa: 'APA', ieee: 'IEEE', mla: 'MLA', 'tapuscrit-note': 'Tapuscrit (notes)', 'tapuscrit-author-date': 'Tapuscrit (auteur-date)' };
             showToast(`${styleLabel[citationStyle] || citationStyle} citation copied.`);
          }}
          onTrash={() => selectedItem && handleTrashItem(selectedItem.id)}
          isTrashed={!!selectedItem?.deletedAt}
          onReviewDuplicates={() => selectedItem && openDuplicates(selectedItem.id)}
          onDiscoveryAdded={handleDiscoveryAdded}
          onOpenItem={openItemById}
          onError={(m: string) => showToast(m, 'alert')}
          dupes={dupes}
          collections={collections}
          onAddToCollection={handleAddItemToCollection}
          onAddTag={handleAddTagToItem}
          onRemoveTag={handleRemoveTagFromItem}
          onFetchFromCrossRef={async () => {
            if (!selectedItem?.doi) return;
            try {
              const fresh = await (window as any).vashiraAPI.fetchMetadata(selectedItem.doi);
              if (fresh) {
                setSelectedItem({ ...selectedItem, title: fresh.title, authors: fresh.authors, published: fresh.published, abstract: fresh.abstract || selectedItem.abstract });
                showToast('Refreshed from CrossRef.');
              } else {
                showToast('CrossRef has no record for this DOI.', 'alert');
              }
            } catch (e: any) {
              showToast(e.message || 'CrossRef lookup failed.', 'alert');
            }
          }}
        />
      </main>

      {toast && (
        <div className={`toast glass ${toast.type}`} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span>{toast.message}</span>
          {toast.actions?.map(a => (
            <button key={a.label} className="btn-secondary" style={{ padding: '5px 10px', fontSize: '0.7rem', flexShrink: 0 }} onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      )}

      {showTour && (
        <Tour
          activeTab={activeTab}
          onNavigate={setActiveTab}
          items={items}
          onSelectItem={handleSelectItem}
          onFinish={() => setShowTour(false)}
          onLanSharingChoice={chooseLanSharing}
        />
      )}

      {/* Asked once: new users answer inside the tour; anyone who never saw that step gets this. */}
      {shareOnLan === undefined && !showTour && <SharingPrompt onChoose={chooseLanSharing} />}
    </div>
  );
}
