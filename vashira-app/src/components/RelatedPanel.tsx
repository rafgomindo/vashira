import React, { useEffect, useState } from 'react';
import { Compass, Loader } from 'lucide-react';
import PaperCard, { Candidate, paperCardStyles } from './PaperCard';

type Related = { work: Candidate | null; references: Candidate[]; citedBy: Candidate[]; similar: Candidate[] };
type Tab = 'citedBy' | 'references' | 'similar';

interface RelatedPanelProps {
  itemId: number;
  onAdded: (itemId: number, info: any) => void;
  onOpenItem: (itemId: number) => void;
  onError: (message: string) => void;
}

/** "Related papers" section of the item detail panel (OpenAlex). Loads on demand. */
const RelatedPanel: React.FC<RelatedPanelProps> = ({ itemId, onAdded, onOpenItem, onError }) => {
  const [data, setData] = useState<Related | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('citedBy');

  useEffect(() => { setData(null); setError(null); setLoading(false); }, [itemId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const res = await (window as any).vashiraAPI.discoveryRelated(itemId);
    setLoading(false);
    if (res?.error) { setError(res.error); return; }
    setData(res);
    setTab(res.citedBy.length ? 'citedBy' : res.references.length ? 'references' : 'similar');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'citedBy', label: 'Cited by' },
    { id: 'references', label: 'References' },
    { id: 'similar', label: 'Similar' },
  ];

  return (
    <section className="details-section" data-tour="detail-related">
      <style>{paperCardStyles}</style>
      <label className="details-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Compass size={12} /> Related papers
      </label>

      {!data && !loading && (
        <>
          <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={load}>
            <Compass size={14} /> FIND RELATED PAPERS
          </button>
          <p style={{ fontSize: '0.7rem', opacity: 0.45, marginTop: '6px' }}>
            References, citing papers and similar work from OpenAlex (free, open scholarly database).
          </p>
        </>
      )}
      {loading && <p style={{ fontSize: '0.8rem', opacity: 0.6, display: 'flex', gap: '8px', alignItems: 'center' }}><Loader size={14} className="spin" /> Asking OpenAlex…</p>}
      {error && <p style={{ fontSize: '0.75rem', color: '#ef4444' }}>{error}</p>}

      {data && !data.work && (
        <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>OpenAlex doesn’t know this item (no DOI and no exact title match).</p>
      )}

      {data?.work && (
        <>
          <p style={{ fontSize: '0.72rem', opacity: 0.55 }}>
            Matched in OpenAlex · cited {data.work.citedByCount.toLocaleString()} times
          </p>
          <div style={{ display: 'flex', gap: '6px', margin: '4px 0 10px' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                className={`btn-secondary ${tab === t.id ? 'active' : ''}`}
                style={{ padding: '5px 10px', fontSize: '0.7rem', borderColor: tab === t.id ? 'var(--accent-primary)' : undefined, color: tab === t.id ? 'var(--accent-primary)' : undefined }}
                onClick={() => setTab(t.id)}
              >
                {t.label} ({data[t.id].length})
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {data[tab].length === 0 && <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Nothing listed in OpenAlex.</p>}
            {data[tab].map(p => (
              <PaperCard key={p.openalexId} paper={p} compact onAdded={onAdded} onOpenItem={onOpenItem} onError={onError} />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default RelatedPanel;
