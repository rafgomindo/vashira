import React, { useEffect, useRef, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { LAN_SHARING_QUESTION, LAN_SHARING_EXPLAINER, SharingChoiceButtons } from './SharingPrompt';

interface TourStep {
  target: string | null; // matches a [data-tour="..."] element, or null to center on screen
  tab?: string;           // switch to this sidebar tab before measuring the target
  requiresItem?: boolean; // this target only exists once an item is selected in the detail panel
  choice?: 'lan-sharing'; // the step asks a question; answering it advances the tour
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to Vashira',
    body: "This is your Sovereign Research Hub — a local-first reference manager that also discovers metadata (never files) from peers who use it too. This tour covers every screen and every control — skip anytime, or replay it later from Settings."
  },
  {
    target: 'window-controls',
    title: 'Window controls',
    body: 'Vashira uses its own titlebar instead of the OS one. These three buttons minimize, maximize, and close the app.'
  },
  {
    target: 'nav',
    tab: 'library',
    title: 'Six screens, always here',
    body: 'Library holds what you’ve mastered. Discover finds new papers in OpenAlex. Shared Vault shows peers and P2P discoveries. The Oracle answers questions over your own library. Scribe is a citation-aware markdown editor. Settings configures all of it.'
  },
  {
    target: 'collections',
    tab: 'library',
    title: 'Collections & Tags',
    body: 'Click the + to create a Collection, or click any existing Collection or Tag chip to instantly filter your Library down to just those items.'
  },
  {
    target: 'p2p-status',
    tab: 'library',
    title: 'P2P mesh status',
    body: 'Shows whether you’re on Sovereign LAN (local network only) or Global Mesh (peers across the internet, via Settings). Only bibliographic metadata is ever exchanged here — never files.'
  },
  {
    target: 'p2p-status',
    tab: 'library',
    choice: 'lan-sharing',
    title: LAN_SHARING_QUESTION,
    body: LAN_SHARING_EXPLAINER
  },
  {
    target: 'search',
    tab: 'library',
    title: 'Search your library',
    body: 'Filters by title or author as you type — and from 3 letters on, also searches the full text inside your PDFs, showing the page number and the matching passage. Accents don’t matter.'
  },
  {
    target: 'discover-search',
    tab: 'discover',
    title: 'Discover new papers',
    body: 'Search 250+ million works in OpenAlex, a free and open scholarly database. Click a title to read its abstract; Add puts it in your library, and Add with PDF also downloads the free, legal open-access copy when one exists.'
  },
  {
    target: 'discover-suggestions',
    tab: 'discover',
    title: 'What your library keeps citing',
    body: 'Analyzes the papers in your library that have a DOI and lists the works several of them cite that you don’t have yet — often the classics of your field.'
  },
  {
    target: 'duplicates',
    tab: 'library',
    title: 'Duplicates',
    body: 'Finds records that are the same work — same DOI, ISBN or file, or a near-identical title by the same author or year. Merge them side by side (keeping the best value of each field), merge all exact matches in one click, and undo any merge. Imports are checked automatically.'
  },
  {
    target: 'trash',
    tab: 'library',
    title: 'Trash',
    body: 'Deleted items land here first. Restore anything you removed by mistake, or empty the Trash to delete items and their stored files for good.'
  },
  {
    target: 'library-toolbar-extra',
    tab: 'library',
    title: 'Sync & bulk import/export',
    body: 'The refresh icon syncs with your Zotero library (configure credentials in Settings first). The “•••” menu imports a BibTeX or RIS file, or exports your current view as BibTeX.'
  },
  {
    target: 'import-btn',
    tab: 'library',
    title: 'Import Mastery',
    body: 'Your main way to add something: pick a PDF and Vashira looks up its DOI or ISBN automatically. No match? It falls back to extracting a title straight from the file, and flags the record as unverified.'
  },
  {
    target: 'view-toggle',
    tab: 'library',
    title: 'Grid, list, or graph',
    body: 'Switch how your library displays. Graph view lights up after you “Graphify” a .docx file from its detail panel, showing its detected cross-references.'
  },
  {
    target: 'book-card',
    tab: 'library',
    title: 'Open a record',
    body: 'Click any card to open its full record on the right — title, authors, tags, collections, citation tools, and (when applicable) Peer Consensus or CrossRef verification.'
  },
  {
    target: 'detail-title',
    tab: 'library',
    requiresItem: true,
    title: 'Editable record',
    body: 'Title and author are editable right here — useful when a heuristic guess needs correcting. Nothing saves until you commit it (next steps).'
  },
  {
    target: 'detail-tags-collections',
    tab: 'library',
    requiresItem: true,
    title: 'Tags & Collections, per item',
    body: 'Add a tag by typing a name and pressing Enter (remove one with the ×). Add the item to any Collection with the picker below it.'
  },
  {
    target: null,
    tab: 'library',
    title: 'Peer Consensus & CrossRef',
    body: 'Two different trust sources, shown only when relevant: items with a DOI get a “Verify via CrossRef” button (the real authority). Items without one show “Peer Consensus” once 2+ distinct peers corroborate a different title/author — click Apply to accept it.'
  },
  {
    target: 'detail-related',
    tab: 'library',
    requiresItem: true,
    title: 'Related papers',
    body: 'For any item, see what it cites, who cites it (most-cited first) and similar work, straight from OpenAlex — and add any of them in one click.'
  },
  {
    target: 'detail-actions',
    tab: 'library',
    requiresItem: true,
    title: 'Commit, cite, trash, graphify',
    body: 'COMMIT UPDATES saves your edits. The pen icon copies a formatted citation (style set in Settings), and the bin moves the item to the Trash. For .docx files, a GRAPHIFY button also appears here.'
  },
  {
    target: 'peers-list',
    tab: 'shared',
    title: 'Online peers',
    body: 'Everyone currently reachable on your Sovereign LAN or Global Mesh.'
  },
  {
    target: 'discoveries',
    tab: 'shared',
    title: 'Recent discoveries',
    body: 'When a peer masters something, it appears here — title only. If you don’t already have it, an “Import Metadata” button fetches the full bibliographic record (still never the file itself).'
  },
  {
    target: 'oracle-input',
    tab: 'oracle',
    title: 'Ask the Oracle',
    body: 'Type a research question and it answers using only your own library as context (configure a provider in Settings first). Nothing here reaches the internet except your chosen AI API.'
  },
  {
    target: 'scribe-editor-area',
    tab: 'scribe',
    title: 'The Scribe',
    body: 'A markdown editor for your own notes. Type @ followed by a few letters to search your library and insert a formatted citation inline.'
  },
  {
    target: 'scribe-persist',
    tab: 'scribe',
    title: 'Persist your draft',
    body: 'Saves what you’re writing locally so it’s here next time you open Scribe.'
  },
  {
    target: 'scribe-preview-area',
    tab: 'scribe',
    title: 'Live preview',
    body: 'Renders your markdown as you type.'
  },
  {
    target: 'settings-oracle',
    tab: 'settings',
    title: 'Oracle Engine setup',
    body: 'Point the Oracle at any OpenAI-compatible or Anthropic API: base URL, key, and model.'
  },
  {
    target: 'settings-zotero',
    tab: 'settings',
    title: 'Zotero sync & Global Mesh',
    body: 'Enter your Zotero credentials to pull in your existing library. The toggle below switches P2P from LAN-only to Global Mesh.'
  },
  {
    target: 'settings-citation',
    tab: 'settings',
    title: 'Citation style',
    body: 'APA, IEEE, or MLA — all built in and work fully offline. This is what the cite button in an item’s detail panel uses.'
  },
  {
    target: 'settings-tour',
    tab: 'settings',
    title: 'Replay this tour',
    body: 'Come back here anytime — useful once you’ve actually imported something, since a few steps show more when there’s real data to point at.'
  },
  {
    target: null,
    title: "That's everything",
    body: 'Every screen, every button. Nothing in Vashira is hidden behind a wizard beyond this one.'
  }
];

