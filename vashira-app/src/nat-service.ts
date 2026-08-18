import natUpnp from 'nat-upnp';

/**
 * Vashira NAT Traversal Service
 * Automates port forwarding via UPnP.
 */
export class NatService {
  private client: any;
  private ports = [
    { port: 51235, protocol: 'TCP', description: 'Vashira Hub API' },
    { port: 51235, protocol: 'UDP', description: 'Vashira Hub Sync' },
    { port: 41234, protocol: 'UDP', description: 'Vashira Discovery' }
  ];

  constructor() {
    this.client = natUpnp.createClient();
  }

  /**
   * Request port mapping from the router.
   */
  async mapPorts(): Promise<boolean> {
    console.log('[NAT] Attempting to map ports via UPnP...');
    try {
      const results = await Promise.all(this.ports.map(p => {
        return new Promise((resolve, reject) => {
          this.client.portMapping({
            public: p.port,
            private: p.port,
            ttl: 0, // Infinite mapping (or until app closes)
            protocol: p.protocol,
            description: p.description
          }, (err: any) => {
            if (err) {
              console.warn(`[NAT] Failed to map ${p.protocol} ${p.port}:`, err.message);
              resolve(false);
            } else {
              console.log(`[NAT] Mapped ${p.protocol} ${p.port} successfully.`);
              resolve(true);
            }
          });
        });
      }));

      return results.every(r => r === true);
    } catch (e) {
      console.error('[NAT] Critical error during UPnP mapping:', e);
      return false;
    }
  }

  /**
   * Remove port mapping from the router.
   */
  async unmapPorts() {
    console.log('[NAT] Clearing port mappings...');
    for (const p of this.ports) {
      try {
        await new Promise((resolve) => {
          this.client.portUnmapping({
            public: p.port,
            protocol: p.protocol
          }, resolve);
        });
      } catch (e) { /* Ignore unmapping errors */ }
    }
  }

  /**
   * Get the public IP (Useful for debugging)
   */
  async getExternalIp(): Promise<string | null> {
    return new Promise((resolve) => {
      this.client.externalIp((err: any, ip: string) => {
        if (err) resolve(null);
        else resolve(ip);
      });
    });
  }
}
