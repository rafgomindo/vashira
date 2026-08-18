const Database = require('better-sqlite3');
import path from 'path';
import fs from 'fs';
let db: any;

/**
 * Resolved Database Path
 * In Electron: app.getPath('userData')
 * In Headless: VASHIRA_PATH env or current directory
 */
function resolveDbPath() {
  try {
    const { app } = require('electron');
    if (app && app.isReady()) {
      return path.join(app.getPath('userData'), 'vashira.db');
    }
  } catch (e) {
    // Electron not available
  }
  
  const base = process.env.VASHIRA_HUB_PATH || process.cwd();
  return path.join(base, 'vashira.db');
}

export function initDatabase() {
  const dbPath = resolveDbPath();
  db = new Database(dbPath);
  
  // Create tables based on Zotero's core logic: Items, Creators, Collections
  db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      itemType TEXT,
      dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
      authors TEXT,
      published TEXT,
      abstract TEXT,
      url TEXT,
      doi TEXT,
      filePath TEXT,
      extra TEXT,
      tags TEXT,
      masteryStatus TEXT DEFAULT 'none'
    );

    CREATE TABLE IF NOT EXISTS creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      firstName TEXT,
      lastName TEXT
    );

    CREATE TABLE IF NOT EXISTS itemCreators (
      itemId INTEGER,
      creatorId INTEGER,
      FOREIGN KEY(itemId) REFERENCES items(id),
      FOREIGN KEY(creatorId) REFERENCES creators(id)
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parentId INTEGER DEFAULT NULL,
      FOREIGN KEY(parentId) REFERENCES collections(id)
    );

    CREATE TABLE IF NOT EXISTS collection_items (
      collectionId INTEGER,
      itemId INTEGER,
      FOREIGN KEY(collectionId) REFERENCES collections(id),
      FOREIGN KEY(itemId) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      targetTable TEXT NOT NULL,
      targetId INTEGER NOT NULL,
      data JSON,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId INTEGER, type TEXT, content TEXT, 
      position TEXT, color TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#a78bfa'
    );

    CREATE TABLE IF NOT EXISTS item_tags (
      itemId INTEGER,
      tagId INTEGER,
      PRIMARY KEY(itemId, tagId),
      FOREIGN KEY(itemId) REFERENCES items(id),
      FOREIGN KEY(tagId) REFERENCES tags(id)
    );

    CREATE TABLE IF NOT EXISTS item_relations (
      itemId INTEGER,
      relatedItemId INTEGER,
      relationType TEXT DEFAULT 'related',
      PRIMARY KEY(itemId, relatedItemId),
      FOREIGN KEY(itemId) REFERENCES items(id),
      FOREIGN KEY(relatedItemId) REFERENCES items(id)
    );

    CREATE TABLE IF NOT EXISTS search_index (
      itemId INTEGER PRIMARY KEY,
      fullText TEXT,
      FOREIGN KEY(itemId) REFERENCES items(id)
    );
    CREATE TABLE IF NOT EXISTS consensus_registry (
      identifier TEXT,
      title TEXT,
      authors TEXT,
      published TEXT,
      voterId TEXT NOT NULL DEFAULT 'unknown',
      lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(identifier, title, authors, voterId)
    );
  `);

  // [VASHIRA 10.1] Consensus Hardening: the old schema had no voterId, so a single
  // peer answering the same request repeatedly could inflate "votes" indefinitely.
  // Rebuild onto a per-voter primary key so a candidate's strength is distinct
  // peers, not exchanges answered. Old tallies aren't trustworthy under the new
  // meaning, so this is a clean rebuild rather than a data-preserving migration.
  const consensusColumns = db.prepare("PRAGMA table_info(consensus_registry)").all();
  if (!consensusColumns.some((c: any) => c.name === 'voterId')) {
    db.exec(`DROP TABLE consensus_registry;`);
    db.exec(`
      CREATE TABLE consensus_registry (
        identifier TEXT,
        title TEXT,
        authors TEXT,
        published TEXT,
        voterId TEXT NOT NULL DEFAULT 'unknown',
        lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(identifier, title, authors, voterId)
      );
    `);
    console.log('[Schema Guard] Migrated consensus_registry to per-peer voting schema.');
  }

  // [VASHIRA 4.0] Sovereign Schema Guard: Proactive Migration
  const columns = db.prepare("PRAGMA table_info(items)").all();
  const columnNames = columns.map((c: any) => c.name);
  
  const requiredColumns = [
    { name: 'authors', type: 'TEXT' },
    { name: 'published', type: 'TEXT' },
    { name: 'abstract', type: 'TEXT' },
    { name: 'url', type: 'TEXT' },
    { name: 'doi', type: 'TEXT' },
    { name: 'filePath', type: 'TEXT' },
    { name: 'extra', type: 'TEXT' },
    { name: 'tags', type: 'TEXT' },
    { name: 'snapshotPath', type: 'TEXT' },
    { name: 'fileHash', type: 'TEXT' },
    { name: 'publisher', type: 'TEXT' },
    { name: 'pages', type: 'INTEGER' },
    { name: 'isbn', type: 'TEXT' },
    { name: 'journal', type: 'TEXT' },
    { name: 'volume', type: 'TEXT' },
    { name: 'issue', type: 'TEXT' },
    { name: 'edition', type: 'TEXT' },
    { name: 'masteryStatus', type: 'TEXT' }
  ];

  requiredColumns.forEach(col => {
    if (!columnNames.includes(col.name)) {
      try {
        db.exec(`ALTER TABLE items ADD COLUMN ${col.name} ${col.type};`);
        console.log(`[Schema Guard] Injected missing column: ${col.name}`);
      } catch (e) {
        console.error(`[Schema Guard] Failed to inject ${col.name}:`, e);
      }
    }
  });

  console.log('Vashira Database initialized at:', dbPath);
  
  // Create Storage Directory
  const storagePath = getStoragePath();
  if (!fs.existsSync(storagePath)) {
    fs.mkdirSync(storagePath, { recursive: true });
  }

  return db;
}

export function getStoragePath() {
  try {
    const { app } = require('electron');
    if (app && app.isReady()) {
      return path.join(app.getPath('userData'), 'vashira_storage');
    }
  } catch (e) {
    // Electron not available
  }

  const base = process.env.VASHIRA_HUB_PATH || process.cwd();
  return path.join(base, 'vashira_storage');
}

export function getItems() {
  return db.prepare('SELECT * FROM items ORDER BY dateAdded DESC').all();
}

/**
 * Collections Logic
 */
export function getCollections() {
  return db.prepare('SELECT * FROM collections').all();
}

export function createCollection(name: string, parentId: number | null = null) {
  const info = db.prepare('INSERT INTO collections (name, parentId) VALUES (?, ?)').run(name, parentId);
  return info.lastInsertRowid;
}

export function addItemToCollection(itemId: number, collectionId: number) {
  return db.prepare('INSERT INTO collection_items (itemId, collectionId) VALUES (?, ?)').run(itemId, collectionId);
}

export function getItemsByCollection(collectionId: number) {
  return db.prepare(`
    SELECT items.* FROM items 
    JOIN collection_items ON items.id = collection_items.itemId
    WHERE collection_items.collectionId = ?
    ORDER BY items.dateAdded DESC
  `).all(collectionId);
}

/**
 * Sync & Core Actions
 */
function logSync(action: string, targetTable: string, targetId: number, data: any = null) {
  db.prepare('INSERT INTO sync_log (action, targetTable, targetId, data) VALUES (?, ?, ?, ?)').run(
    action, targetTable, targetId, JSON.stringify(data)
  );
}

export function addItem(item: any) {
  const info = db.prepare(`
    INSERT INTO items (title, itemType, doi, authors, published, abstract, url, filePath, snapshotPath, fileHash, publisher, pages, extra, isbn, journal, volume, issue, edition) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.title, 
    item.itemType, 
    item.doi || '', 
    item.authors || '', 
    item.published || '', 
    item.abstract || '', 
    item.url || '', 
    item.filePath || '',
    item.snapshotPath || '',
    item.fileHash || '',
    item.publisher || '',
    item.pages || 0,
    item.extra || '',
    item.isbn || '',
    item.journal || '',
    item.volume || '',
    item.issue || '',
    item.edition || ''
  );
  
  const itemId = info.lastInsertRowid;
  logSync('CREATE', 'items', itemId as number, item);
  return itemId;
}

