import React, { useEffect, useMemo, useState } from 'react';
import { Copy, GitMerge, X, Check, FileText, ShieldCheck, ArrowLeft } from 'lucide-react';

type ToastAction = { label: string; onClick: () => void };

interface DuplicatesViewProps {
  onShowToast: (message: string, type?: 'success' | 'alert', action?: ToastAction) => void;
  onChanged: () => void;              // library changed (merge / undo)
  focusItemId?: number | null;        // open straight into this item's group (from the detail panel)
}

// What the merge table lets you choose between, in display order.
const FIELDS: { key: string; label: string }[] = [
  { key: 'title', label: 'Title' },
  { key: 'authors', label: 'Authors' },
  { key: 'published', label: 'Published' },
  { key: 'itemType', label: 'Type' },
  { key: 'doi', label: 'DOI' },
  { key: 'isbn', label: 'ISBN' },
  { key: 'journal', label: 'Journal' },
  { key: 'volume', label: 'Volume' },
  { key: 'issue', label: 'Issue' },
  { key: 'pages', label: 'Pages' },
  { key: 'publisher', label: 'Publisher' },
  { key: 'edition', label: 'Edition' },
  { key: 'url', label: 'URL' },
  { key: 'abstract', label: 'Abstract' },
  { key: 'filePath', label: 'PDF' },
];

const isBlank = (v: any) => v === null || v === undefined || v === '' || v === 0 || v === 'N/A';
const fileName = (p: string) => (p || '').split(/[\\/]/).pop();
const show = (key: string, v: any) => (isBlank(v) ? '—' : key === 'filePath' ? fileName(v) : String(v));

// Same rule as duplicates.ts pickDefaultMaster: has a file, then most filled-in fields, then oldest.
function defaultMaster(items: any[]) {
  const score = (i: any) => (i.filePath ? 1000 : 0) + FIELDS.filter(f => !isBlank(i[f.key])).length;
  return [...items].sort((a, b) => score(b) - score(a) || a.id - b.id)[0];
}

