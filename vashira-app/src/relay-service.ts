import axios from 'axios';

/**
 * Vashira Community Relay Service
 * Handles registration and discovery of peers across the WAN.
 */
export class CommunityRelay {
  private relayUrl: string;
  private nodeId: string;
  private checkInInterval: any;

  constructor(nodeId: string, relayUrl: string = 'https://peers.vashira.io/v1') {
    this.nodeId = nodeId;
    this.relayUrl = relayUrl;
  }

  /**
   * Register this node with the global relay.
   * Sending minimal data: NodeID. The relay detects Public IP from the request.
   */
  async checkIn() {
    try {
      await axios.post(`${this.relayUrl}/checkin`, {
        nodeId: this.nodeId,
        timestamp: new Date().toISOString()
      }, { timeout: 5000 });
      // console.log('[Relay] Check-in successful.');
    } catch (e) {
      console.error('[Relay] Check-in failed. Are you offline?', e);
    }
  }

  /**
   * Fetch active peers from the relay.
   */
  async getGlobalPeers(): Promise<string[]> {
    try {
      const resp = await axios.get(`${this.relayUrl}/peers`, { timeout: 5000 });
      return resp.data.peers || []; // Expecting list of IPs like ["1.2.3.4", "5.6.7.8"]
    } catch (e) {
      console.error('[Relay] Failed to fetch global peers.');
      return [];
    }
  }

  startAutoCheckIn() {
    this.checkIn();
    this.checkInInterval = setInterval(() => this.checkIn(), 60000 * 5); // Every 5 mins
  }

  stop() {
    if (this.checkInInterval) clearInterval(this.checkInInterval);
  }
}
