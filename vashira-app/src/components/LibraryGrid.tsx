import React, { useEffect, useState } from 'react';
import { Search, Plus, RefreshCw, Grid, List as ListIcon, Network, X, Download, Upload, MoreHorizontal, RotateCcw, Trash2, FileSearch } from 'lucide-react';

type TextHit = { page: number; snippet: string };

// FTS snippets mark matches with «…»; render those as <mark>.
const Snippet: React.FC<{ hit: TextHit }> = ({ hit }) => (
  <p className="text-hit">
    <FileSearch size={11} style={{ display: 'inline', verticalAlign: '-1px', marginRight: '4px' }} />
    <span>
      <strong>p. {hit.page}</strong>{' '}
      {hit.snippet.replace(/\s+/g, ' ').split(/([«»])/).reduce<{ out: React.ReactNode[]; on: boolean }>((acc, part, i) => {
        if (part === '«') acc.on = true;
        else if (part === '»') acc.on = false;
        else if (part) acc.out.push(acc.on ? <mark key={i}>{part}</mark> : <React.Fragment key={i}>{part}</React.Fragment>);
        return acc;
      }, { out: [], on: false }).out}
    </span>
  </p>
);
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
  isTrash?: boolean;
  onRestoreItem?: (itemId: number) => void;
  onDeleteForever?: (itemId: number) => void;
  onEmptyTrash?: () => void;
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
  onImportRIS,
  isTrash = false,
  onRestoreItem,
  onDeleteForever,
  onEmptyTrash
}) => {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  // Full-text matches inside the PDFs (FTS index), keyed by item id.
  const [textHits, setTextHits] = useState<Map<number, TextHit>>(new Map());

  useEffect(() => {
    const q = searchQuery.trim();
    if (isTrash || q.length < 3) { setTextHits(new Map()); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const results = await (window as any).vashiraAPI.searchFullText(q);
        if (!cancelled) setTextHits(new Map((results || []).map((r: any) => [r.itemId, r.hits[0]])));
      } catch {
        if (!cancelled) setTextHits(new Map());
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, isTrash]);

  const q = searchQuery.toLowerCase();
  const metaMatch = (i: any) => i.title.toLowerCase().includes(q) || i.authors?.toLowerCase().includes(q);
  const filteredItems = items.filter(i => metaMatch(i) || textHits.has(i.id));
  // Only show the page snippet when the match came from inside the document.
  const hitFor = (i: any) => (q && !metaMatch(i) ? textHits.get(i.id) : undefined);

  const trashActions = (item: any) => isTrash && (
    <div style={{ display: 'flex', gap: '8px' }} onClick={e => e.stopPropagation()}>
      <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.7rem' }} onClick={() => onRestoreItem?.(item.id)}>
        <RotateCcw size={12} /> Restore
      </button>
      <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.7rem', color: '#ef4444' }} onClick={() => onDeleteForever?.(item.id)}>
        <Trash2 size={12} /> Delete forever
      </button>
    </div>
  );

  return (
    <div className="main-view fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '32px' }}>
        <div>
          <h2 className="view-title">{filterLabel || 'Research Hub'}</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {isTrash
              ? `${items.length} item${items.length === 1 ? '' : 's'} in Trash.`
              : `${items.length} Sovereign Artifact${items.length === 1 ? '' : 's'} Mastered.`}
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
              placeholder={isTrash ? 'Search the Trash...' : 'Search titles, authors & full text...'}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {isTrash && items.length > 0 && (
            confirmEmpty ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Delete {items.length} item{items.length === 1 ? '' : 's'} and their files forever?</span>
                <button className="btn-secondary" style={{ color: '#ef4444' }} onClick={() => { setConfirmEmpty(false); onEmptyTrash?.(); }}>Yes, empty</button>
                <button className="btn-secondary" onClick={() => setConfirmEmpty(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-secondary" style={{ color: '#ef4444' }} onClick={() => setConfirmEmpty(true)}>
                <Trash2 size={16} /> Empty Trash
              </button>
            )
          )}

          {!isTrash && (
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
          )}

          {!isTrash && (
          <button data-tour="import-btn" className="btn-primary" onClick={() => onImport()}>
            <Plus size={18} />
            <span>IMPORT MASTERY</span>
          </button>
          )}
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
        .text-hit {
          font-size: 0.72rem; line-height: 1.45; opacity: 0.75;
          margin: 6px 0 8px; font-weight: 400;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
        }
        .text-hit mark { background: rgba(167, 139, 250, 0.25); color: var(--text-primary); border-radius: 3px; padding: 0 2px; }
        .text-hit strong { color: var(--accent-primary); font-weight: 700; }
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
                {hitFor(item) && <Snippet hit={hitFor(item)!} />}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <span className="badge badge-success">{item.itemType}</span>
                  {item.doi && <span className="badge" style={{ background: 'rgba(167, 139, 250, 0.1)', color: 'var(--accent-primary)' }}>DOI</span>}
                </div>
                {trashActions(item)}
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
                  <td style={{ fontWeight: 600 }}>
                    {item.title}
                    {hitFor(item) && <Snippet hit={hitFor(item)!} />}
                    {trashActions(item)}
                  </td>
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
