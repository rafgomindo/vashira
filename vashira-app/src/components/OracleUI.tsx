import React from 'react';
import { Zap, Send, Sparkles } from 'lucide-react';

interface OracleUIProps {
  query: string;
  setQuery: (q: string) => void;
  response: string | null;
  isLoading: boolean;
  onAsk: () => void;
}

const OracleUI: React.FC<OracleUIProps> = ({ query, setQuery, response, isLoading, onAsk }) => {
  return (
    <div className="main-view fade-in oracle-chat-container">
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
           <Sparkles size={32} color="var(--accent-primary)" />
           <h2 className="view-title">The Oracle</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Consult your collective knowledge base through Sovereign RAG.
        </p>
      </header>

      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px', borderRadius: '32px' }}>
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '32px' }}>
          {isLoading ? (
            <div className="shimmer" style={{ padding: '32px', borderRadius: '16px', color: 'var(--accent-primary)', fontWeight: 700 }}>
              CONSULTING THE VAULT...
            </div>
          ) : response ? (
            <div className="oracle-message ai fade-in">
              {response}
            </div>
          ) : (
            <div style={{ opacity: 0.2, textAlign: 'center', marginTop: '15%' }}>
               <Zap size={64} style={{ marginBottom: '24px' }} />
               <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Ask any question over your mastered artifacts.</p>
            </div>
          )}
        </div>

        <div data-tour="oracle-input" style={{ display: 'flex', gap: '16px' }}>
          <input
            className="glass-input"
            style={{ flex: 1, height: '60px', padding: '0 24px', fontSize: '1.1rem' }}
            placeholder="Interrogate your collection..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onAsk()}
          />
          <button className="btn-primary" onClick={onAsk} disabled={isLoading} style={{ width: '60px', padding: 0, justifyContent: 'center' }}>
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OracleUI;
