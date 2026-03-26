import React, { useState, useEffect } from 'react';
import { 
  Library, 
  Settings, 
  Share2, 
  Search, 
  Plus, 
  Globe, 
  Clock, 
  ChevronRight,
  FileText,
  Trash2,
  FolderPlus,
  Folder,
  Download,
  Database,
  Quote,
  Users,
  Rss,
  Eye,
  ExternalLink,
  X,
  FileCode,
  BookOpen,
  Copy,
  Zap,
  Activity,
  ShieldCheck,
  Cpu
} from 'lucide-react';

interface ResearchItem {
  id: number;
  title: string;
  itemType: string;
  doi?: string;
  dateAdded: string;
  authors?: string;
  published?: string;
  abstract?: string;
  filePath?: string;
}

interface SyncRecord {
  id: number;
  action: string;
  targetTable: string;
  targetId: number;
  data: string;
  timestamp: string;
}

interface PeerDiscovery {
  doi: string;
  title: string;
  peer: string;
}

declare global {
  interface Window {
    vashiraAPI: {
      getItems: () => Promise<ResearchItem[]>;
      addItem: (item: any) => Promise<number>;
      getNotes: (itemId: number) => Promise<any[]>;
      addNote: (itemId: number, content: string) => Promise<void>;
      fetchMetadata: (doi: string) => Promise<any>;
      importPDF: () => Promise<any>;
      getCollections: () => Promise<any[]>;
      createCollection: (name: string, parentId?: number) => Promise<number>;
      addItemToCollection: (itemId: number, collectionId: number) => Promise<void>;
      getItemsByCollection: (collectionId: number) => Promise<ResearchItem[]>;
      generateCitation: (itemId: number) => Promise<string>;
      getSyncLog: () => Promise<SyncRecord[]>;
      getSyncCount: () => Promise<number>;
      getPeers: () => Promise<string[]>;
      getDiscoveries: () => Promise<PeerDiscovery[]>;
      announceMetadata: (doi: string, title: string) => Promise<void>;
      openFile: (filePath: string) => Promise<boolean>;
      importBibTeX: () => Promise<any[]>;
      importRIS: () => Promise<any[]>;
      readFile: (filePath: string) => Promise<Uint8Array>;
    }
  }
}

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('library');
  const [hubTab, setHubTab] = useState('excerpts'); 
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ResearchItem | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [citation, setCitation] = useState('');
  const [newNote, setNewNote] = useState('');
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [showDoiModal, setShowDoiModal] = useState(false);
  const [doiInput, setDoiInput] = useState('');
  const [syncLog, setSyncLog] = useState<SyncRecord[]>([]);
  const [syncCount, setSyncCount] = useState(0);
  const [peers, setPeers] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState<PeerDiscovery[]>([]);
  const [masterName, setMasterName] = useState('Master Rafael');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [stats, setStats] = useState({ items: 0, collections: 0 });
  const [citationStyle, setCitationStyle] = useState<'apa' | 'ieee' | 'mla'>('apa');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState(false);
  const [tags, setTags] = useState<any[]>([]);
  const [activeTagId, setActiveTagId] = useState<number | null>(null);
  const [smartCategory, setSmartCategory] = useState<'all' | 'unfiled' | 'recent'>('all');

  const loadItems = async () => {
    try {
      let data;
      if (activeCollectionId) {
        data = await window.vashiraAPI.getItemsByCollection(activeCollectionId);
      } else {
        data = await window.vashiraAPI.getItems();
      }
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCollections = async () => {
    try {
      const data = await window.vashiraAPI.getCollections();
      setCollections(data);
      const tagData = await (window.vashiraAPI as any).getAllTags();
      setTags(tagData || []);
    } catch (e) {
      console.error(e);
    }
  };

  const loadSyncData = async () => {
    const count = await window.vashiraAPI.getSyncCount();
    setSyncCount(count);
    if (activeTab === 'shared') {
      const log = await window.vashiraAPI.getSyncLog();
      setSyncLog(log);
      const onlinePeers = await window.vashiraAPI.getPeers();
      setPeers(onlinePeers);
      const networkDiscoveries = await window.vashiraAPI.getDiscoveries();
      setDiscoveries(networkDiscoveries);
    }
  };

  const loadNotes = async (itemId: number) => {
    const data = await window.vashiraAPI.getNotes(itemId);
    setNotes(data);
  };

  const loadCitation = async (itemId: number, style: any = citationStyle) => {
    const text = await window.vashiraAPI.generateCitation(itemId); // The current IPC only does APA, but for 3.0 we'll wrap it or pass style
    setCitation(text);
  };

  useEffect(() => {
    const init = async () => {
       if (activeTagId) {
          const data = await (window.vashiraAPI as any).getItemsByTag(activeTagId);
          setItems(data);
       } else if (smartCategory !== 'all') {
          const data = await (window.vashiraAPI as any).getItemsByCategory(smartCategory);
          setItems(data);
       } else {
          loadItems();
       }
       loadCollections();
       loadSyncData();
    };
    init();
  }, [activeCollectionId, activeTab, activeTagId, smartCategory, items.length]);

  useEffect(() => {
    if (selectedItem) {
      loadNotes(selectedItem.id);
      loadCitation(selectedItem.id);
    }
  }, [selectedItem]);

  const handleAddItem = async () => {
    if (!doiInput) return;
    setLoading(true);
    setShowDoiModal(false);
    try {
      const metadata = await window.vashiraAPI.fetchMetadata(doiInput);
      const finalItem = metadata || { 
        title: 'Manual Entry: ' + doiInput, 
        itemType: 'generic', 
        doi: doiInput,
        authors: 'Unknown',
        published: 'N/A'
      };
      
      await window.vashiraAPI.addItem(finalItem);
      await window.vashiraAPI.announceMetadata(finalItem.doi, finalItem.title);
      loadItems();
      loadSyncData();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setDoiInput('');
    }
  };

  const showToast = (message: string, type: 'success' | 'alert' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleImportPDF = async () => {
    setLoading(true);
    try {
      const metadata = await window.vashiraAPI.importPDF();
      if (metadata) {
        await window.vashiraAPI.addItem(metadata);
        await window.vashiraAPI.announceMetadata(metadata.doi || 'N/A', metadata.title);
        showToast("PDF Mastery Vault updated!");
        loadItems();
        loadSyncData();
      }
    } catch (e) {
      console.error(e);
      showToast("Mastery interrupted.", "alert");
    } finally {
      setLoading(false);
      setIsImportMenuOpen(false);
    }
  };

  const handleImportFormat = async (type: 'bib' | 'ris') => {
    setLoading(true);
    try {
      const items = type === 'bib' ? await window.vashiraAPI.importBibTeX() : await window.vashiraAPI.importRIS();
      if (items && items.length > 0) {
        for (const item of items) {
           await window.vashiraAPI.addItem(item);
        }
        showToast(`${items.length} items synthesized into Library.`);
        loadItems();
      }
    } catch (e) {
      console.error(e);
      showToast("Formation error.", "alert");
    } finally {
      setLoading(false);
      setIsImportMenuOpen(false);
    }
  };

const handleOpenReader = async (item: ResearchItem) => {
    if (!item.filePath) return;
    try {
      const buffer = await window.vashiraAPI.readFile(item.filePath);
      const blob = new Blob([buffer as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setIsReaderOpen(true);
    } catch (e) {
      console.error(e);
      showToast("Cannot read from vault.", "alert");
    }
  };

  const closeReader = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setIsReaderOpen(false);
  };

  const handleAddNote = async () => {
    if (!selectedItem || !newNote) return;
    await window.vashiraAPI.addNote(selectedItem.id, newNote);
    setNewNote('');
    loadNotes(selectedItem.id);
    loadSyncData();
  };

  const handleAddToCollection = async (collectionId: number) => {
    if (!selectedItem) return;
    await window.vashiraAPI.addItemToCollection(selectedItem.id, collectionId);
    alert(`Added to collection!`);
  };

  const handleOpenFile = async (path?: string) => {
    if (!path) return;
    const success = await window.vashiraAPI.openFile(path);
    if (!success) alert("Failed to open file. Mastery requires a valid path.");
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied directly to mastery!");
  };

  return (
    <div className="app-container">
      <div className="titlebar"></div>
      
      <aside className="sidebar">
        <div className="logo-section" onClick={() => { setActiveTab('library'); setActiveCollectionId(null); setSelectedItem(null); }} style={{ cursor: 'pointer' }}>
          <Database size={24} color="#a78bfa" />
          <span className="logo-text">VASHIRA</span>
        </div>
        
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
          <div 
            className={`nav-item ${activeTab === 'library' && !activeCollectionId && !activeTagId && smartCategory === 'all' ? 'active' : ''}`}
            onClick={() => { setActiveTab('library'); setActiveCollectionId(null); setActiveTagId(null); setSmartCategory('all'); }}
          >
            <Library />
            <span>Sovereign Vault</span>
          </div>

          <div 
            className={`nav-item ${smartCategory === 'recent' ? 'active' : ''}`}
            onClick={() => { setSmartCategory('recent'); setActiveCollectionId(null); setActiveTagId(null); }}
            style={{ paddingLeft: '24px', opacity: 0.8 }}
          >
            <Clock size={16} />
            <span>Recently Added</span>
          </div>

          <div 
            className={`nav-item ${smartCategory === 'unfiled' ? 'active' : ''}`}
            onClick={() => { setSmartCategory('unfiled'); setActiveCollectionId(null); setActiveTagId(null); }}
            style={{ paddingLeft: '24px', opacity: 0.8 }}
          >
            <Folder size={16} />
            <span>Unfiled Items</span>
          </div>

          <div style={{ marginTop: '20px', padding: '0 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Collections</span>
              <FolderPlus size={14} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={async () => {
                const name = prompt('New Collection Name:');
                if (name) {
                  await window.vashiraAPI.createCollection(name);
                  loadCollections();
                }
              }} />
            </div>
            {collections.map(col => (
              <div 
                key={col.id}
                className={`nav-item ${activeCollectionId === col.id ? 'active' : ''}`}
                onClick={() => { setActiveTab('library'); setActiveCollectionId(col.id); setActiveTagId(null); setSmartCategory('all'); }}
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              >
                <Folder size={16} />
                <span>{col.name}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '20px', padding: '0 12px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mastery Tags</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {tags.map(tag => (
                <div 
                  key={tag.id}
                  className={`tag-chip ${activeTagId === tag.id ? 'active' : ''}`}
                  onClick={() => { setActiveTagId(tag.id); setActiveCollectionId(null); setSmartCategory('all'); }}
                  style={{ background: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40`, padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  {tag.name}
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '20px' }}></div>
          
          <div className={`nav-item ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
            <Activity />
            <span>Mastery Index</span>
            <span style={{ marginLeft: 'auto', background: 'var(--accent-color)', color: 'var(--bg-color)', fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 700 }}>{syncCount}</span>
          </div>
          <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
            <Settings />
            <span>Settings</span>
          </div>
        </nav>

        <div style={{ padding: '16px 8px', borderTop: '1px solid var(--border-color)' }}>
          <div className="nav-item">
            <Download />
            <span>EU Sync Enabled</span>
          </div>
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '12px', padding: '0 8px', fontStyle: 'italic' }}>
            वशीर (Vaśīra): The one who possesses mastery
          </p>
          <p style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', padding: '0 8px', marginTop: '4px', opacity: 0.6 }}>
             © 2026 Rafael Domingo Ramones. Tous droits réservés.
          </p>
        </div>
      </aside>

      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>
            {activeTab === 'library' && (activeCollectionId ? collections.find(c => c.id === activeCollectionId)?.name : 'My Library')}
            {activeTab === 'shared' && 'Mastery Index'}
            {activeTab === 'settings' && 'Settings'}
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            {activeTab === 'library' && (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setIsImportMenuOpen(!isImportMenuOpen)} className="secondary-button">
                  <Download size={18} />
                  Import Mastery
                </button>
                {isImportMenuOpen && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', zIndex: 100, width: '180px', marginTop: '8px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}>
                    <div className="menu-item" onClick={handleImportPDF} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <FileText size={16} /> PDF File
                    </div>
                    <div className="menu-item" onClick={() => handleImportFormat('bib')} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      <FileCode size={16} /> BibTeX (.bib)
                    </div>
                    <div className="menu-item" onClick={() => handleImportFormat('ris')} style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', cursor: 'pointer' }}>
                      <BookOpen size={16} /> RIS (.ris)
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'library' && (
              <button onClick={() => setShowDoiModal(true)} className="primary-button">
                <Plus size={18} />
                Add via DOI
              </button>
            )}
            {activeTab === 'shared' && (
              <button className="primary-button" style={{ background: '#10b981' }}>
                <Zap size={18} />
                Mastery Broadcast
              </button>
            )}
          </div>
        </header>

        {activeTab === 'library' ? (
          <div style={{ display: 'flex', flex: 1, gap: '24px', overflow: 'hidden' }}>
            <div className="list-view fade-in">
              {loading ? (
                <p>Gathering knowledge...</p>
              ) : items.length === 0 ? (
                <div className="empty-state-card">
                  <Database size={48} color="var(--border-color)" style={{ marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px' }}>Your research starts here</h3>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {activeCollectionId ? 'This collection is empty.' : 'Click "Add via DOI" to import your first paper.'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', alignContent: 'start' }}>
                  {items.map(item => (
                    <div 
                      key={item.id} 
                      className={`card ${selectedItem?.id === item.id ? 'active' : ''}`}
                      onClick={() => setSelectedItem(item)}
                      onDoubleClick={() => handleOpenFile(item.filePath)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <FileText 
                          size={20} 
                          color={item.filePath ? "#10b981" : "#a78bfa"} 
                          onClick={(e) => {
                            if (item.filePath) {
                               e.stopPropagation();
                               handleOpenFile(item.filePath);
                            }
                          }}
                        />
                        <div>
                          <h3 style={{ marginBottom: '4px', fontSize: '0.95rem', fontWeight: 600 }}>{item.title}</h3>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{item.itemType} • {new Date(item.dateAdded).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="fade-in knowledge-hub">
                <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>Knowledge Hub</h2>
                    <button className="icon-button" onClick={() => setSelectedItem(null)}><ChevronRight size={18} /></button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedItem.title}</p>
                  
                  <div className="hub-tabs" style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                    <button className={`hub-tab ${hubTab === 'excerpts' ? 'active' : ''}`} onClick={() => setHubTab('excerpts')}>Excerpts</button>
                    <button className={`hub-tab ${hubTab === 'citations' ? 'active' : ''}`} onClick={() => setHubTab('citations')}>Cite</button>
                    {selectedItem.filePath && (
                      <button 
                        className="hub-tab" 
                        onClick={() => handleOpenFile(selectedItem.filePath)}
                        style={{ marginLeft: 'auto', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '0.7rem' }}
                      >
                        Open PDF
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '12px' }}>
                    {tags.filter(t => (selectedItem as any).tags?.split(',').includes(t.name)).map(tag => (
                       <span key={tag.id} style={{ background: tag.color + '20', color: tag.color, padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem' }}>{tag.name}</span>
                    ))}
                    <button 
                      style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', padding: '1px 6px', borderRadius: '10px', fontSize: '0.65rem', cursor: 'pointer' }}
                      onClick={async () => {
                        const name = prompt('Add Mastery Tag:');
                        if (name) {
                          const tagId = await (window.vashiraAPI as any).addTag(name);
                          await (window.vashiraAPI as any).addTagToItem(selectedItem!.id, tagId);
                          loadCollections(); // Refresh tags
                        }
                      }}
                    >+ Tag</button>
                  </div>
                </div>
                
                <div className="hub-content">
                  {hubTab === 'excerpts' ? (
                    <div className="hub-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 className="section-title" style={{ margin: 0 }}>SAVED QUOTES</h4>
                        <select 
                          onChange={(e) => handleAddToCollection(Number(e.target.value))}
                          defaultValue=""
                          style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px' }}
                        >
                          <option value="" disabled>Add to Folder...</option>
                          {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {notes.length === 0 ? (
                        <p className="empty-text">No excerpts captured yet.</p>
                      ) : (
                        notes.map(note => (
                          <div key={note.id} className="note-card">
                            <p>"{note.content}"</p>
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    <div className="hub-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 className="section-title" style={{ margin: 0 }}>BIBLIOGRAPHY</h4>
                        <select 
                          value={citationStyle}
                          onChange={(e) => {
                             const style = e.target.value as any;
                             setCitationStyle(style);
                             loadCitation(selectedItem!.id, style);
                          }}
                          style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px 4px' }}
                        >
                          <option value="apa">APA 7th</option>
                          <option value="ieee">IEEE</option>
                          <option value="mla">MLA 9th</option>
                        </select>
                      </div>
                      <div className="note-card" style={{ background: 'rgba(167, 139, 250, 0.05)', borderLeft: '3px solid #a78bfa' }}>
                         <div dangerouslySetInnerHTML={{ __html: citation }} style={{ fontSize: '0.9rem', lineHeight: '1.6' }} />
                         <button 
                          className="secondary-button full-width" 
                          style={{ marginTop: '16px', fontSize: '0.75rem' }}
                          onClick={() => copyToClipboard(citation.replace(/<[^>]*>/g, ''))}
                         >
                           <Copy size={14} /> Copy Plain Text
                         </button>
                      </div>
                    </div>
                  )}
                </div>

                {hubTab === 'excerpts' && (
                  <div className="hub-footer">
                    <textarea 
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Capture a quote..."
                    />
                    <button onClick={handleAddNote} className="primary-button full-width">
                      Save to Hub
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'shared' ? (
          <div className="sync-dashboard fade-in" style={{ display: 'flex', gap: '24px' }}>
             <div style={{ flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                   <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <Activity size={24} color="#a78bfa" />
                      <div>
                         <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Mastery Events</h4>
                         <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{syncCount}</p>
                      </div>
                   </div>
                   <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <Rss size={24} color="#10b981" />
                      <div>
                         <h4 style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Network Discovery</h4>
                         <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>Active</p>
                      </div>
                   </div>
                </div>

                <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>Decentralized DOI Feed</h3>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                   <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                      <thead style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                         <tr>
                            <th style={{ padding: '12px 20px' }}>DOI Discovery</th>
                            <th style={{ padding: '12px 20px' }}>Master Node</th>
                         </tr>
                      </thead>
                      <tbody>
                         {discoveries.map((discovery, idx) => (
                           <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '12px 20px' }}>
                                 <div style={{ fontWeight: 600 }}>{discovery.title}</div>
                                 <div style={{ fontSize: '0.7rem', color: 'var(--accent-color)' }}>{discovery.doi}</div>
                              </td>
                              <td style={{ padding: '12px 20px' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
                                    {discovery.peer}
                                 </div>
                              </td>
                           </tr>
                         ))}
                      </tbody>
                   </table>
                </div>

                <div style={{ marginTop: '32px' }}>
                  <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600 }}>Local Change Log</h3>
                  <div className="card" style={{ maxHeight: '300px', overflowY: 'auto', padding: 0 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                        <tbody>
                            {syncLog.map(log => (
                              <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '8px 20px' }}>#{log.id}</td>
                                <td style={{ padding: '8px 20px' }}>{log.action}</td>
                                <td style={{ padding: '8px 20px', color: 'var(--text-secondary)' }}>{log.targetTable}</td>
                                <td style={{ padding: '8px 20px', color: 'var(--text-secondary)' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                  </div>
                </div>
             </div>

             <div style={{ width: '300px' }}>
                <div className="card" style={{ position: 'sticky', top: '0' }}>
                   <h3 style={{ marginBottom: '16px', fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={18} /> Online Masters
                   </h3>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {peers.map((peer, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                           <div style={{ width: '32px', height: '32px', background: 'var(--accent-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem' }}>
                              {peer.charAt(0)}
                           </div>
                           <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{peer}</div>
                              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Connected via Mastery DHT</div>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
          </div>
        ) : activeTab === 'settings' ? (
          <div className="settings-view fade-in">
             <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'left', padding: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                   <Settings size={32} color="var(--accent-color)" />
                   <h2 style={{ margin: 0 }}>System Configuration</h2>
                </div>
                   <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Hub Identity</h4>
                    <div style={{ marginBottom: '16px' }}>
                       <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>MASTER NAME</label>
                       <input 
                          type="text" 
                          value={masterName} 
                          onChange={(e) => setMasterName(e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', color: 'white', padding: '8px', width: '100%', borderRadius: '4px' }}
                       />
                    </div>
                    <div>
                       <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={syncEnabled} onChange={(e) => setSyncEnabled(e.target.checked)} />
                          <span style={{ fontSize: '0.85rem' }}>Enable Local P2P Mastery Broadcast</span>
                       </label>
                    </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                    <div className="card">
                       <h4 style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>LIBRARY SIZE</h4>
                       <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{items.length} Papers</p>
                    </div>
                    <div className="card">
                       <h4 style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>COLLECTIONS</h4>
                       <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>{collections.length} Folders</p>
                    </div>
                 </div>

                 <div style={{ padding: '20px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <h4 style={{ fontSize: '0.8rem', color: 'var(--accent-color)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Mastery Credentials</h4>
                    <p style={{ fontSize: '1rem', marginBottom: '4px', fontWeight: 600 }}>{masterName}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>Registered Master of the Vashira Hub v2.0</p>
                    
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                       <a href="https://ram0nes.com/" target="_blank" className="social-link">Official Website</a>
                       <a href="https://vashira.org" target="_blank" className="social-link" style={{ fontWeight: 700 }}>vashira.org</a>
                       <a href="https://github.com/rafgomindo/vashira" target="_blank" className="social-link">Source</a>
                    </div>
                 </div>

                <div style={{ marginTop: '24px', padding: '16px', background: 'linear-gradient(90deg, #a78bfa 0%, #3b82f6 100%)', borderRadius: '12px', color: '#fff' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                         <h4 style={{ fontWeight: 700 }}>VASHIRA PRO</h4>
                         <p style={{ fontSize: '0.8rem', opacity: 0.9 }}>Unlock Unlimited Mastery Hub Collaboration</p>
                      </div>
                      <button className="primary-button" style={{ background: '#fff', color: '#a78bfa', border: 'none' }}>Upgrade</button>
                   </div>
                </div>

                <div style={{ marginTop: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                   <p>Vashira Version: 1.0.0 (Mastery Edition)</p>
                   <p>© 2026 Rafael Domingo Ramones. Tous droits réservés.</p>
                   <p style={{ marginTop: '8px', color: 'var(--accent-color)' }}>Program web concept par "Le Rafael" 😎 @ Ram0nes.com .</p>
                </div>
             </div>
          </div>
        ) : (
          <div className="empty-view fade-in">
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <h3>Section coming soon</h3>
              <p>We are refining the {activeTab} experience.</p>
            </div>
          </div>
        )}
      </main>

      {showDoiModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Import via DOI</h2>
            <input 
              type="text" 
              placeholder="e.g. 10.1038/s41586-020-2163-9"
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowDoiModal(false)} className="cancel-button">Cancel</button>
              <button onClick={handleAddItem} className="primary-button">Import</button>
            </div>
          </div>
        </div>
      )}

      {isReaderOpen && pdfUrl && (
        <div className="pdf-reader-overlay fade-in">
          <div className="pdf-reader-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BookOpen size={20} color="var(--accent-color)" />
              <span style={{ fontWeight: 600 }}>{selectedItem?.title}</span>
            </div>
            <button className="icon-button" onClick={closeReader}><X size={24} /></button>
          </div>
          <div className="pdf-reader-body">
            <iframe src={pdfUrl} width="100%" height="100%" />
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast floating ${toast.type}`}>
          {toast.type === 'success' ? <ShieldCheck size={18} /> : <Zap size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default App;
