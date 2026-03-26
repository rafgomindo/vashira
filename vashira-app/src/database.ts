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
      tags TEXT
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
      itemId INTEGER,
      content TEXT NOT NULL,
      dateAdded DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(itemId) REFERENCES items(id)
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
  `);

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
    { name: 'snapshotPath', type: 'TEXT' }
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

  // [VASHIRA 4.0] Seed Welcome Data
  const itemCheck = db.prepare('SELECT COUNT(*) as count FROM items').get();
  if (itemCheck && itemCheck.count === 0) {
    db.prepare('INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?)').run('Mastery', '#a78bfa');
    const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get('Mastery');
    const welcomeTagId = tag?.id;

    const itemId = db.prepare(`
      INSERT INTO items (title, itemType, authors, published, abstract, extra)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'Vashira Sovereign Mastery: A New Era of Research',
      'journalArticle',
      'Rafael Domingo Ramones',
      '2024',
      'This is your first sovereign research item. Explore tags, collections, and P2P sync.',
      'Welcome to Vashira 4.0'
    ).lastInsertRowid;

    if (welcomeTagId) {
        db.prepare('INSERT OR IGNORE INTO item_tags (itemId, tagId) VALUES (?, ?)').run(itemId, welcomeTagId);
    }
  }
  
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
    INSERT INTO items (title, itemType, doi, authors, published, abstract, url, filePath, snapshotPath, extra) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    item.extra || ''
  );
  
  const itemId = info.lastInsertRowid;
  logSync('CREATE', 'items', itemId as number, item);
  return itemId;
}

export function getNotes(itemId: number) {
  return db.prepare('SELECT * FROM notes WHERE itemId = ?').all(itemId);
}

export const addFullText = (itemId: number, text: string) => {
  const stmt = db.prepare('INSERT OR REPLACE INTO search_index (itemId, content) VALUES (?, ?)');
  stmt.run(itemId, text);
};

export const searchDeep = (query: string): any[] => {
  const stmt = db.prepare(`
    SELECT i.* FROM items i
    JOIN search_index s ON i.id = s.itemId
    WHERE s.content LIKE ? OR i.title LIKE ?
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

export function updateItem(id: number, fields: any) {
  const keys = Object.keys(fields);
  const assignments = keys.map(k => `\${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  return db.prepare(`UPDATE items SET \${assignments} WHERE id = ?`).run(...values, id);
}
