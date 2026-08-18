import React from 'react';
import { Globe, ShieldCheck, RefreshCw, Zap, Shield, Key, BookMarked, Sparkles } from 'lucide-react';

interface SettingsUIProps {
  oracleConfig: any;
  setOracleConfig: (config: any) => void;
  zoteroConfig: any;
  setZoteroConfig: (config: any) => void;
  communityMode: boolean;
  onToggleCommunity: (state: boolean) => void;
  onSyncZotero: () => void;
  onSaveOracle: () => void;
  isSyncing: boolean;
  natStatus: string | null;
  citationStyle: string;
  onChangeCitationStyle: (style: string) => void;
  onReplayTour: () => void;
}

const CITATION_STYLES = [
  { id: 'apa', label: 'APA' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'mla', label: 'MLA' },
];

const SettingsUI: React.FC<SettingsUIProps> = ({
  oracleConfig, setOracleConfig,
  zoteroConfig, setZoteroConfig,
  communityMode, onToggleCommunity,
  onSyncZotero, onSaveOracle,
  isSyncing, natStatus,
  citationStyle, onChangeCitationStyle,
  onReplayTour
}) => {
  return (
    <div className="main-view fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', overflowY: 'auto' }}>
      <header style={{ gridColumn: 'span 2' }}>
        <h2 className="view-title">Hub Mastery</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Configure your sovereign node and bridge connections.</p>
      </header>

      <div data-tour="settings-oracle" className="glass-card scale-up">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
           <Zap size={24} color="var(--accent-primary)" />
           <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>ORACLE ENGINE</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div>
              <label className="details-label">Base URL</label>
              <input className="glass-input" value={oracleConfig.baseUrl} onChange={e => setOracleConfig({...oracleConfig, baseUrl: e.target.value})} />
           </div>
           <div>
              <label className="details-label">Access Key (Auth)</label>
              <input className="glass-input" type="password" value={oracleConfig.apiKey} onChange={e => setOracleConfig({...oracleConfig, apiKey: e.target.value})} />
           </div>
           <div>
              <label className="details-label">Default Model</label>
              <input className="glass-input" value={oracleConfig.model} onChange={e => setOracleConfig({...oracleConfig, model: e.target.value})} />
           </div>
           <button className="btn-primary" onClick={onSaveOracle}>COMMIT CONNECTION</button>
        </div>
      </div>

      <div data-tour="settings-zotero" className="glass-card scale-up" style={{ animationDelay: '0.1s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
           <Shield size={24} color="var(--accent-primary)" />
           <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>ZOTERO HUB SYNC</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div>
              <label className="details-label">Zotero User ID</label>
              <input className="glass-input" value={zoteroConfig.userId} onChange={e => setZoteroConfig({...zoteroConfig, userId: e.target.value})} />
           </div>
           <div>
              <label className="details-label">Zotero API Key</label>
              <input className="glass-input" type="password" value={zoteroConfig.apiKey} onChange={e => setZoteroConfig({...zoteroConfig, apiKey: e.target.value})} />
           </div>
           
           <div className="glass" style={{ padding: '20px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>GLOBAL MESH MODE</h4>
                    <p style={{ fontSize: '0.75rem', opacity: 0.5 }}>Sync metadata across peers.</p>
                 </div>
                 <button 
                   className={`btn-secondary ${communityMode ? 'active' : ''}`} 
                   style={{ borderColor: communityMode ? '#3b82f6' : 'var(--border-glass)', background: communityMode ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}
                   onClick={() => onToggleCommunity(!communityMode)}>
                   {communityMode ? 'MESH ENABLED' : 'LAN ONLY'}
                 </button>
              </div>
           </div>

           <button className={`btn-primary ${isSyncing ? 'loading' : ''}`} onClick={onSyncZotero}>
              {isSyncing ? 'DIFFING COLLECTION...' : 'SYNC WITH ZOTERO'}
           </button>
        </div>
      </div>

      <div data-tour="settings-citation" className="glass-card scale-up" style={{ animationDelay: '0.15s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
           <BookMarked size={24} color="var(--accent-primary)" />
           <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>CITATION STYLE</h3>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px' }}>
          Used whenever you copy a citation from an item's record. Built-in and offline — no network dependency.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          {CITATION_STYLES.map(s => (
            <button
              key={s.id}
              className={`btn-secondary ${citationStyle === s.id ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center', borderColor: citationStyle === s.id ? 'var(--accent-primary)' : 'var(--border-glass)', color: citationStyle === s.id ? 'var(--accent-primary)' : undefined }}
              onClick={() => onChangeCitationStyle(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div data-tour="settings-tour" className="glass-card scale-up" style={{ animationDelay: '0.2s' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
           <Sparkles size={24} color="var(--accent-primary)" />
           <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>GUIDED TOUR</h3>
        </div>
        <p style={{ fontSize: '0.8rem', opacity: 0.5, marginBottom: '20px' }}>
          Replay the full walkthrough of every screen and control, any time.
        </p>
        <button className="btn-secondary" onClick={onReplayTour}>REPLAY TOUR</button>
      </div>

      <div className="glass-card" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '24px' }}>
         <ShieldCheck size={48} color="#10b981" style={{ opacity: 0.4 }} />
         <div>
            <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>SOVEREIGN NETWORK ACTIVE</h4>
            <p style={{ opacity: 0.5, fontSize: '0.85rem' }}>Your local node is listening on port 51236. All research stays private to your hardware unless explicitly shared.</p>
         </div>
         <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <span className="badge badge-success">PEER STATUS</span>
            <p style={{ marginTop: '8px', fontSize: '1rem', fontWeight: 700 }}>{natStatus || 'P2P STANDBY'}</p>
         </div>
      </div>
    </div>
  );
};

export default SettingsUI;
