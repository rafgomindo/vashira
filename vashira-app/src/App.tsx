import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Search, Database, Settings, BookOpen, Activity, 
  ChevronRight, FileText, Download, Zap, Share2, 
  Tag, Clock, Folder, Globe, Clipboard, Check, Filter,
  Columns, Smartphone, ShieldCheck, PenTool, MessageSquare,
  Cpu, Terminal, Power, Camera
} from 'lucide-react';
import Scribe from './components/Scribe';
import { askTheOracle, OracleConfig } from './oracle';

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
  const [activeTab, setActiveTab] = useState('library');
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
  const [oracleConfig, setOracleConfig] = useState<OracleConfig>({
    apiKey: localStorage.getItem('vashira_oracle_key') || '',
    baseUrl: localStorage.getItem('vashira_oracle_url') || 'https://api.openai.com/v1',
    model: localStorage.getItem('vashira_oracle_model') || 'gpt-4o'
  });

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
    showToast("Oracle Connection Persistent.");
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    return items.filter(i => i.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [items, searchTerm]);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(['title', 'authors', 'published']);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }

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
    <div className="app-container glass-bg" style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      <TopMenuBar onAction={handleMenuAction} />
      
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar Nav */}
      {/* Sidebar (Pane 1) */}
      <aside className="sidebar glass-nav" style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 16px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px', padding: '0 8px' }}>
          <div style={{ background: 'var(--accent-color)', color: 'var(--bg-color)', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} fill="currentColor" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800 }}>VASHIRA</h1>
            <p style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Sovereign 5.0</p>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <div className={`nav-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
            <Database /> <span>Mastery Hub</span>
          </div>
          
          <div className={`nav-item ${activeTab === 'scribe' ? 'active' : ''}`} onClick={() => setActiveTab('scribe')}>
            <PenTool /> <span>The Scribe</span>
          </div>

          <div className={`nav-item ${activeTab === 'oracle' ? 'active' : ''}`} onClick={() => setActiveTab('oracle')}>
            <Cpu /> <span>The Oracle</span>
          </div>

          <div className={`nav-item ${activeTab === 'librarian' ? 'active' : ''}`} onClick={() => setActiveTab('librarian')}>
            <BookOpen /> <span>The Librarian</span>
          </div>

          <div className={`nav-item ${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
            <Globe /> <span>P2P Discovery</span>
          </div>

          <div style={{ height: '32px' }}></div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px', paddingLeft: '12px' }}>COLLECTIONS</p>
          {collections.map(c => (
            <div key={c.id} className="nav-item" onClick={() => { setActiveTab('library'); setActiveCollectionId(c.id); }}>
               <Folder size={18} /> <span>{c.name}</span>
            </div>
          ))}
        </nav>

        <div className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
           <Settings /> <span>Configuration</span>
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
                     <h3 style={{ fontSize: '0.9rem', marginBottom: '16px', opacity: 0.6 }}>LOCAL PEERS</h3>
                     {peers.map(p => (
                       <div key={p} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
                          <span>{p}</span>
                       </div>
                     ))}
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
                               <button className="icon-button glass small" title="Download Source" onClick={() => window.open(`http://\${d.peer}:51235/download/\${d.itemId}`)}>
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
                 <div>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Research Hub</h2>
                    <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>{filteredItems.length} Items Mastered</p>
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
                          {visibleColumns.includes('title') && <td>{item.title}</td>}
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
            </div>
          )}

          {activeTab === 'scribe' && (
            <Scribe hubItems={items} onShowToast={(m) => showToast(m)} />
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
            <div className="fade-in glass" style={{ padding: '48px', borderRadius: '32px', maxWidth: '600px' }}>
               <h2 style={{ marginBottom: '32px' }}>Oracle Configuration</h2>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div>
                     <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>API Base URL (OpenAI, Anthropic, or Local Ollama)</label>
                     <input className="glass-input" value={oracleConfig.baseUrl} onChange={e => setOracleConfig({...oracleConfig, baseUrl: e.target.value})} />
                  </div>
                  <div>
                     <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Secret Access Key</label>
                     <input className="glass-input" type="password" value={oracleConfig.apiKey} onChange={e => setOracleConfig({...oracleConfig, apiKey: e.target.value})} />
                  </div>
                  <div>
                     <label style={{ fontSize: '0.8rem', opacity: 0.6 }}>Preferred Model</label>
                     <input className="glass-input" value={oracleConfig.model} onChange={e => setOracleConfig({...oracleConfig, model: e.target.value})} />
                  </div>
                  <button className="primary-button" onClick={saveOracleConfig}>PERSIST CONNECTION</button>
               </div>
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
                  <label style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '8px', display: 'block' }}>Abstract</label>
                  <p style={{ fontSize: '0.85rem', lineHeight: 1.6, opacity: 0.8 }}>{selectedItem.abstract}</p>
               </section>
            </div>
            <footer style={{ padding: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '12px' }}>
               <button className="primary-button small" style={{ flex: 1 }} onClick={() => (window as any).vashiraAPI.updateItem(selectedItem.id, selectedItem)}>SAVE CHANGES</button>
            </footer>
          </aside>
        )}
      </main>

      {/* Reader Overlay */}
      {showPdfReader && (
        <div className="reader-overlay fade-in">
           <header className="glass-nav" style={{ height: '60px', display: 'flex', alignItems: 'center', padding: '0 24px', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <FileText color="var(--accent-color)" />
                <span style={{ fontWeight: 600 }}>{selectedItem?.title}</span>
              </div>
              <button className="icon-button" onClick={() => setShowPdfReader(false)}><ChevronRight /></button>
           </header>
           <iframe src={`file://\${pdfPath}`} style={{ width: '100%', height: 'calc(100% - 60px)', border: 'none' }} title="Mastery Reader" />
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
