import React, { useState } from 'react';
import { Plus, FileDown, Check, ExternalLink, Quote } from 'lucide-react';

/** An OpenAlex result (see src/openalex.ts Candidate). */
export type Candidate = {
  openalexId: string; title: string; authors: string; published: string; doi: string; journal: string;
  itemType: string; citedByCount: number; oaPdfUrl: string; abstract: string;
  inLibraryId?: number | null; citedByYourLibrary?: number;
};

interface PaperCardProps {
  paper: Candidate;
  compact?: boolean;                                   // narrow detail panel
  onAdded: (itemId: number, info: { alreadyInLibrary?: boolean; pdf?: boolean }) => void;
  onOpenItem: (itemId: number) => void;
  onError: (message: string) => void;
}

const shortAuthors = (a: string) => {
  const list = a.split(',').map(x => x.trim()).filter(Boolean);
  return list.length > 3 ? `${list.slice(0, 3).join(', ')} et al.` : list.join(', ');
};

const PaperCard: React.FC<PaperCardProps> = ({ paper, compact, onAdded, onOpenItem, onError }) => {
  const [busy, setBusy] = useState<false | 'add' | 'pdf'>(false);
  const [addedId, setAddedId] = useState<number | null>(paper.inLibraryId || null);
  const [showAbstract, setShowAbstract] = useState(false);

  const add = async (withPdf: boolean) => {
    setBusy(withPdf ? 'pdf' : 'add');
    try {
      const res = await (window as any).vashiraAPI.discoveryAdd(paper, { withPdf });
      if (res?.error) { onError(res.error); return; }
      setAddedId(res.itemId);
      onAdded(res.itemId, res);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="paper-card">
      <p className="paper-title" onClick={() => paper.abstract && setShowAbstract(v => !v)} style={{ cursor: paper.abstract ? 'pointer' : 'default' }}>
        {paper.title}
      </p>
      <p className="paper-meta">
        {[shortAuthors(paper.authors) || 'Unknown authors', paper.published, paper.journal].filter(Boolean).join(' · ')}
      </p>
      {showAbstract && <p className="paper-abstract">{paper.abstract}</p>}
      <div className="paper-row">
        <span className="badge" title="Times cited (OpenAlex)"><Quote size={10} /> {paper.citedByCount.toLocaleString()}</span>
        {!!paper.citedByYourLibrary && <span className="badge" style={{ color: 'var(--accent-primary)' }}>cited by {paper.citedByYourLibrary} of your papers</span>}
        {paper.oaPdfUrl && <span className="badge" style={{ color: '#10b981' }} title="A free, legal open-access PDF exists">FREE PDF</span>}
        {paper.doi && !compact && (
          <a className="badge" href={`https://doi.org/${paper.doi}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            DOI <ExternalLink size={9} />
          </a>
        )}
        <span style={{ flex: 1 }} />
        {addedId ? (
          <button className="btn-secondary paper-btn" onClick={() => onOpenItem(addedId)}><Check size={12} /> In library</button>
        ) : (
          <>
            <button className="btn-secondary paper-btn" disabled={!!busy} onClick={() => add(false)}>
              <Plus size={12} /> {busy === 'add' ? 'Adding…' : 'Add'}
            </button>
            {paper.oaPdfUrl && (
              <button className="btn-secondary paper-btn" disabled={!!busy} onClick={() => add(true)} title="Add and download the free PDF">
                <FileDown size={12} /> {busy === 'pdf' ? 'Downloading…' : compact ? 'PDF' : 'Add with PDF'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const paperCardStyles = `
  .paper-card { background: rgba(0,0,0,0.2); border: 1px solid var(--border-glass); border-radius: 12px; padding: 12px 14px; }
  .paper-title { font-weight: 700; font-size: 0.85rem; line-height: 1.35; }
  .paper-meta { font-size: 0.72rem; opacity: 0.6; margin-top: 3px; }
  .paper-abstract { font-size: 0.75rem; opacity: 0.75; line-height: 1.5; margin-top: 8px; }
  .paper-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  .paper-btn { padding: 4px 10px !important; font-size: 0.7rem !important; }
`;

export default PaperCard;
