import { EventEmitter } from 'node:events';
import dgram from 'node:dgram';

/**
 * Sovereign Discovery 4.0
 * 
 * PROTOCOL:
 * 1. DISCOVERY: Node broadcasts 'VASHIRA_HUB_ALIVE' to find peers.
 * 2. SYNC: Node broadcasts 'MASTERY_ANNOUNCE' when adding new items.
 * 3. RETRIEVAL: Nodes communicate via direct UDP Unicast for specific metadata.
 */
class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket;
  private PORT = 41234;
  private BROADCAST_ADDR = '255.255.255.255';
  private peers: Set<string> = new Set(['Local Hub']);
  private discoveries: any[] = [];
  private nodeId = `node-\${Math.random().toString(36).substring(7)}`;

  constructor() {
    super();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.nodeId === this.nodeId) return; // Skip self

        if (data.type === 'HEARTBEAT') {
          this.peers.add(`MasterNode@\${rinfo.address}`);
        } else if (data.type === 'MASTERY_ANNOUNCE') {
          console.log(`[P2P] Insight from \${rinfo.address}: \${data.title}`);
          const newDiscovery = { 
            doi: data.doi, 
            title: data.title, 
            peer: rinfo.address,
            timestamp: new Date().toISOString()
          };
          this.discoveries.unshift(newDiscovery);
          if (this.discoveries.length > 50) this.discoveries.pop();
          this.peers.add(`MasterNode@\${rinfo.address}`);
        } else if (data.type === 'REQUEST_METADATA') {
          this.emit('metadata-request', { doi: data.doi, peer: rinfo.address });
        } else if (data.type === 'RESPONSE_METADATA') {
          this.emit('metadata-response', data.metadata);
        }
      } catch (e) { /* Non-Vashira traffic */ }
    });

    this.socket.bind(this.PORT, () => {
      this.socket.setBroadcast(true);
      console.log(`[Vashira 4.0] Sovereign Discovery Online on port \${this.PORT}`);
      this.broadcastHeartbeat();
      setInterval(() => this.broadcastHeartbeat(), 30000);
    });
  }

  private broadcastHeartbeat() {
    const msg = JSON.stringify({ type: 'HEARTBEAT', nodeId: this.nodeId });
    this.socket.send(msg, 0, msg.length, this.PORT, this.BROADCAST_ADDR);
  }

  public getOnlinePeers() { return Array.from(this.peers); }
  public getLocalDiscoveries() { return this.discoveries; }

  public announceMetadata(doi: string, title: string) {
    const message = JSON.stringify({
      type: 'MASTERY_ANNOUNCE',
      nodeId: this.nodeId,
      doi,
      title
    });
    this.socket.send(message, 0, message.length, this.PORT, this.BROADCAST_ADDR);
  }

  public requestMetadata(doi: string, peerIp: string) {
    const message = JSON.stringify({ type: 'REQUEST_METADATA', nodeId: this.nodeId, doi });
    this.socket.send(message, 0, message.length, this.PORT, peerIp);
  }

  public sendMetadata(metadata: any, peerIp: string) {
    const message = JSON.stringify({ type: 'RESPONSE_METADATA', nodeId: this.nodeId, metadata });
    this.socket.send(message, 0, message.length, this.PORT, peerIp);
  }
}

export const discoveryEngine = new PeerDiscovery();