interface TourProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  items: any[];
  onSelectItem: (item: any) => void;
  onFinish: () => void;
  onLanSharingChoice: (share: boolean) => void;
}

const Tour: React.FC<TourProps> = ({ activeTab, onNavigate, items, onSelectItem, onFinish, onLanSharingChoice }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const selectedForTour = useRef(false);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const showThisStep = !(current.requiresItem && items.length === 0);
  const effectiveTarget = showThisStep ? current.target : null;

  useEffect(() => {
    if (current.tab && current.tab !== activeTab) {
      onNavigate(current.tab);
    }
    if (current.requiresItem && items.length > 0 && !selectedForTour.current) {
      onSelectItem(items[0]);
      selectedForTour.current = true;
    }

    const measure = () => {
      if (!effectiveTarget) { setRect(null); return; }
      const el = document.querySelector(`[data-tour="${effectiveTarget}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    };

    // Give the tab switch / item selection a moment to actually render before measuring.
    const t = setTimeout(measure, 60);
    window.addEventListener('resize', measure);
    return () => { clearTimeout(t); window.removeEventListener('resize', measure); };
  }, [step]);

  const finish = () => {
    localStorage.setItem('vashira_onboarded', 'true');
    onFinish();
  };

  const cardWidth = 360;
  const cardStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(Math.max(rect.bottom + 16, 48), window.innerHeight - 260),
        left: Math.min(Math.max(rect.left, 16), window.innerWidth - cardWidth - 16),
        width: cardWidth
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: cardWidth
      };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {rect ? (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: 14,
            boxShadow: '0 0 0 9999px rgba(5,5,8,0.8)',
            border: '2px solid var(--accent-primary)',
            pointerEvents: 'none',
            transition: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        />
      ) : (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,8,0.8)', backdropFilter: 'blur(2px)' }} />
      )}

      <div className="glass-card scale-up" style={{ ...cardStyle, padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{current.title}</h3>
        </div>
        <p style={{ fontSize: '0.85rem', lineHeight: 1.6, opacity: 0.75, marginBottom: '16px' }}>{current.body}</p>

        {current.choice === 'lan-sharing' && (
          <div style={{ marginBottom: '16px' }}>
            <SharingChoiceButtons onChoose={(share) => { onLanSharingChoice(share); setStep(s => s + 1); }} />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--border-glass)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--accent-gradient)', transition: 'width 250ms' }} />
          </div>
          <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, flexShrink: 0 }}>{step + 1}/{STEPS.length}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button style={{ fontSize: '0.75rem', fontWeight: 600, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={finish}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {step > 0 && (
              <button className="btn-secondary" style={{ padding: '9px 16px', fontSize: '0.75rem' }} onClick={() => setStep(s => s - 1)}>
                BACK
              </button>
            )}
            {/* A question step advances by answering it, so there's no NEXT that skips the choice. */}
            {!current.choice && (
              <button className="btn-primary" style={{ padding: '9px 18px', fontSize: '0.75rem' }} onClick={() => (isLast ? finish() : setStep(s => s + 1))}>
                {isLast ? 'FINISH' : 'NEXT'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tour;
