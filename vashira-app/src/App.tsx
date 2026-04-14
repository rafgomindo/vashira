import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Database, Settings, BookOpen, Activity, 
  ChevronRight, FileText, Download, Zap, Share2, 
  Tag, Clock, Folder, Globe, Clipboard, Check, Filter,
  Columns, Smartphone, ShieldCheck, PenTool, MessageSquare,
  Cpu, Terminal, Power, Camera, LayoutGrid, Network, Shield,
  Minimize2, Maximize2, X, Square, Copy
} from 'lucide-react';
import Scribe from './components/Scribe.js';
import { askTheOracle, OracleConfig } from './oracle.js';
import ForceGraph2D from 'react-force-graph-2d';

const WindowControls = () => {
  const [isMax, setIsMax] = useState(false);

  useEffect(() => {
    const checkMax = async () => {
      const max = await (window as any).vashiraAPI.isMaximized();
      setIsMax(max);
    };
    checkMax();
    window.addEventListener('resize', checkMax);
    return () => window.removeEventListener('resize', checkMax);
  }, []);

  return (
    <div className="window-controls">
      <div className="window-control-btn" onClick={() => (window as any).vashiraAPI.minimizeWindow()}>
        <Minimize2 size={14} />
      </div>
      <div className="window-control-btn" onClick={() => (window as any).vashiraAPI.maximizeWindow()}>
        {isMax ? <Copy size={14} style={{ transform: 'rotate(180deg)' }} /> : <Square size={14} />}
      </div>
      <div className="window-control-btn close" onClick={() => (window as any).vashiraAPI.closeWindow()}>
        <X size={14} />
      </div>
    </div>
  );
};

interface ResearchItem {
  id: number;
  title: string;
  itemType: string;
  doi: string;
  dateAdded: string;
  authors: string;
  published: string;
  publisher?: string;
  pages?: number;
  abstract: string;
  url?: string;
  filePath?: string;
  snapshotPath?: string;
  fileHash?: string;
  content?: string;
  masteryStatus?: string;
}

const ConsensusAdvisory = ({ identifier, onApply }: { identifier: string | undefined, onApply: (m: any) => void }) => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  
  useEffect(() => {
    if (identifier) {
      (window as any).vashiraAPI.getConsensus(identifier).then(setSuggestions);
    }
  }, [identifier]);

  if (suggestions.length === 0) return null;
  const top = suggestions[0];
  if (top.votes < 2) return null; // Only show if at least 2 peers agree

  return (
    <div className="glass" style={{ marginTop: '12px', padding: '12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
       <p style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={12} /> VOX POPULIS ADVISORY (\${top.votes} Peers Agree)
       </p>
       <p style={{ fontSize: '0.8rem', marginBottom: '8px', opacity: 0.8 }}>The community suggests: <strong style={{color: 'white'}}>{top.title}</strong> by {top.authors}</p>
       <button className="primary-button small" style={{ background: '#10b981', width: '100%' }} onClick={() => onApply(top)}>APPLY CONSENSUS</button>
    </div>
  );
}

const BarcodeScanner = ({ onScan }: { onScan: (isbn: string) => void }) => {
  const [active, setActive] = useState(false);
  const [detectorActive, setDetectorActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let interval: any;
    if (active && videoRef.current) {
       // Check for native BarcodeDetector support
       if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128'] });
          setDetectorActive(true);
          interval = setInterval(async () => {
             if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                try {
                   const barcodes = await detector.detect(videoRef.current);
                   if (barcodes.length > 0) {
                      onScan(barcodes[0].rawValue);
                      stopCamera();
                   }
                } catch (e) {
                   console.error('Detection failed:', e);
                }
             }
          }, 500);
       }
    }
    return () => clearInterval(interval);
  }, [active]);

  const startCamera = async () => {
    setActive(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (videoRef.current) videoRef.current.srcObject = stream;
  };

  const stopCamera = () => {
    setActive(false);
    if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  };

  return (
    <div style={{ position: 'relative' }}>
       {!active ? (
         <button className="icon-button" onClick={startCamera} title="Scan Barcode"><Camera size={18} /></button>
       ) : (
         <div className="glass" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgbaUnmatched (0,0,0,0.9)' }}>
            <div style={{ position: 'relative', width: '80%', maxWidth: '500px' }}>
               <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: '24px', border: '4px solid var(--accent-color)' }} />
               <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '2px', background: 'var(--accent-color)', boxShadow: '0 0 10px var(--accent-color)', transform: 'translateY(-50%)', opacity: 0.5 }}></div>
            </div>
            
            <div style={{ marginTop: '24px', display: 'flex', gap: '16px' }}>
               {!detectorActive && <button className="primary-button" onClick={() => { onScan('ISBN:9781234567890'); stopCamera(); }}>Demo Scan</button>}
               <button className="secondary-button" onClick={stopCamera}>Cancel</button>
            </div>
            <p style={{ marginTop: '16px', color: 'var(--accent-color)', fontWeight: 700 }}>
               {detectorActive ? 'REAL-TIME SCANNING ACTIVE...' : 'CAMERA ACTIVE (USE DEMO OR CHECK HTTPS)'}
            </p>
         </div>
       )}
    </div>
  );
};