const MergePanel: React.FC<{ group: any; onCancel: () => void; onMerged: (logId: number, count: number) => void }> = ({ group, onCancel, onMerged }) => {
  const items: any[] = group.items;
  const [masterId, setMasterId] = useState<number>(defaultMaster(items).id);
  // field → id of the record whose value wins
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const differing = useMemo(
    () => FIELDS.filter(f => new Set(items.map(i => (isBlank(i[f.key]) ? '' : String(i[f.key])))).size > 1),
    [items]
  );

  // Default per field: the master's value, unless it's blank and another record has one.
  useEffect(() => {
    const master = items.find(i => i.id === masterId);
    const next: Record<string, number> = {};
    for (const f of differing) {
      const donor = isBlank(master[f.key]) ? items.find(i => !isBlank(i[f.key])) : master;
      next[f.key] = (donor || master).id;
    }
    setChoice(next);
  }, [masterId]);

  const merge = async () => {
    setBusy(true);
    const master = items.find(i => i.id === masterId);
    const fieldValues: Record<string, any> = {};
    for (const f of differing) {
      const src = items.find(i => i.id === choice[f.key]);
      if (src && src.id !== masterId) {
        fieldValues[f.key] = src[f.key];
        if (f.key === 'filePath') fieldValues.fileHash = src.fileHash; // a file and its fingerprint travel together
      }
    }
    try {
      const others = items.filter(i => i.id !== master.id).map(i => i.id);
      const logId = await (window as any).vashiraAPI.mergeItems(master.id, others, fieldValues);
      onMerged(logId, items.length);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass-card scale-up" style={{ padding: '24px', overflowX: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '16px' }}>
        <button className="btn-secondary" onClick={onCancel}><ArrowLeft size={14} /> Back</button>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, flex: 1 }}>
          Pick the record to keep, then the value to keep wherever they differ. Tags, collections, notes and annotations from all records are combined; the others go to the Trash.
        </p>
        <button className="btn-primary" disabled={busy} onClick={merge}><GitMerge size={16} /> MERGE {items.length} RECORDS</button>
      </div>

      <table className="data-table merge-table">
        <thead>
          <tr>
            <th style={{ width: '120px' }}></th>
            {items.map(i => (
              <th key={i.id}>
                <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="radio" name="master" checked={masterId === i.id} onChange={() => setMasterId(i.id)} />
                  {masterId === i.id ? <strong style={{ color: 'var(--accent-primary)' }}>KEEP THIS RECORD</strong> : 'Keep this record'}
                </label>
                <div style={{ fontSize: '0.7rem', opacity: 0.5, fontWeight: 400, marginTop: '4px' }}>Added {String(i.dateAdded || '').slice(0, 10)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {differing.length === 0 && (
            <tr><td colSpan={items.length + 1} style={{ opacity: 0.6 }}>These records are identical — merging just combines their tags, notes and collections.</td></tr>
          )}
          {differing.map(f => (
            <tr key={f.key}>
              <td style={{ fontWeight: 700, fontSize: '0.75rem', opacity: 0.7 }}>{f.label}</td>
              {items.map(i => (
                <td key={i.id}>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: isBlank(i[f.key]) ? 'default' : 'pointer', opacity: isBlank(i[f.key]) ? 0.4 : 1 }}>
                    <input
                      type="radio"
                      name={`field-${f.key}`}
                      disabled={isBlank(i[f.key])}
                      checked={choice[f.key] === i.id}
                      onChange={() => setChoice(c => ({ ...c, [f.key]: i.id }))}
                      style={{ marginTop: '3px' }}
                    />
                    <span className={f.key === 'abstract' ? 'clamp-3' : ''} style={{ fontSize: '0.8rem', wordBreak: 'break-word' }}>{show(f.key, i[f.key])}</span>
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const DuplicatesView: React.FC<DuplicatesViewProps> = ({ onShowToast, onChanged, focusItemId }) => {
  const [groups, setGroups] = useState<any[] | null>(null);
  const [merging, setMerging] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const g = await (window as any).vashiraAPI.findDuplicateGroups();
    setGroups(g || []);
    return g || [];
  };

  useEffect(() => {
    load().then((g: any[]) => {
      if (focusItemId) {
        const target = g.find(x => x.items.some((i: any) => i.id === focusItemId));
        if (target) setMerging(target);
      }
    });
  }, [focusItemId]);

  const undo = async (logIds: number[]) => {
    try {
      for (const id of [...logIds].reverse()) await (window as any).vashiraAPI.undoMerge(id);
      onShowToast('Merge undone.');
    } catch (e: any) {
      onShowToast(e?.message || 'Could not undo the merge.', 'alert');
    }
    onChanged();
    load();
  };

  const exactGroups = (groups || []).filter(g => g.kind === 'exact');

  const mergeAllExact = async () => {
    setBusy(true);
    try {
      const logIds: number[] = await (window as any).vashiraAPI.mergeAllExact();
      onShowToast(`Merged ${logIds.length} group${logIds.length === 1 ? '' : 's'} of exact duplicates.`, 'success', { label: 'UNDO', onClick: () => undo(logIds) });
      onChanged();
      load();
    } finally {
      setBusy(false);
    }
  };

  const notDuplicates = async (group: any) => {
    await (window as any).vashiraAPI.markNotDuplicates(group.items.map((i: any) => i.id));
    onShowToast('Marked as not duplicates.');
    load();
  };

  return (
    <div className="main-view fade-in">
      <style>{`
        .clamp-3 { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .merge-table td, .merge-table th { vertical-align: top; min-width: 220px; }
        .dup-item { flex: 1; min-width: 220px; background: rgba(0,0,0,0.2); border-radius: 12px; padding: 12px 14px; }
      `}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '32px' }}>
        <div>
          <h2 className="view-title">Duplicates</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            {groups === null ? 'Scanning your library…'
              : groups.length === 0 ? 'No duplicates found. Your library is clean.'
              : `${groups.length} group${groups.length === 1 ? '' : 's'} found — ${exactGroups.length} exact, ${groups.length - exactGroups.length} likely.`}
          </p>
        </div>
        {!merging && exactGroups.length > 0 && (
          <button className="btn-primary" disabled={busy} onClick={mergeAllExact} title="Same DOI, ISBN or file. Keeps the most complete record and fills its gaps from the others.">
            <GitMerge size={16} /> MERGE ALL EXACT MATCHES ({exactGroups.length})
          </button>
        )}
      </header>

      {merging ? (
        <MergePanel
          group={merging}
          onCancel={() => setMerging(null)}
          onMerged={(logId, count) => {
            setMerging(null);
            onShowToast(`Merged ${count} records into one.`, 'success', { label: 'UNDO', onClick: () => undo([logId]) });
            onChanged();
            load();
          }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {(groups || []).map(g => (
            <div key={g.key} className="glass-card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge" style={{ background: g.kind === 'exact' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)', color: g.kind === 'exact' ? '#ef4444' : '#eab308' }}>
                    {g.kind === 'exact' ? <><ShieldCheck size={10} /> EXACT</> : <><Copy size={10} /> LIKELY</>}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>{g.reasons.join(' · ')}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={() => notDuplicates(g)}>
                    <X size={12} /> Not duplicates
                  </button>
                  <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }} onClick={() => setMerging(g)}>
                    <GitMerge size={12} /> Review &amp; merge
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {g.items.map((i: any) => (
                  <div key={i.id} className="dup-item">
                    <p style={{ fontWeight: 700, fontSize: '0.85rem' }}>{i.title}</p>
                    <p style={{ fontSize: '0.75rem', opacity: 0.6 }}>{i.authors || 'Unknown'} · {i.published || 'n.d.'}</p>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {i.doi && <span className="badge">DOI</span>}
                      {i.isbn && <span className="badge">ISBN</span>}
                      {i.filePath && <span className="badge"><FileText size={10} /> PDF</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {groups && groups.length === 0 && (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center', opacity: 0.7 }}>
              <Check size={28} style={{ marginBottom: '8px' }} />
              <p>Nothing to merge. New imports are checked automatically.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DuplicatesView;
