import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Database, Settings, BookOpen, Activity, 
  ChevronRight, FileText, Download, Zap, Share2, 
  Tag, Clock, Folder, Globe, Clipboard, Check, Filter,
  Columns, Smartphone, ShieldCheck, PenTool, MessageSquare,
  Cpu, Terminal, Power
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
  abstract: string;
  url?: string;
  filePath?: string;
  snapshotPath?: string;
  content?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<ResearchItem | null>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [showDoiModal, setShowDoiModal] = useState(false);
  const [doiInput, setDoiInput] = useState('');
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

  return (
    <div className="app-container" style={{ display: 'flex', width: '100vw', height: '100vh', background: 'var(--bg-color)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside className="sidebar glass-nav" style={{ width: '280px', height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 16px' }}>
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
          <div className={`nav-item \${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
            <Database /> <span>Mastery Hub</span>
          </div>
          
          <div className={`nav-item \${activeTab === 'scribe' ? 'active' : ''}`} onClick={() => setActiveTab('scribe')}>
            <PenTool /> <span>The Scribe</span>
          </div>

          <div className={`nav-item \${activeTab === 'oracle' ? 'active' : ''}`} onClick={() => setActiveTab('oracle')}>
            <Cpu /> <span>The Oracle</span>
          </div>

          <div className={`nav-item \${activeTab === 'librarian' ? 'active' : ''}`} onClick={() => setActiveTab('librarian')}>
            <BookOpen /> <span>The Librarian</span>
          </div>

          <div className={`nav-item \${activeTab === 'shared' ? 'active' : ''}`} onClick={() => setActiveTab('shared')}>
            <Globe /> <span>P2P Discovery</span>
          </div>

          <div style={{ height: '32px' }}></div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '12px', paddingLeft: '12px' }}>COLLECTIONS</p>
          {collections.map(c => (
            <div key={c.id} className="nav-item" onClick={() => setActiveTab('library')}>
               <Folder size={18} /> <span>{c.name}</span>
            </div>
          ))}
        </nav>

        <div className={`nav-item \${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
           <Settings /> <span>Configuration</span>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 48px', overflow: 'hidden' }}>
        {activeTab === 'library' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
               <h2 style={{ fontSize: '1.8rem', fontWeight: 700 }}>Research Hub</h2>
               <div className="search-container glass">
                  <Search size={18} />
                  <input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
               </div>
            </header>
            <div className="table-container glass" style={{ flex: 1, borderRadius: '24px', overflow: 'hidden' }}>
               <table className="mastery-table">
                  <thead><tr><th>Title</th><th>Authors</th><th>Year</th></tr></thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} onClick={() => setSelectedItem(item)}>
                        <td>{item.title}</td><td>{item.authors}</td><td>{item.published}</td>
                        <td style={{ textAlign: 'right' }}>
                           {item.snapshotPath && (
                             <button className="icon-button" title="View Sovereign Archive" onClick={(e) => { e.stopPropagation(); setSnapshotPath(item.snapshotPath!); setShowSnapshotReader(true); }}>
                               <ShieldCheck size={16} />
                             </button>
                           )}
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
  );
}
