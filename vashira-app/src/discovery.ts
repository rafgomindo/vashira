import { EventEmitter } from 'events';
import dgram from 'dgram';

/**
 * Vashira P2P Mastery Discovery v2.0 (REAL UDP BROADCAST)
 * This is production-grade local network peer discovery.
 */
class PeerDiscovery extends EventEmitter {
  private socket: dgram.Socket;
  private PORT = 41234;
  private BROADCAST_ADDR = '255.255.255.255';
  private peers: Set<string> = new Set(['Self (Master Rafael)']);
  private discoveries: any[] = [];

  constructor() {
    super();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this.socket.on('message', (msg, rinfo) => {
      try {
        const data = JSON.parse(msg.toString());
        if (data.type === 'ANNOUNCE_MASTERY') {
          console.log(`[P2P] Received mastery from ${rinfo.address}: ${data.title}`);
          const newDiscovery = { 
            doi: data.doi, 
            title: data.title, 
            peer: `Node ${rinfo.address.split('.').pop()}` 
          };
          this.discoveries.push(newDiscovery);
          this.peers.add(`Master ${rinfo.address}`);
          this.emit('discovery', newDiscovery);
        }
      } catch (e) {
        // Ignore non-Vashira traffic
      }
    });

    this.socket.on('error', (err) => {
      console.error(`[P2P] Socket error: ${err.stack}`);
      this.socket.close();
    });

    this.socket.bind(this.PORT, () => {
      this.socket.setBroadcast(true);
      console.log(`[P2P Hub 2.0] Listening for local masters on port ${this.PORT}`);
    });
  }

  public getOnlinePeers() {
    return Array.from(this.peers);
  }

  public getLocalDiscoveries() {
    return this.discoveries;
  }

  public announceMetadata(doi: string, title: string) {
    const message = JSON.stringify({
      type: 'ANNOUNCE_MASTERY',
      doi,
      title,
      timestamp: Date.now()
    });

    this.socket.send(message, 0, message.length, this.PORT, this.BROADCAST_ADDR, (err) => {
      if (err) console.error(`[P2P] Broadcast failed: ${err}`);
      else console.log(`[P2P] Mastery over ${doi} broadcasted successfully.`);
    });
  }
}

export const discoveryEngine = new PeerDiscovery();
