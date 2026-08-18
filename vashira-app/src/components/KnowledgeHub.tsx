import React, { useEffect, useState } from 'react';
import { X, Network, PenTool, ShieldCheck, Plus, ChevronRight, FileText, Users, RefreshCw, Tag as TagIcon, FolderClosed } from 'lucide-react';

interface KnowledgeHubProps {
  selectedItem: any;
  setSelectedItem: (item: any) => void;
  isDetailsOpen: boolean;
  setIsDetailsOpen: (open: boolean) => void;
  onUpdate: () => void;
  onGraphify: () => void;
  onCite: () => void;
  dupes: any[];
  collections: any[];
  onAddToCollection: (itemId: number, collectionId: number) => void;
  onAddTag: (itemId: number, tagName: string) => Promise<void> | void;
  onRemoveTag: (itemId: number, tagId: number) => Promise<void> | void;
  onFetchFromCrossRef: () => void;
}

const KnowledgeHub: React.FC<KnowledgeHubProps> = ({
  selectedItem,
  setSelectedItem,
  isDetailsOpen,
  setIsDetailsOpen,
  onUpdate,
  onGraphify,
  onCite,
  dupes,
  collections,
  onAddToCollection,
  onAddTag,
  onRemoveTag,
  onFetchFromCrossRef
}) => {
  const [consensus, setConsensus] = useState<any[]>([]);
  const [itemTags, setItemTags] = useState<any[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [collectionToAdd, setCollectionToAdd] = useState<string>('');

  // Two different trust sources for "what is this item's real title": a DOI already
  // resolves to one authoritative record at CrossRef, so peer voting is redundant
  // there. Peer consensus only earns its keep for items identified by file hash —
  // books/scans where local heuristics guessed, and peers who hold the exact same
  // bytes can corroborate (or correct) that guess.
  const isDoiItem = !!selectedItem?.doi;
  const identifier = selectedItem?.doi || selectedItem?.fileHash;

  const refreshItemTags = () => {
    if (!selectedItem?.id) { setItemTags([]); return; }
    (window as any).vashiraAPI.getTagsForItem(selectedItem.id).then((t: any[]) => setItemTags(t || [])).catch(() => setItemTags([]));
  };

  useEffect(() => {
    refreshItemTags();
  }, [selectedItem?.id]);

  useEffect(() => {
    if (isDoiItem || !identifier) { setConsensus([]); return; }
    let cancelled = false;
    (window as any).vashiraAPI.getConsensus(identifier).then((results: any[]) => {
      if (cancelled) return;
      const differing = (results || []).filter((c: any) =>
        c.title !== selectedItem.title || c.authors !== selectedItem.authors || c.published !== selectedItem.published
      );
      setConsensus(differing);
    }).catch(() => setConsensus([]));
    return () => { cancelled = true; };
  }, [identifier, isDoiItem]);

  const applyConsensus = (c: any) => {
    setSelectedItem({ ...selectedItem, title: c.title, authors: c.authors, published: c.published });
  };

  const submitNewTag = async () => {
    const name = newTagName.trim();
    if (!name || !selectedItem?.id) return;
    setNewTagName('');
    await onAddTag(selectedItem.id, name);
    refreshItemTags();
  };

  const removeTag = async (tagId: number) => {
    if (!selectedItem?.id) return;
    setItemTags(prev => prev.filter(t => t.id !== tagId));
    await onRemoveTag(selectedItem.id, tagId);
  };

  const submitAddToCollection = () => {
    if (!collectionToAdd || !selectedItem?.id) return;
    onAddToCollection(selectedItem.id, Number(collectionToAdd));
    setCollectionToAdd('');
  };

  if (!isDetailsOpen || !selectedItem) return null;

  return (
    <aside className="details-panel glass-nav slide-in-right" style={{ width: '420px', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '24px', borderBottom: '1px solid var(--border-glass)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShieldCheck size={18} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Sovereign Record</h3>
        </div>
        <button className="icon-btn-plain" onClick={() => setIsDetailsOpen(false)}><X size={18} /></button>
      </header>

      <style>{`
        .icon-btn-plain {
           background: none; border: none; color: var(--text-secondary); cursor: pointer; transition: 0.2s;
        }
        .icon-btn-plain:hover { color: var(--text-primary); }
        .details-section { display: flex; flexDirection: column; gap: 12px; padding: 24px; border-bottom: 1px solid var(--border-glass); }
        .details-label { font-size: 0.7rem; font-weight: 800; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
      `}</style>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div data-tour="detail-title">
        <section className="details-section">
          <label className="details-label">Master Title</label>
          <textarea
            className="glass-input"
            style={{ minHeight: '80px', fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.4, background: 'transparent', border: 'none', padding: 0 }}
            value={selectedItem.title}
            onChange={e => setSelectedItem({...selectedItem, title: e.target.value})}
          />
          {dupes.length > 1 && (
             <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '8px 12px', borderRadius: '10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                <ShieldCheck size={14} /> <span>Potential Duplicate in Master Node</span>
             </div>
          )}
        </section>

        <section className="details-section">
          <label className="details-label">Lead Author(s)</label>
          <input
            className="glass-input"
            style={{ background: 'transparent', border: 'none', padding: 0, fontWeight: 500 }}
            value={selectedItem.authors}
            onChange={e => setSelectedItem({...selectedItem, authors: e.target.value})}
          />
        </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <section className="details-section" style={{ borderRight: '1px solid var(--border-glass)' }}>
            <label className="details-label">Type</label>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedItem.itemType}</div>
          </section>
          <section className="details-section">
            <label className="details-label">Published</label>
            <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedItem.published}</div>
          </section>
        </div>

        {selectedItem.doi && (
          <section className="details-section">
            <label className="details-label">Digital Object Identifier</label>
            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: 'var(--accent-primary)', wordBreak: 'break-all' }}>{selectedItem.doi}</div>
          </section>
        )}

        <section className="details-section">
          <label className="details-label">Core Abstract</label>
          <p style={{ fontSize: '0.9rem', lineHeight: 1.6, opacity: 0.8 }}>{selectedItem.abstract || 'No abstract indexed yet.'}</p>
        </section>

        <div data-tour="detail-tags-collections">
        <section className="details-section">
          <label className="details-label">Tags</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: itemTags.length ? '4px' : 0 }}>
            {itemTags.map(t => (
              <span key={t.id} className="badge" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.06)' }}>
                <TagIcon size={10} /> {t.name}
                <X size={10} style={{ cursor: 'pointer', opacity: 0.6 }} onClick={() => removeTag(t.id)} />
              </span>
            ))}
          </div>
          <input
            className="glass-input"
            placeholder="Add a tag and press Enter..."
            style={{ fontSize: '0.8rem', padding: '8px 12px' }}
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submitNewTag(); }}
          />
        </section>

        <section className="details-section">
          <label className="details-label">Add to Collection</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="glass-input"
              style={{ flex: 1, fontSize: '0.85rem' }}
              value={collectionToAdd}
              onChange={e => setCollectionToAdd(e.target.value)}
            >
              <option value="">Choose collection...</option>
              {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-secondary" style={{ padding: '8px 14px' }} disabled={!collectionToAdd} onClick={submitAddToCollection}>
              <FolderClosed size={14} />
            </button>
          </div>
        </section>
        </div>

        {isDoiItem ? (
          <section className="details-section">
            <div style={{ background: 'rgba(167, 139, 250, 0.06)', border: '1px solid var(--border-focus)', borderRadius: '14px', padding: '14px' }}>
              <label className="details-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                <ShieldCheck size={12} /> Authoritative Source
              </label>
              <p style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: '10px' }}>
                This item has a DOI — CrossRef is the canonical record, not peer opinion.
              </p>
              <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={onFetchFromCrossRef}>
                <RefreshCw size={14} /> VERIFY VIA CROSSREF
              </button>
            </div>
          </section>
        ) : consensus.length > 0 && (
          <section className="details-section">
            <div style={{ background: 'rgba(167, 139, 250, 0.06)', border: '1px solid var(--border-focus)', borderRadius: '14px', padding: '14px' }}>
              <label className="details-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-primary)' }}>
                <Users size={12} /> Peer Consensus ({consensus.length} conflicting record{consensus.length > 1 ? 's' : ''})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {consensus.map((c, i) => (
                  <div key={i} style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '10px', padding: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</p>
                      <p style={{ fontSize: '0.7rem', opacity: 0.6 }}>{c.authors} &bull; {c.published} &bull; {c.votes} distinct peers</p>
                    </div>
                    <button className="btn-secondary" style={{ padding: '6px 10px', fontSize: '0.7rem', flexShrink: 0 }} onClick={() => applyConsensus(c)}>APPLY</button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      <footer style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div data-tour="detail-actions" style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-primary" style={{ flex: 1 }} onClick={onUpdate}>COMMIT UPDATES</button>
          <button className="btn-secondary icon-btn-plain" style={{ padding: '12px' }} onClick={onCite}><PenTool size={18} /></button>
        </div>

        {selectedItem.filePath?.toLowerCase().endsWith('.docx') && (
          <button className="btn-secondary" style={{ width: '100%', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={onGraphify}>
             <Network size={18} />
             <span>SCAN NETWORK (GRAPHIFY)</span>
          </button>
        )}
      </footer>
    </aside>
  );
};

export default KnowledgeHub;
