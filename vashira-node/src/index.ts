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

// API: List mastery items
app.get('/api/items', (req, res) => {
  res.json(getItems());
});

// API: Search mastery
app.get('/api/search', (req, res) => {
  const q = (req.query.q as string || '').toLowerCase();
  const items = getItems().filter(i => 
    i.title.toLowerCase().includes(q) || 
    i.authors?.toLowerCase().includes(q) || 
    i.abstract?.toLowerCase().includes(q)
  );
  res.json(items);
});

// Web View: Remote Mastery Dashboard
app.get('/', (req, res) => {
  const items = getItems();
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Vashira Remote Mastery</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        body { background: #0f172a; color: #f8fafc; font-family: 'Inter', sans-serif; }
        .card { background: #1e293b; border: 1px solid #334155; color: #f8fafc; margin-bottom: 20px; transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); border-color: #a78bfa; }
        .badge { background: #a78bfa; color: #1e1b4b; }
        .header { background: linear-gradient(135deg, #4c1d95 0%, #1e1b4b 100%); padding: 40px 20px; border-bottom: 2px solid #a78bfa; margin-bottom: 40px; }
      </style>
    </head>
    <body>
      <div class="header text-center">
        <h1 class="display-4 fw-bold">Vashira Remote Hub</h1>
        <p class="lead">Sovereign Knowledge Access • ${items.length} Masteries</p>
      </div>
      <div class="container">
        <div class="row">
          ${items.map(item => `
            <div class="col-md-6">
              <div class="card h-100 p-4">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge mb-2">${item.itemType}</span>
                  <small class="text-secondary">${new Date(item.dateAdded).toLocaleDateString()}</small>
                </div>
                <h5 class="card-title fw-bold">${item.title}</h5>
                <p class="card-text text-secondary small">${item.authors || 'Unknown Creator'}</p>
                <div class="mt-auto">
                   <a href="https://doi.org/${item.doi}" target="_blank" class="btn btn-sm btn-outline-info" ${!item.doi ? 'style="display:none"' : ''}>View DOI</a>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`--- Vashira Cloud Gateway LIVE at http://localhost:${PORT} ---`);
  console.log('--- Sovereign Access Mastery ACTIVE ---');
});