export const getAnnotations = (itemId: number) => {
  return db.prepare('SELECT * FROM annotations WHERE itemId = ?').all(itemId);
};

export const addAnnotation = (itemId: number, type: string, content: string, position: string, color: string) => {
  const info = db.prepare('INSERT INTO annotations (itemId, type, content, position, color) VALUES (?, ?, ?, ?, ?)').run(itemId, type, content, position, color);
  return info.lastInsertRowid;
};

export function getNotes(itemId: number) {
  return db.prepare('SELECT * FROM notes WHERE itemId = ?').all(itemId);
}

export const addFullText = (itemId: number, text: string) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO search_index (itemId, fullText) VALUES (?, ?)');
  stmt.run(itemId, text);
};

export const searchDeep = (query: string): any[] => {
  const stmt = db.prepare(`
    SELECT i.*, s.fullText AS content FROM items i
    JOIN search_index s ON i.id = s.itemId
    WHERE s.fullText LIKE ? OR i.title LIKE ?
  `);
  return stmt.all(`%${query}%`, `%${query}%`);
};

export function addNote(itemId: number, content: string) {
  const info = db.prepare('INSERT INTO notes (itemId, content) VALUES (?, ?)').run(itemId, content);
  const noteId = info.lastInsertRowid;
  logSync('CREATE', 'notes', noteId as number, { itemId, content });
  return noteId;
}

