import React, { useState } from 'react';
import { Search, Sparkles, Loader } from 'lucide-react';
import PaperCard, { Candidate, paperCardStyles } from './PaperCard';

interface DiscoverViewProps {
  onAdded: (itemId: number, info: any) => void;
  onOpenItem: (itemId: number) => void;
  onError: (message: string) => void;
}

/** Discover tab: OpenAlex keyword search + "works your library keeps citing". */
const DiscoverView: React.FC<DiscoverViewProps> = ({ onAdded, onOpenItem, onError }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Candidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<{ analyzed: number; suggestions: Candidate[] } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    const res = await (window as any).vashiraAPI.discoverySearch(query.trim());
    setSearching(false);
    if (res?.error) { onError(res.error); return; }
    setResults(res);
  };

  const analyze = async () => {
    setAnalyzing(true);
    const res = await (window as any).vashiraAPI.discoverySuggestions();
    setAnalyzing(false);
    if (res?.error) { onError(res.error); return; }
    setSuggestions(res);
  };

  return (
    <div className="main-view fade-in">
      <style>{paperCardStyles}</style>
      <header>
        <h2 className="view-title">Discover</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Search 250+ million works in OpenAlex, a free and open scholarly database, and add them to your library in one click.
        </p>
      </header>

      <div data-tour="discover-search" style={{ display: 'flex', gap: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
          <input
            className="glass-input"
            style={{ paddingLeft: '48px' }}
            placeholder="Topic, title, author… (e.g. necropolitics border)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') search(); }}
          />
        </div>
        <button className="btn-primary" disabled={searching} onClick={search}>{searching ? 'SEARCHING…' : 'SEARCH'}</button>
      </div>

      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {results.length === 0 && <p style={{ opacity: 0.6 }}>No results.</p>}
          {results.map(p => <PaperCard key={p.openalexId} paper={p} onAdded={onAdded} onOpenItem={onOpenItem} onError={onError} />)}
        </div>
      )}

      <div data-tour="discover-suggestions" className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: suggestions ? '14px' : 0 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, display: 'flex', gap: '8px', alignItems: 'center' }}><Sparkles size={16} color="var(--accent-primary)" /> Your library keeps citing…</h3>
            <p style={{ fontSize: '0.8rem', opacity: 0.55 }}>Works referenced by several of your papers that you don’t have yet. Uses the papers in your library that have a DOI.</p>
          </div>
          <button className="btn-secondary" disabled={analyzing} onClick={analyze}>
            {analyzing ? <><Loader size={14} /> ANALYZING…</> : suggestions ? 'REFRESH' : 'ANALYZE MY LIBRARY'}
          </button>
        </div>
        {suggestions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {suggestions.suggestions.length === 0 && (
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                {suggestions.analyzed < 2
                  ? 'Add a few more papers with DOIs first — suggestions need at least two papers citing the same work.'
                  : `Analyzed ${suggestions.analyzed} papers: no work is cited by two or more of them yet.`}
              </p>
            )}
            {suggestions.suggestions.map(p => <PaperCard key={p.openalexId} paper={p} onAdded={onAdded} onOpenItem={onOpenItem} onError={onError} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscoverView;
