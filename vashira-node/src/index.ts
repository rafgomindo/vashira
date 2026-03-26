import { initDatabase, getItems } from '../../vashira-app/src/database';
import { discoveryEngine } from '../../vashira-app/src/discovery';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

/**
 * Vashira Headless Node v4.0.0
 * The Sovereign Hub for NAS and Community Deployments.
 */

const PORT = process.env.VASHIRA_HUB_PORT || 3000;
const app = express();

// Initialize the Sovereign Mastery Database
// Note: database.ts was refactored to use process.cwd() or VASHIRA_HUB_PATH if Electron is missing.
initDatabase();

// Headless Hub Status API
app.get('/', (req, res) => {
  const items = getItems();
  res.json({
    status: 'ONLINE',
    system: 'Vashira Headless Node',
    version: '4.0.0',
    masteryCount: items.length,
    peers: discoveryEngine.getOnlinePeers()
  });
});

// Start the P2P Sovereign Discovery
console.log('--- Vashira Sovereign Hub Starting ---');
console.log('ID: [SOVEREIGN_NODE_4.0]');

// Periodically announce the most recent Mastery items to the network
setInterval(() => {
  const items = getItems();
  if (items.length > 0) {
    const latest = items[0];
    console.log(`[P2P] Announcing Mastery over: ${latest.title}`);
    discoveryEngine.announceMetadata(latest.doi || 'SOVEREIGN_IDENTITY', latest.title);
  }
}, 30000); // Every 30 seconds

app.listen(PORT, () => {
  console.log(`--- Hub Status API live at http://localhost:${PORT} ---`);
  console.log('--- Peer-to-Peer Discovery ACTIVE (Port 41234) ---');
});