export function getItemById(id: number) {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id);
}

export function getSyncLog() {
  return db.prepare('SELECT * FROM sync_log ORDER BY timestamp DESC LIMIT 50').all();
}

export function getSyncCount() {
  const result = db.prepare('SELECT COUNT(*) as count FROM sync_log').get();
  return result.count;
}

/**
 * Zotero Mastery: Tags & Smart Collections
 */
export function getAllTags() {
  return db.prepare('SELECT * FROM tags').all();
}

export function addTag(name: string) {
  try {
    const info = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
    return info.lastInsertRowid;
  } catch (e) {
    return db.prepare('SELECT id FROM tags WHERE name = ?').get(name).id;
  }
}

export function addTagToItem(itemId: number, tagId: number) {
  return db.prepare('INSERT OR IGNORE INTO item_tags (itemId, tagId) VALUES (?, ?)').run(itemId, tagId);
}

export function removeTagFromItem(itemId: number, tagId: number) {
  return db.prepare('DELETE FROM item_tags WHERE itemId = ? AND tagId = ?').run(itemId, tagId);
}

export function getTagsForItem(itemId: number) {
  return db.prepare(`
    SELECT tags.* FROM tags
    JOIN item_tags ON tags.id = item_tags.tagId
    WHERE item_tags.itemId = ?
  `).all(itemId);
}

export function getItemsByCategory(category: 'unfiled' | 'recent' | 'trash') {
  if (category === 'recent') {
    return db.prepare('SELECT * FROM items ORDER BY dateAdded DESC LIMIT 50').all();
  }
  if (category === 'unfiled') {
    return db.prepare(`
      SELECT * FROM items 
      WHERE id NOT IN (SELECT itemId FROM collection_items)
      ORDER BY dateAdded DESC
    `).all();
  }
  return [];
}

export function getItemsByTag(tagId: number) {
  return db.prepare(`
    SELECT items.* FROM items
    JOIN item_tags ON items.id = item_tags.itemId
    WHERE item_tags.tagId = ?
    ORDER BY items.dateAdded DESC
  `).all(tagId);
}
export function upsertConsensus(identifier: string, metadata: any, voterId: string) {
    return db.prepare(`
      INSERT INTO consensus_registry (identifier, title, authors, published, voterId)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(identifier, title, authors, voterId) DO UPDATE SET
        lastSeen = CURRENT_TIMESTAMP
    `).run(identifier, metadata.title, metadata.authors, metadata.published, voterId);
}

export function getConsensus(identifier: string) {
    // A candidate only counts as "consensus" once 2+ distinct peers have supplied
    // it — a single source (however many times it's been asked) isn't consensus.
    return db.prepare(`
        SELECT title, authors, published, COUNT(DISTINCT voterId) as votes, MAX(lastSeen) as lastSeen
        FROM consensus_registry
        WHERE identifier = ?
        GROUP BY title, authors, published
        HAVING votes >= 2
        ORDER BY votes DESC
        LIMIT 3
    `).all(identifier);
}

export function updateItem(id: number, fields: any) {
  // Omit ID and other non-updatable fields
  const { id: _, dateAdded: __, ...updatableFields } = fields;
  const keys = Object.keys(updatableFields);
  if (keys.length === 0) return null;
  
  const assignments = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => updatableFields[k]);
  return db.prepare(`UPDATE items SET ${assignments} WHERE id = ?`).run(...values, id);
}
