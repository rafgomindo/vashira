import React, { useEffect, useState } from 'react';
import { Share2, RefreshCw, Radio, Download, Check } from 'lucide-react';

interface SharedVaultProps {
  items: any[];
  onShowToast: (msg: string, type?: 'success' | 'alert') => void;
  onItemImported: () => void;
}

const SharedVault: React.FC<SharedVaultProps> = ({ items, onShowToast, onItemImported }) => {
  const [peers, setPeers] = useState<string[]>([]);
  const [discoveries, setDiscoveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingKey, setImportingKey] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [p, d] = await Promise.all([
        (window as any).vashiraAPI.getPeers(),
        (window as any).vashiraAPI.getDiscoveries()
      ]);
      setPeers(p || []);
      setDiscoveries(d || []);
    } catch (e) {
      console.error('Failed to load Shared Vault:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  const alreadyOwned = (d: any) => items.some(i => (d.doi && i.doi === d.doi) || (d.doi && i.fileHash === d.doi));

  const handleImport = async (d: any) => {
    const key = `${d.doi}@${d.peer}`;
    setImportingKey(key);
    try {
      const result = await (window as any).vashiraAPI.importFromPeer(d.doi, d.peer);
      if (result.success) {
        onShowToast(result.alreadyOwned ? 'Already in your library.' : `Mastered from peer: ${result.item.title}`);
        onItemImported();
      } else {
        onShowToast(result.error || 'Peer import failed.', 'alert');
      }
    } catch (e: any) {
      onShowToast(e.message || 'Peer import failed.', 'alert');
    } finally {
      setImportingKey(null);
    }
  };

  return (
    <div className="main-view fade-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2 className="view-title">Shared Vault</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
            Peers and the metadata they've mastered — titles, authors, DOIs. No files ever cross the network.
          </p>
        </div>
        <button className="btn-secondary" onClick={refresh}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 2s linear infinite' : 'none' }} />
        </button>
      </header>

      <div data-tour="peers-list" className="glass-card scale-up" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Share2 size={22} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>ONLINE PEERS ({peers.length})</h3>
        </div>
        {peers.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No peers detected yet. Peers appear as they broadcast on your LAN or Global Mesh.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {peers.map((p, i) => (
              <span key={i} className="badge badge-success">{p}</span>
            ))}
          </div>
        )}
      </div>

      <div data-tour="discoveries" className="glass-card scale-up" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <Radio size={22} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>RECENT DISCOVERIES</h3>
        </div>
        {discoveries.length === 0 ? (
          <p style={{ opacity: 0.5, fontSize: '0.9rem' }}>No mastery announcements received yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {discoveries.map((d, i) => {
              const owned = alreadyOwned(d);
              const key = `${d.doi}@${d.peer}`;
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px' }}>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.title || 'Untitled'}</p>
                    <p style={{ opacity: 0.5, fontSize: '0.75rem' }}>via {d.peer} &bull; {new Date(d.timestamp).toLocaleTimeString()}</p>
                  </div>
                  {owned ? (
                    <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={12} /> OWNED</span>
                  ) : (
                    <button
                      className="btn-secondary"
                      style={{ padding: '8px 14px', fontSize: '0.75rem', flexShrink: 0 }}
                      disabled={!d.doi || importingKey === key}
                      onClick={() => handleImport(d)}
                    >
                      <Download size={14} /> {importingKey === key ? 'FETCHING...' : 'IMPORT METADATA'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedVault;
