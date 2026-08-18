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
  const [natStatus, setNatStatus] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'alert'} | null>(null);
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
  const [libraryFilter, setLibraryFilter] = useState<{ type: 'all' | 'collection' | 'tag'; id?: number; label?: string }>({ type: 'all' });
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

    return () => {
      if (unsubscribeIngested) unsubscribeIngested();
    };
  }, []);

  const loadItems = async () => {
    try {
      const result = await (window as any).vashiraAPI.getItems();
      setItems(result);
    } catch (e) {
      console.error('Failed to load library:', e);
    }
  };

  const loadConfigs = () => {
    const savedOracle = localStorage.getItem('vashira_oracle_config');
    if (savedOracle) setOracleConfig(JSON.parse(savedOracle));

    const savedZotero = localStorage.getItem('vashira_zotero_config');
    if (savedZotero) setZoteroConfig(JSON.parse(savedZotero));

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
        showToast(`Imported ${result.length} item(s) from BibTeX.`);
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
        showToast(`Imported ${result.length} item(s) from RIS.`);
        loadItems();
      }
    } catch (e: any) {
      showToast(e.message || 'RIS import failed.', 'alert');
    }
  };

  const showToast = (message: string, type: 'success' | 'alert' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSelectItem = async (item: any) => {
    setSelectedItem(item);
    setIsDetailsOpen(true);
    try {
      const d = await (window as any).vashiraAPI.checkDuplicates(item.title);
      setDupes(d || []);
    } catch (e) {
      console.error('Duplicate check failed:', e);
      setDupes([]);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
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

  const handleImport = async () => {
    try {
      const result = await (window as any).vashiraAPI.importPDF();
      if (result.success) {
        showToast('Artifact Mastered.');
        loadItems();
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
        onSelectFilter={(f) => { setLibraryFilter(f); setActiveTab('library'); }}
        onCreateCollection={handleCreateCollection}
      />

      <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        {activeTab === 'library' && (
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
          />
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
            onSaveOracle={() => {
              localStorage.setItem('vashira_oracle_config', JSON.stringify(oracleConfig));
              showToast('Oracle Config Persisted.');
            }}
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
             const cite = await (window as any).vashiraAPI.generateCitation(selectedItem.id, citationStyle);
             navigator.clipboard.writeText(cite);
             showToast(`${citationStyle.toUpperCase()} citation copied.`);
          }}
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
        <div className={`toast glass ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {showTour && (
        <Tour
          activeTab={activeTab}
          onNavigate={setActiveTab}
          items={items}
          onSelectItem={handleSelectItem}
          onFinish={() => setShowTour(false)}
        />
      )}
    </div>
  );
}