const TopMenuBar = ({ onAction }: { onAction: (action: string) => void }) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const menus = [
    { name: 'File', items: ['Import PDF', 'Import BibTeX', 'Batch Metadata', 'Export Hub (BibTeX)', 'Quit'] },
    { name: 'Edit', items: ['Copy Metadata', 'Edit Notes', 'Magic Categorize'] },
    { name: 'View', items: ['Toggle Fullscreen', 'Show/Hide Details', 'Reset Layout'] },
    { name: 'Mastery', items: ['P2P Discovery', 'Sovereign Extensions', 'Oracle Settings', 'Check for Consensus'] },
  ];

  return (
    <div className="glass" style={{ height: '32px', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '20px', fontSize: '0.75rem', fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative', zIndex: 2000 }}>
       {menus.map(menu => (
         <div key={menu.name} style={{ position: 'relative' }}>
            <span 
              style={{ cursor: 'pointer', opacity: activeMenu === menu.name ? 1 : 0.6 }}
              onMouseEnter={() => setActiveMenu(menu.name)}
              onClick={() => setActiveMenu(activeMenu === menu.name ? null : menu.name)}
            >
              {menu.name}
            </span>
            {activeMenu === menu.name && (
              <div 
                className="glass" 
                style={{ position: 'absolute', top: '100%', left: 0, minWidth: '180px', padding: '8px 0', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: '8px' }}
                onMouseLeave={() => setActiveMenu(null)}
              >
                 {menu.items.map(item => (
                   <div 
                     key={item} 
                     className="menu-item" 
                     style={{ padding: '6px 16px', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}
                     onClick={() => { onAction(item); setActiveMenu(null); }}
                   >
                     {item}
                   </div>
                 ))}
              </div>
            )}
         </div>
       ))}
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'library' | 'shared' | 'oracle' | 'scribe' | 'settings' | 'librarian'>('library');
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ResearchItem | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [showDoiModal, setShowDoiModal] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [showPdfReader, setShowPdfReader] = useState(false);
  const [pdfPath, setPdfPath] = useState('');
  const [showSnapshotReader, setShowSnapshotReader] = useState(false);
  const [snapshotPath, setSnapshotPath] = useState('');
  const [peers, setPeers] = useState<string[]>([]);
  const [communityMode, setCommunityMode] = useState(localStorage.getItem('vashira_community_mode') === 'true');
  const [natStatus, setNatStatus] = useState(false);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'alert' } | null>(null);
  const [tags, setTags] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeepSearch, setIsDeepSearch] = useState(false);
  const [librarianResults, setLibrarianResults] = useState<any[]>([]);
  
  // Oracle State (5.0)
  const [oracleQuery, setOracleQuery] = useState('');
  const [oracleResponse, setOracleResponse] = useState('');
  const [isOracleLoading, setIsOracleLoading] = useState(false);
  const [activeItemConnections, setActiveItemConnections] = useState<{zoteroKeys: string[], gefyraTools: string[], vashiraItems: string[]} | null>(null);
    model: localStorage.getItem('vashira_oracle_model') || 'gpt-4o'
  });
  const [zoteroConfig, setZoteroConfig] = useState({
    userId: localStorage.getItem('vashira_zotero_user') || '',
    apiKey: localStorage.getItem('vashira_zotero_key') || ''
  });
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    loadItems();
    loadCollections();
    loadTags();
    
    // Listen for Web-Snatcher (5.0)
    (window as any).vashiraAPI.onSnatchedItem((item: any) => {
       showToast(`Snatched: \${item.title.substring(0, 30)}...`, 'success');
       loadItems();
    });

    const interval = setInterval(async () => {
      const p = await (window.vashiraAPI as any).getPeers();
      const d = await (window.vashiraAPI as any).getDiscoveries();
      setPeers(p);
      setDiscoveries(d);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadItems = async () => {
    setLoading(true);
    const data = await (window.vashiraAPI as any).getItems();
    setItems(data);
    setLoading(false);
  };

  const loadCollections = async () => {
    const data = await (window.vashiraAPI as any).getCollections();
    setCollections(data);
  };

  const loadTags = async () => {
    const data = await (window.vashiraAPI as any).getAllTags();
    setTags(data);
  };

  const showToast = (message: string, type: 'success' | 'alert' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const initDatabase = async () => {
    await (window as any).vashiraAPI.initDatabase();
  };

  const loadNotes = async (itemId: number) => {
    const data = await (window as any).vashiraAPI.getNotes(itemId);
    // console.log('Notes loaded', data);
  };

  const loadStyles = async () => {
    // Styling is handled by global CSS but state could go here
  };

  const [annotations, setAnnotations] = useState<any[]>([]);
  const [activeAnnotationType, setActiveAnnotationType] = useState<'highlight' | 'sticky'>('sticky');

  const loadAnnotations = async (itemId: number) => {
    const data = await (window as any).vashiraAPI.getAnnotations(itemId);
    setAnnotations(data);
  };

  const saveAnnotation = async (content: string, position: string) => {
    if (!selectedItem) return;
    await (window as any).vashiraAPI.addAnnotation(selectedItem.id, activeAnnotationType, content, position, '#a78bfa');
    loadAnnotations(selectedItem.id);
    showToast('Insight Mastered.');
  };

  const handleIngested = (item: any) => {
    setItems(prev => [item, ...prev]);
    showToast(`Sentinel captured: ${item.title}`);
  };

  useEffect(() => {
    initDatabase();
    loadItems();
    loadStyles();
    
    const unlisten = (window as any).vashiraAPI.onItemIngested(handleIngested);
    return () => unlisten();
  }, []);

  const [dupes, setDupes] = useState<any[]>([]);
  useEffect(() => {
    if (selectedItem) {
      loadNotes(selectedItem.id);
      loadAnnotations(selectedItem.id);
      (window as any).vashiraAPI.checkDuplicates(selectedItem.title).then(setDupes);
    }
  }, [selectedItem]);

  const handleOracleAsk = async () => {
    if (!oracleQuery) return;
    setIsOracleLoading(true);
    setOracleResponse('');
    try {
      const resp = await askTheOracle(oracleQuery, oracleConfig, window.vashiraAPI);
      setOracleResponse(resp);
    } catch (e: any) {
      showToast(e.message, 'alert');
    }
    setIsOracleLoading(false);
  };
  const saveOracleConfig = () => {
    localStorage.setItem('vashira_oracle_key', oracleConfig.apiKey);
    localStorage.setItem('vashira_oracle_url', oracleConfig.baseUrl);
    localStorage.setItem('vashira_oracle_model', oracleConfig.model);
    showToast('Oracle connectivity persisted.');
  };

  const syncWithZotero = async () => {
    if (!zoteroConfig.userId || !zoteroConfig.apiKey) {
      showToast('Zotero credentials missing.', 'alert');
      return;
    }
    setIsSyncing(true);
    localStorage.setItem('vashira_zotero_user', zoteroConfig.userId);
    localStorage.setItem('vashira_zotero_key', zoteroConfig.apiKey);
    
    const result = await (window as any).vashiraAPI.syncZotero(zoteroConfig.userId, zoteroConfig.apiKey);
    setIsSyncing(false);
    
    if (result.success) {
      showToast(`Zotero Sync Complete: ${result.count} new items.`);
      loadItems();
    } else {
      showToast(result.error, 'alert');
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'searching' | 'connected'>('idle');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['title', 'authors', 'published']);
  const [viewMode, setViewMode] = useState<'list' | 'graph' | 'grid'>('grid');
  const [sidebarWidth, setSidebarWidth] = useState(260);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

  const graphData = useMemo(() => {
    let nodes = filteredItems.map(item => ({
      id: item.id,
      name: item.title,
      val: 5,
      authors: item.authors,
      published: item.published,
      type: 'item'
    }));
    
    let links: any[] = [];

    // Add Connections from active scan if any
    if (activeItemConnections && selectedItem) {
      // Vashira Items (Internal)
      activeItemConnections.vashiraItems.forEach(targetId => {
        const id = parseInt(targetId);
        if (!items.find(i => i.id === id)) return; // Safety check
        links.push({ source: selectedItem.id, target: id, type: 'vashira-cite' });
      });

      // Zotero Keys (External)
      activeItemConnections.zoteroKeys.forEach(key => {
        const nodeID = `zotero:${key}`;
        if (!nodes.find(n => n.id === nodeID)) {
          nodes.push({ id: nodeID, name: `Zotero: ${key}`, val: 3, authors: '', published: '', type: 'zotero' } as any);
        }
        links.push({ source: selectedItem.id, target: nodeID, type: 'zotero-cite' });
      });

      // Gefyra Tools (Tools)
      activeItemConnections.gefyraTools.forEach(tool => {
        const nodeID = `gefyra:${tool}`;
        if (!nodes.find(n => n.id === nodeID)) {
          nodes.push({ id: nodeID, name: `Gefyra: ${tool}`, val: 3, authors: '', published: '', type: 'tool' } as any);
        }
        links.push({ source: selectedItem.id, target: nodeID, type: 'gefyra-link' });
      });
    }

    // Original connectivity: connect items with overlapping authors or common publishers
    filteredItems.forEach((item, i) => {
      const itemAuthors = item.authors.split(',').map(a => a.trim().toLowerCase());
      for (let j = i + 1; j < filteredItems.length; j++) {
        const nextItem = filteredItems[j];
        const nextAuthors = nextItem.authors.split(',').map(a => a.trim().toLowerCase());
        
        const hasCommonAuthor = itemAuthors.some(a => nextAuthors.includes(a));
        const samePublisher = item.publisher && nextItem.publisher && item.publisher === nextItem.publisher;
        const temporalProximity = Math.abs(parseInt(item.published) - parseInt(nextItem.published)) <= 1;

        if (hasCommonAuthor || samePublisher) {
          links.push({ source: item.id, target: nextItem.id });
        }
      }
    });
    
    // Fallback: chain the items if no connections found
    if (links.length === 0 && filteredItems.length > 1) {
       filteredItems.forEach((_, idx) => {
         if (idx > 0) links.push({ source: filteredItems[idx-1].id, target: filteredItems[idx].id });
       });
    }

    return { nodes, links };
  }, [items]);

  const BookCard = ({ item, onClick }: { item: ResearchItem, onClick: () => void }) => {
    const initials = item.title.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
    return (
      <div className="book-card" onClick={onClick}>
        <div className="book-cover-gradient">
          {initials}
        </div>
        <div className="book-card-title">{item.title}</div>
        <div className="book-card-meta">
          <span>{item.authors.split(',')[0]}</span>
          <span>{item.published}</span>
        </div>
        {item.masteryStatus === 'indexed' && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(16, 185, 129, 0.2)', padding: '4px', borderRadius: '50%' }}>
            <ShieldCheck size={12} color="#10b981" />
          </div>
        )}
      </div>
    );
  };

  const handleMenuAction = async (action: string) => {
    switch (action) {
      case 'Import PDF': (window as any).vashiraAPI.importPDF().then(loadItems); break;
      case 'Import BibTeX': (window as any).vashiraAPI.importBibTeX().then(loadItems); break;
      case 'Batch Metadata': setShowDoiModal(true); break;
      case 'Export Hub (BibTeX)': (window as any).vashiraAPI.exportBibTeX(items).then((success: boolean) => success && showToast('Mastery Hub Exported.')); break;
      case 'Magic Categorize': (window as any).vashiraAPI.magicCategorize().then(loadItems); break;
      case 'P2P Discovery': setActiveTab('shared'); break;
      case 'Oracle Settings': setActiveTab('oracle'); break;
      case 'Quit': window.close(); break;
      default: showToast(`Action "${action}" coming in Mastery 8.0.`);
    }
  };

  return (
    <div className="app-container glass-bg" style={{ display: 'flex', height: '100vh', flexDirection: 'column', position: 'relative' }}>
      <WindowControls />
      <div className="resize-handle top" />
      <div className="resize-handle bottom" />
      <div className="resize-handle left" />
      <div className="resize-handle right" />
      
      <TopMenuBar onAction={handleMenuAction} />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Nav */}
      {/* Sidebar (Pane 1) */}
      <aside className="sidebar glass-nav" style={{ width: `${sidebarWidth}px`, height: '100%', display: 'flex', flexDirection: 'column', padding: '16px 8px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px', padding: '0 8px', WebkitAppRegion: 'drag' } as any}>
          <div style={{ background: 'var(--accent-color)', color: 'var(--bg-color)', width: '28px', height: '28px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={18} fill="currentColor" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '0.05em' }}>VASHIRA</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          <div className={`sidebar-collection-item ${activeTab === 'library' && !activeCollectionId ? 'active' : ''}`} onClick={() => { setActiveTab('library'); setActiveCollectionId(null); }}>
            <Database size={16} /> <span>My Library</span>
          </div>
          
          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '16px 0 8px 12px', fontWeight: 700, letterSpacing: '0.05em' }}>COLLECTIONS</p>
          <div 
            className="sidebar-collection-item" 
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('drop-active'); }}
            onDragLeave={e => e.currentTarget.classList.remove('drop-active')}
            onDrop={e => {
               e.preventDefault();
               e.currentTarget.classList.remove('drop-active');
               const files = Array.from(e.dataTransfer.files);
               if (files.length > 0) showToast(`Importing ${files.length} items to Unfiled...`);
            }}
          >
            <Folder size={16} /> <span>Unfiled Items</span>
          </div>

          {collections.map(c => (
            <div 
              key={c.id} 
              className={`sidebar-collection-item ${activeCollectionId === c.id ? 'active' : ''}`} 
              onClick={() => { setActiveTab('library'); setActiveCollectionId(c.id); }}
              onDragOver={e => e.preventDefault()}
              onDrop={async (e) => {
                 e.preventDefault();
                 const files = Array.from(e.dataTransfer.files);
                 if (files.length > 0) {
                    showToast(`Adding to ${c.name}...`);
                    // We'll implement actual file move/add later
                 }
              }}
            >
               <ChevronRight size={14} style={{ opacity: 0.4 }} />
               <Folder size={16} /> <span>{c.name}</span>
            </div>
          ))}

          <div className="sidebar-collection-item" style={{ marginTop: '8px', opacity: 0.5 }}>
            <Plus size={14} /> <span>New Collection...</span>
          </div>

          <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: '24px 0 8px 12px', fontWeight: 700, letterSpacing: '0.05em' }}>SOVEREIGN SERVICES</p>
          <div className={`sidebar-collection-item ${activeTab === 'scribe' ? 'active' : ''}`} onClick={() => setActiveTab('scribe')}>
            <PenTool size={16} /> <span>The Scribe</span>
          </div>
          <div className={`sidebar-collection-item ${activeTab === 'oracle' ? 'active' : ''}`} onClick={() => setActiveTab('oracle')}>
            <Cpu size={16} /> <span>The Oracle</span>
          </div>
          <div className={`sidebar-collection-item ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
            <Globe size={16} /> <span>P2P Discovery</span>
          </div>
        </nav>

        <div className={`sidebar-collection-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
           <Settings size={16} /> <span>Configuration</span>
        </div>
      </aside>

      {/* Main Content (Pane 2) */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', position: 'relative' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 48px', overflow: 'hidden' }}>
          {activeTab === 'shared' && (
            <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <header>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>P2P Discovery</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Insights found by other sovereign nodes on your network.</p>
               </header>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                  <div className="glass" style={{ padding: '24px', borderRadius: '24px' }}>
                     <h3 style={{ fontSize: '0.9rem', marginBottom: '16px', opacity: 0.6 }}>NETWORK PEERS</h3>
                     {peers.map(p => (
                       <div key={p} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '8px', height: '8px', background: p.includes('Global') ? '#3b82f6' : '#10b981', borderRadius: '50%' }}></div>
                          <span style={{ flex: 1 }}>{p}</span>
                          {p.includes('Global') && <Globe size={14} style={{ opacity: 0.4 }} />}
                       </div>
                     ))}
                     {peers.length === 0 && <p style={{ opacity: 0.3, textAlign: 'center', fontSize: '0.8rem', padding: '20px' }}>No peers found. {communityMode ? 'Relay is active, waiting for nodes...' : 'Connecting to local mesh only.'}</p>}
                  </div>
                  <div className="glass" style={{ padding: '24px', borderRadius: '24px' }}>
                     <h3 style={{ fontSize: '0.9rem', marginBottom: '16px', opacity: 0.6 }}>MASTERY FLUX</h3>
                     {discoveries.map((d, i) => (
                       <div key={i} className="glass" style={{ padding: '16px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.1)' }}>
                          <h4 style={{ fontSize: '1rem', marginBottom: '8px' }}>{d.title}</h4>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>By {d.peer}</span>
                             <div style={{ display: 'flex', gap: '8px' }}>
                               <button className="primary-button small" onClick={() => (window as any).vashiraAPI.importFromPeer(d.doi, d.peer).then(loadItems)}>
                                  <Download size={14} /> <span>Snatched Metadata</span>
                               </button>
                               <button className="icon-button glass small" title="Download Source" onClick={() => window.open(`http://${d.peer}:51235/download/${d.itemId}`)}>
                                  <FileText size={14} />
                               </button>
                             </div>
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          )}
          {activeTab === 'library' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
               <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div>
                       <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Research Hub</h2>
                       <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{filteredItems.length} Items Mastered</p>
                    </div>
                     <div className="view-toggle glass" style={{ display: 'flex', padding: '4px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)' }}>
                        <button 
                          className={`icon-button small ${viewMode === 'grid' ? 'active' : ''}`} 
                          onClick={() => setViewMode('grid')}
                          style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '8px', background: viewMode === 'grid' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'grid' ? 'white' : 'var(--text-secondary)' }}
                        >
                          GRID
                        </button>
                        <button 
                          className={`icon-button small ${viewMode === 'list' ? 'active' : ''}`} 
                          onClick={() => setViewMode('list')}
                          style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '8px', background: viewMode === 'list' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'list' ? 'white' : 'var(--text-secondary)' }}
                        >
                          LIST
                        </button>
                        <button 
                          className={`icon-button small ${viewMode === 'graph' ? 'active' : ''}`} 
                          onClick={() => setViewMode('graph')}
                          style={{ padding: '6px 12px', fontSize: '0.7rem', fontWeight: 700, borderRadius: '8px', background: viewMode === 'graph' ? 'var(--accent-color)' : 'transparent', color: viewMode === 'graph' ? 'white' : 'var(--text-secondary)' }}
                        >
                          GRAPH
                        </button>
                     </div>
                 </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div className="glass-input-wrapper" style={{ width: '300px' }}>
                       <Search size={18} style={{ opacity: 0.4 }} />
                       <input 
                         placeholder="DOI, ISBN, or Multiple (comma sep)..." 
                         value={idInput} 
                         onChange={e => setIdInput(e.target.value)}
                         onKeyDown={e => e.key === 'Enter' && (window as any).vashiraAPI.importMetadata(idInput).then(loadItems)}
                       />
                       <BarcodeScanner onScan={(isbn) => setIdInput(isbn)} />
                    </div>
                    <div className="dropdown-container" style={{ position: 'relative' }}>
                      <button className="icon-button glass" title="Column Visibility" onClick={() => setShowColumnMenu(!showColumnMenu)}>
                         <Columns size={18} />
                      </button>
                      {showColumnMenu && (
                        <div className="glass" style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', padding: '12px', borderRadius: '12px', zIndex: 100, minWidth: '150px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                           <p style={{ fontSize: '0.7rem', opacity: 0.5, marginBottom: '8px' }}>VISIBLE COLUMNS</p>
                           {['title', 'authors', 'published'].map(col => (
                             <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer' }} onClick={() => toggleColumn(col)}>
                               <div style={{ width: '16px', height: '16px', border: '1px solid var(--accent-color)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 {visibleColumns.includes(col) && <Check size={12} color="var(--accent-color)" />}
                               </div>
                               <span style={{ fontSize: '0.9rem', textTransform: 'capitalize' }}>{col}</span>
                             </div>
                           ))}
                        </div>
                      )}
                    </div>

                     <button className="primary-button" onClick={() => (window as any).vashiraAPI.importPDF().then(loadItems)}>
                        <Plus size={18} /> <span>Import</span>
                     </button>
                  </div>
              </header>

               <div key={viewMode} className="view-enter" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {viewMode === 'grid' ? (
                  <div className="book-hub-grid" style={{ overflowY: 'auto', flex: 1 }}>
                    {filteredItems.map(item => (
                      <BookCard key={item.id} item={item} onClick={() => { setSelectedItem(item); setIsDetailsOpen(true); }} />
                    ))}
                    {filteredItems.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '100px', opacity: 0.3 }}>
                         <Database size={48} style={{ marginBottom: '16px' }} />
                         <p>No items mastered in this collection.</p>
                      </div>
                    )}
                  </div>
                ) : viewMode === 'list' ? (
                <div className="table-container glass" style={{ flex: 1, borderRadius: '24px', overflow: 'auto' }}>
                   <table className="mastery-table">
                      <thead>
                        <tr>
                          {visibleColumns.includes('title') && <th>Title</th>}
                          {visibleColumns.includes('authors') && <th>Authors</th>}
                          {visibleColumns.includes('published') && <th>Year</th>}
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredItems.map(item => (
                          <tr 
                            key={item.id} 
                            className={selectedItem?.id === item.id ? 'selected' : ''}
                            onClick={() => { setSelectedItem(item); setIsDetailsOpen(true); }}
                          >
                            {visibleColumns.includes('title') && (
                              <td>
                                {item.title}
                                {item.doi && items.some(i => i.id !== item.id && i.doi === item.doi) && (
                                  <span style={{ marginLeft: '12px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.65rem', fontWeight: 800 }}>DUPE</span>
                                )}
                              </td>
                            )}
                            {visibleColumns.includes('authors') && <td style={{ fontSize: '0.85rem', opacity: 0.8 }}>{item.authors}</td>}
                            {visibleColumns.includes('published') && <td>{item.published}</td>}
                            <td style={{ textAlign: 'right' }}>
                               <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                 {item.filePath && (
                                   <button className="icon-button small" title="Open Local PDF" onClick={(e) => { e.stopPropagation(); (window as any).vashiraAPI.openFile(item.filePath); }}>
                                     <FileText size={14} />
                                   </button>
                                 )}
                                 {item.snapshotPath && (
                                   <button className="icon-button small" title="View Sovereign Archive" onClick={(e) => { e.stopPropagation(); setSnapshotPath(item.snapshotPath!); setShowSnapshotReader(true); }}>
                                     <ShieldCheck size={14} />
                                   </button>
                                 )}
                               </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
              ) : (
                <div className="graph-container glass" style={{ flex: 1, borderRadius: '24px', overflow: 'hidden', background: 'rgba(0,0,0,0.4)', position: 'relative' }}>
                   <ForceGraph2D
                     graphData={graphData}
                     nodeLabel="name"
                     nodeColor={() => '#a78bfa'}
                     linkColor={() => 'rgba(255,255,255,0.1)'}
                     backgroundColor="rgba(0,0,0,0)"
                     width={800}
                     height={600}
                     onNodeClick={(node: any) => {
                        const item = items.find(i => i.id === node.id);
                        if (item) { setSelectedItem(item); setIsDetailsOpen(true); }
                     }}
                   />
                 </div>
               )}
             </div>
           </div>
          )}

          {activeTab === 'scribe' && (
            <Scribe hubItems={items} onShowToast={(m: string) => showToast(m)} />
          )}

          {activeTab === 'librarian' && (
            <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <header>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>The Librarian</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Master your PDFs with in-app annotations and sovereign metadata extraction.</p>
               </header>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px', flex: 1, overflowY: 'auto', paddingRight: '12px' }}>
                  {items.filter(i => i.filePath).map(item => (
                    <div key={item.id} className="glass" style={{ padding: '24px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                       <div style={{ position: 'absolute', top: '24px', right: '24px' }}>
                          <FileText size={20} opacity={0.3} />
                       </div>
                       <h4 style={{ fontSize: '1.1rem', fontWeight: 600, paddingRight: '40px' }}>{item.title}</h4>
                       <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{item.authors || 'Unknown Source'}</p>
                       <div style={{ marginTop: 'auto', display: 'flex', gap: '12px' }}>
                          <button className="primary-button small" style={{ flex: 1 }} onClick={() => { setSelectedItem(item); setPdfPath(item.filePath!); setShowPdfReader(true); }}>
                             <PenTool size={14} /> <span>ANNOTATE</span>
                          </button>
                          <button className="icon-button glass small" title="Extract Deep Metadata" onClick={() => (window as any).vashiraAPI.gatherMetadata(item.filePath).then(loadItems)}>
                             <Zap size={14} />
                          </button>
                       </div>
                    </div>
                  ))}
                  {items.filter(i => i.filePath).length === 0 && (
                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '100px', opacity: 0.3 }}>
                       <Database size={48} style={{ marginBottom: '16px' }} />
                       <p>Import PDFs to activate the Librarian's tools.</p>
                    </div>
                  )}
               </div>
            </div>
          )}

          {activeTab === 'oracle' && (
            <div className="fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <header>
                  <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>The Oracle</h2>
                  <p style={{ color: 'var(--text-secondary)' }}>Interrogate your collective knowledge using RAG-powered intelligence.</p>
              </header>
              <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px', borderRadius: '32px' }}>
                  <div style={{ flex: 1, overflowY: 'auto', marginBottom: '24px', fontSize: '1.1rem', lineHeight: 1.6 }}>
                    {isOracleLoading ? <div className="loader">Seeking insights from the vault...</div> : (
                      oracleResponse || <div style={{ opacity: 0.3, textAlign: 'center', marginTop: '100px' }}>Ask anything about your mastered works.</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <input 
                      className="glass" 
                      style={{ flex: 1, padding: '16px 24px', borderRadius: '16px', border: 'none', background: 'rgba(0,0,0,0.3)', color: 'white' }}
                      placeholder="e.g. Compare the methodology in my recent astrophysics papers..."
                      value={oracleQuery}
                      onChange={e => setOracleQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleOracleAsk()}
                    />
                    <button className="primary-button" onClick={handleOracleAsk} disabled={isOracleLoading}>
                        <Zap size={20} />
                    </button>
                  </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="fade-in glass" style={{ padding: '48px', borderRadius: '32px', maxWidth: '900px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', margin: '40px auto', animation: 'scaleUp 0.4s ease' }}>
               <section>
                  <h2 style={{ marginBottom: '32px', fontSize: '1.4rem', fontWeight: 800 }}>Oracle Configuration</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>API Base URL</label>
                        <input className="glass-input" value={oracleConfig.baseUrl} onChange={e => setOracleConfig({...oracleConfig, baseUrl: e.target.value})} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Secret Access Key</label>
                        <input className="glass-input" type="password" value={oracleConfig.apiKey} onChange={e => setOracleConfig({...oracleConfig, apiKey: e.target.value})} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preferred Model</label>
                        <input className="glass-input" value={oracleConfig.model} onChange={e => setOracleConfig({...oracleConfig, model: e.target.value})} />
                     </div>
                     <button className="primary-button" onClick={saveOracleConfig} style={{ marginTop: '12px' }}>PERSIST CONNECTION</button>
                  </div>

                  <div style={{ marginTop: '48px' }}>
                    <h2 style={{ marginBottom: '24px', fontSize: '1.4rem', fontWeight: 800 }}>Community Mode (WAN)</h2>
                    <div className="glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(59, 130, 246, 0.2)', background: 'rgba(59, 130, 246, 0.05)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                             <div style={{ width: '40px', height: '40px', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Globe size={20} color="#3b82f6" />
                             </div>
                             <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Global Mesh</h3>
                                <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Sync with users across the internet.</p>
                             </div>
                          </div>
                          <button 
                             className={`primary-button small ${communityMode ? 'active' : ''}`} 
                             style={{ background: communityMode ? '#3b82f6' : 'rgba(255,255,255,0.1)', minWidth: '100px' }}
                             onClick={async () => {
                                const newState = !communityMode;
                                const result = await (window as any).vashiraAPI.toggleCommunityMode(newState);
                                setCommunityMode(newState);
                                setNatStatus(result.nat);
                                localStorage.setItem('vashira_community_mode', newState.toString());
                                showToast(newState ? "Global Mesh Joined." : "Returned to Sovereign LAN.");
                             }}
                          >
                             {communityMode ? 'CONNECTED' : 'DISABLED'}
                          </button>
                       </div>
                    </div>
                  </div>
               </section>

               <section>
                  <h2 style={{ marginBottom: '32px', fontSize: '1.4rem', fontWeight: 800 }}>Zotero Hub Sync</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                     <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zotero User ID</label>
                        <input className="glass-input" value={zoteroConfig.userId} onChange={e => setZoteroConfig({...zoteroConfig, userId: e.target.value})} />
                     </div>
                     <div>
                        <label style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zotero API Key</label>
                        <input className="glass-input" type="password" value={zoteroConfig.apiKey} onChange={e => setZoteroConfig({...zoteroConfig, apiKey: e.target.value})} />
                     </div>
                     <button className={`primary-button ${isSyncing ? 'loading' : ''}`} onClick={syncWithZotero} style={{ marginTop: '12px' }}>
                        {isSyncing ? 'SYNCING VAULT...' : 'SYNC WITH ZOTERO'}
                     </button>
                     <p style={{ fontSize: '0.75rem', opacity: 0.4, fontStyle: 'italic' }}>Smart Diffing ensures only metadata changes are synced.</p>
                  </div>

                  <div style={{ marginTop: '48px' }}>
                    <h2 style={{ marginBottom: '24px', fontSize: '1.4rem', fontWeight: 800 }}>AI Provider (v6)</h2>
                    <div className="glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(16, 185, 129, 0.2)', background: 'rgba(16, 185, 129, 0.05)' }}>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <ShieldCheck size={20} color="#10b981" />
                          </div>
                          <div>
                             <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Sovereign MCP Active</h3>
                             <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>Listening on Port 51236</p>
                          </div>
                       </div>
                    </div>
                  </div>
               </section>
            </div>
          )}
        </div>

        {/* Details Panel (Pane 3) */}
        {isDetailsOpen && selectedItem && (
          <aside className="details-panel glass-nav" style={{ width: '400px', height: '100%', borderLeft: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.3s ease' }}>
            <header style={{ padding: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <h3 style={{ fontSize: '1rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Item Details</h3>
               <button className="icon-button small" onClick={() => setIsDetailsOpen(false)}><Plus style={{ transform: 'rotate(45deg)' }} /></button>
            </header>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <section>
                  <label style={{ fontSize: '0.7rem', color: 'var(--accent-color)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Title</label>
                  <textarea 
                    className="glass-input" 
                    style={{ background: 'transparent', border: 'none', padding: 0, width: '100%', fontSize: '1.1rem', fontWeight: 600, minHeight: '60px', resize: 'none' }} 
                    value={selectedItem.title} 
                    onChange={e => setSelectedItem({...selectedItem, title: e.target.value})}
                  />
                  {dupes.length > 1 && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                       <ShieldCheck size={14} color="#ef4444" />
                       <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Potential Duplicate Detected</span>
                    </div>
                  )}
                  <ConsensusAdvisory identifier={selectedItem.doi || selectedItem.fileHash} onApply={(m) => setSelectedItem({...selectedItem, ...m})} />
               </section>
               <section>
                  <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Authors</label>
                  <input className="glass-input" style={{ background: 'transparent', border: 'none', padding: 0, width: '100%' }} value={selectedItem.authors} onChange={e => setSelectedItem({...selectedItem, authors: e.target.value})} />
               </section>
               <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '4px', display: 'block' }}>Type</label>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{selectedItem.itemType}</div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '4px', display: 'block' }}>Date</label>
                    <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>{selectedItem.published}</div>
                  </div>
               </section>
               {selectedItem.doi && (
                 <section>
                    <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>DOI</label>
                    <div style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--accent-color)' }}>{selectedItem.doi}</div>
                 </section>
               )}
               <section>
                  <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Semantic Labels</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                     {['Must Read', 'Core Source', 'Verification Needed', 'Peer Agreed'].map(tag => (
                       <div key={tag} className="glass" style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', background: tag === 'Must Read' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(167, 139, 250, 0.1)', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.05)' }}>
                          {tag}
                       </div>
                     ))}
                     <div className="glass" style={{ padding: '4px 8px', borderRadius: '50%', fontSize: '0.8rem', opacity: 0.5, cursor: 'pointer' }}>+</div>
                  </div>
               </section>
               <section>
                  <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Abstract</label>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6, opacity: 0.8 }}>{selectedItem.abstract}</p>
               </section>
            </div>
            <footer style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px', flexDirection: 'column' }}>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="primary-button small" style={{ flex: 1 }} onClick={() => (window as any).vashiraAPI.updateItem(selectedItem.id, selectedItem)}>SAVE CHANGES</button>
                  {selectedItem.filePath?.toLowerCase().endsWith('.docx') && (
                    <button 
                      className="secondary-button small" 
                      style={{ flex: 1, borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
                      onClick={async () => {
                        const result = await (window as any).vashiraAPI.graphifyItem(selectedItem.id);
                        if (result.success) {
                          setActiveItemConnections(result.connections);
                          setViewMode('graph');
                          showToast('Document Network Scanned.', 'success');
                        } else {
                          showToast(result.error, 'alert');
                        }
                      }}
                    >
                      GRAPHIFY
                    </button>
                  )}
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="icon-button glass small" style={{ flex: 1 }} title="Copy for Word" onClick={() => (window as any).vashiraAPI.generateCitation(selectedItem.id, 'apa').then((c: string) => { navigator.clipboard.writeText(c); showToast('Citation copied for Word.'); })}>
                    <PenTool size={14} /> <span style={{ fontSize: '0.7rem' }}>CITE (WORD)</span>
                  </button>
                  <button className="icon-button glass small" style={{ flex: 1 }} title="Merge Duplicates" onClick={() => showToast('Merging logic coming in Mastery 9.0.')}>
                    <Plus size={14} /> <span style={{ fontSize: '0.7rem' }}>MERGE</span>
                  </button>
               </div>
            </footer>
          </aside>
        )}
      </main>

      {/* Reader Overlay */}
      {showPdfReader && (
        <div className="reader-overlay fade-in" style={{ display: 'flex', flexDirection: 'row' }}>
           <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
             <header className="glass-nav" style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <FileText color="var(--accent-color)" />
                  <span style={{ fontWeight: 600, maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedItem?.title}</span>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                   <button className={`icon-button glass \${activeAnnotationType === 'highlight' ? 'active' : ''}`} onClick={() => setActiveAnnotationType('highlight')} title="Highlight Mode"><Zap size={18} /></button>
                   <button className={`icon-button glass \${activeAnnotationType === 'sticky' ? 'active' : ''}`} onClick={() => setActiveAnnotationType('sticky')} title="Sticky Note"><PenTool size={18} /></button>
                   <button className="icon-button" onClick={() => setShowPdfReader(false)}><ChevronRight /></button>
                </div>
             </header>
             <iframe src={`file://\${pdfPath}`} style={{ width: '100%', height: 'calc(100% - 60px)', border: 'none' }} title="Mastery Reader" />
           </div>
           
           <aside className="pdf-sidebar glass-nav" style={{ width: '350px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <h3 style={{ fontSize: '0.9rem', opacity: 0.6, letterSpacing: '0.1em' }}>DEEP INSIGHTS</h3>
              <div className="notes-list" style={{ flex: 1, overflowY: 'auto' }}>
                 {annotations.map(ann => (
                   <div key={ann.id} className="glass" style={{ padding: '16px', borderRadius: '12px', borderLeft: `4px solid \${ann.color}`, marginBottom: '12px' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '8px' }}>{ann.content}</p>
                      <span style={{ fontSize: '0.65rem', opacity: 0.4 }}>{new Date(ann.timestamp).toLocaleString()}</span>
                   </div>
                 ))}
                 {annotations.length === 0 && <p style={{ opacity: 0.3, textAlign: 'center', marginTop: '40px' }}>No insights pinned yet.</p>}
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                 <textarea 
                   placeholder="Type an insight to pin it..." 
                   onKeyDown={e => {
                     if (e.key === 'Enter' && !e.shiftKey) {
                       e.preventDefault();
                       saveAnnotation((e.target as HTMLTextAreaElement).value, "page-current");
                       (e.target as HTMLTextAreaElement).value = '';
                     }
                   }}
                 />
                 <p style={{ fontSize: '0.65rem', opacity: 0.4 }}>Press Enter to Pin to Sovereign Record.</p>
              </div>
           </aside>
        </div>
      )}

      {/* Snapshot Overlay (7.0) */}
      {showSnapshotReader && (
        <div className="reader-overlay fade-in" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.95)' }}>
           <header className="glass-nav" style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <ShieldCheck color="#10b981" />
                <span style={{ fontWeight: 600 }}>Sovereign Archive: {selectedItem?.title}</span>
              </div>
              <button className="icon-button" onClick={() => setShowSnapshotReader(false)}><ChevronRight /></button>
           </header>
           <iframe src={`file://\${snapshotPath}`} style={{ width: '100%', height: 'calc(100% - 60px)', border: 'none' }} title="Archive Viewer" />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast glass \${toast.type}`} style={{ position: 'fixed', bottom: '32px', right: '32px', padding: '12px 24px', borderRadius: '12px', borderLeft: '4px solid ' + (toast.type === 'success' ? '#10b981' : '#ef4444') }}>
          <span>{toast.message}</span>
        </div>
      )}
      </div>
    </div>
  );
}
