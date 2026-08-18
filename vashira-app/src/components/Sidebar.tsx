import React, { useState } from 'react';
import { Library, Zap, Settings, Share2, Globe, HelpCircle, FolderClosed, Tag as TagIcon, Plus } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  communityMode: boolean;
  natStatus: string | null;
  collections: any[];
  tags: any[];
  libraryFilter: { type: 'all' | 'collection' | 'tag'; id?: number; label?: string };
  onSelectFilter: (f: { type: 'all' | 'collection' | 'tag'; id?: number; label?: string }) => void;
  onCreateCollection: (name: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, communityMode, natStatus, collections, tags, libraryFilter, onSelectFilter, onCreateCollection }) => {
  const [newCollectionName, setNewCollectionName] = useState('');
  const [addingCollection, setAddingCollection] = useState(false);

  const navItems = [
    { id: 'library', label: 'Library', icon: Library },
    { id: 'shared', label: 'Shared Vault', icon: Share2 },
    { id: 'oracle', label: 'The Oracle', icon: Zap },
    { id: 'scribe', label: 'Scribe', icon: HelpCircle },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const submitNewCollection = () => {
    if (newCollectionName.trim()) onCreateCollection(newCollectionName.trim());
    setNewCollectionName('');
    setAddingCollection(false);
  };

  const isFilterActive = (type: 'collection' | 'tag', id: number) => activeTab === 'library' && libraryFilter.type === type && libraryFilter.id === id;

  return (
    <aside className="sidebar glass-nav">
      <div className="sidebar-header" style={{ padding: '0 16px', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '1.2rem', fontWeight: 900, letterSpacing: '0.1em', color: 'var(--accent-primary)' }}>VASHIRA</h1>
        <p style={{ fontSize: '0.65rem', opacity: 0.55, fontWeight: 700 }}>SOVEREIGN INTELLIGENCE</p>
      </div>

      <nav data-tour="nav" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div data-tour="collections" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Collections</span>
          <button
            className="icon-btn-plain"
            style={{ padding: '2px' }}
            onClick={() => setAddingCollection(v => !v)}
            title="New collection"
          >
            <Plus size={14} />
          </button>
        </div>

        {addingCollection && (
          <input
            className="glass-input"
            autoFocus
            placeholder="Collection name..."
            style={{ fontSize: '0.75rem', padding: '6px 10px', marginBottom: '8px' }}
            value={newCollectionName}
            onChange={e => setNewCollectionName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewCollection(); if (e.key === 'Escape') { setAddingCollection(false); setNewCollectionName(''); } }}
            onBlur={submitNewCollection}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '20px' }}>
          {collections.length === 0 && !addingCollection && (
            <p style={{ fontSize: '0.7rem', opacity: 0.35, padding: '4px 8px' }}>No collections yet.</p>
          )}
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelectFilter({ type: 'collection', id: c.id, label: c.name })}
              className={`sidebar-nav-item ${isFilterActive('collection', c.id) ? 'active' : ''}`}
              style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', padding: '6px 8px', fontSize: '0.8rem' }}
            >
              <FolderClosed size={14} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.65rem', fontWeight: 800, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tags</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px', paddingBottom: '16px' }}>
          {tags.length === 0 && (
            <p style={{ fontSize: '0.7rem', opacity: 0.35 }}>No tags yet.</p>
          )}
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelectFilter({ type: 'tag', id: t.id, label: t.name })}
              className="badge"
              style={{
                cursor: 'pointer', border: 'none',
                background: isFilterActive('tag', t.id) ? (t.color || 'var(--accent-primary)') : 'rgba(255,255,255,0.06)',
                color: isFilterActive('tag', t.id) ? '#0d0d12' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <TagIcon size={10} /> {t.name}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="p2p-status" style={{ padding: '16px' }}>
        <div className="glass" style={{ padding: '16px', borderRadius: '16px', fontSize: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              background: communityMode ? '#10b981' : '#64748b',
              boxShadow: communityMode ? '0 0 10px #10b981' : 'none'
            }} />
            <span style={{ fontWeight: 600 }}>{communityMode ? 'Global Mesh' : 'Sovereign LAN'}</span>
          </div>
          <p style={{ opacity: 0.5, fontSize: '0.65rem' }}>
            {natStatus || 'P2P Initializing...'}
          </p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
