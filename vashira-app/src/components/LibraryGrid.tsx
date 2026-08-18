import React, { useState } from 'react';
import { Search, Plus, RefreshCw, Grid, List as ListIcon, Network, X, Download, Upload, MoreHorizontal } from 'lucide-react';
import ForceGraph2D from 'react-force-graph-2d';

interface LibraryGridProps {
  items: any[];
  viewMode: 'grid' | 'list' | 'graph';
  setViewMode: (mode: 'grid' | 'list' | 'graph') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onSelectItem: (item: any) => void;
  selectedItemId: number | null;
  activeItemConnections: any[];
  onSync: () => void;
  isSyncing: boolean;
  onImport: () => void;
  filterLabel?: string | null;
  onClearFilter?: () => void;
  onExportBibTeX?: () => void;
  onImportBibTeX?: () => void;
  onImportRIS?: () => void;
}

const LibraryGrid: React.FC<LibraryGridProps> = ({
  items,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  onSelectItem,
  selectedItemId,
  activeItemConnections,
  onSync,
  isSyncing,
  onImport,
  filterLabel,
  onClearFilter,
  onExportBibTeX,
  onImportBibTeX,
  onImportRIS
}) => {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const filteredItems = items.filter(i => 
    i.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.authors?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="main-view fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '32px' }}>
        <div>
          <h2 className="view-title">{filterLabel || 'Research Hub'}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {items.length} Sovereign Artifact{items.length === 1 ? '' : 's'} Mastered.
            {filterLabel && onClearFilter && (
              <button className="badge" style={{ cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={onClearFilter}>
                <X size={10} /> Clear filter
              </button>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div data-tour="search" style={{ position: 'relative', width: '320px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
            <input
              className="glass-input"
              style={{ paddingLeft: '48px' }}
              placeholder="Search collective knowledge..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div data-tour="library-toolbar-extra" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button className={`btn-secondary ${isSyncing ? 'loading' : ''}`} onClick={onSync}>
            <RefreshCw size={18} style={{ animation: isSyncing ? 'spin 2s linear infinite' : 'none' }} />
          </button>

          {(onExportBibTeX || onImportBibTeX || onImportRIS) && (
            <div style={{ position: 'relative' }}>
              <button className="btn-secondary" onClick={() => setShowImportMenu(v => !v)}>
                <MoreHorizontal size={18} />
              </button>
              {showImportMenu && (
                <div className="glass-card" style={{ position: 'absolute', top: '48px', right: 0, zIndex: 50, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
                  {onImportBibTeX && (
                    <button className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }} onClick={() => { onImportBibTeX(); setShowImportMenu(false); }}>
                      <Upload size={14} /> Import BibTeX
                    </button>
                  )}
                  {onImportRIS && (
                    <button className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }} onClick={() => { onImportRIS(); setShowImportMenu(false); }}>
                      <Upload size={14} /> Import RIS
                    </button>
                  )}
                  {onExportBibTeX && (
                    <button className="btn-secondary" style={{ justifyContent: 'flex-start', border: 'none' }} onClick={() => { onExportBibTeX(); setShowImportMenu(false); }}>
                      <Download size={14} /> Export Library (BibTeX)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          <button data-tour="import-btn" className="btn-primary" onClick={onImport}>
            <Plus size={18} />
            <span>IMPORT MASTERY</span>
          </button>
        </div>
      </header>

      {/* View Switcher */}
      <div data-tour="view-toggle" style={{ display: 'flex', gap: '8px', marginTop: '-20px' }}>
         <button className={`icon-button ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Grid size={16} /></button>
         <button className={`icon-button ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><ListIcon size={16} /></button>
         <button className={`icon-button ${viewMode === 'graph' ? 'active' : ''}`} onClick={() => setViewMode('graph')}><Network size={16} /></button>
      </div>

      <style>{`
        .icon-button {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border-glass);
          padding: 10px;
          border-radius: 12px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .icon-button:hover, .icon-button.active {
          background: rgba(167, 139, 250, 0.1);
          color: var(--accent-primary);
          border-color: var(--border-focus);
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {viewMode === 'grid' && (
        <div className="book-grid">
          {filteredItems.map((item, i) => (
            <div
              key={item.id}
              data-tour={i === 0 ? 'book-card' : undefined}
              className={`book-card ${selectedItemId === item.id ? 'active' : ''}`}
              onClick={() => onSelectItem(item)}
            >
              <div className="book-card-inner">
                <div className="book-cover-placeholder">
                  {item.title.charAt(0)}
                </div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.4, height: '40px', overflow: 'hidden' }}>{item.title}</h3>
                <p style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 500 }}>{item.authors || 'Unknown Savant'}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <span className="badge badge-success">{item.itemType}</span>
                  {item.doi && <span className="badge" style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'var(--accent-primary)' }}>DOI</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'list' && (
        <div className="table-wrapper scale-up">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Type</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className={selectedItemId === item.id ? 'active' : ''} onClick={() => onSelectItem(item)}>
                  <td style={{ fontWeight: 600 }}>{item.title}</td>
                  <td style={{ opacity: 0.6 }}>{item.authors}</td>
                  <td><span className="badge badge-success">{item.itemType}</span></td>
                  <td>{item.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'graph' && (
        <div className="glass scale-up" style={{ flex: 1, borderRadius: '24px', overflow: 'hidden', minHeight: '500px' }}>
          <ForceGraph2D
            graphData={activeItemConnections.length > 0 ? { nodes: [{id: 'root'}, ...activeItemConnections.map((c: any) => ({id: c.target}))], links: activeItemConnections.map((c: any) => ({source: 'root', target: c.target})) } : { nodes: [], links: [] }}
            nodeLabel="id"
            nodeAutoColorBy="id"
            width={800}
            height={600}
          />
        </div>
      )}
    </div>
  );
};

export default LibraryGrid;
