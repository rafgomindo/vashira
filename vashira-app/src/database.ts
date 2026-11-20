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
      masteryStatus TEXT DEFAULT 'none',
      textIndexVersion INTEGER,
      deletedAt DATETIME
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

    -- [VASHIRA 10.3] Pairs the user marked "not duplicates" (itemA < itemB).
    CREATE TABLE IF NOT EXISTS not_duplicates (
      itemA INTEGER NOT NULL,
      itemB INTEGER NOT NULL,
      PRIMARY KEY(itemA, itemB)
    );

    CREATE TABLE IF NOT EXISTS search_index (
      itemId INTEGER PRIMARY KEY,
      fullText TEXT,
      FOREIGN KEY(itemId) REFERENCES items(id)
    );
    -- [VASHIRA 10.2] Real per-page text (pdf.js), ranked with bm25. remove_diacritics
    -- makes "necropolitica" match "Necropolítica" — the library is multilingual.
    CREATE VIRTUAL TABLE IF NOT EXISTS page_text USING fts5(
      text,
      itemId UNINDEXED,
      page UNINDEXED,
      tokenize = 'unicode61 remove_diacritics 2'
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
    { name: 'masteryStatus', type: 'TEXT' },
    { name: 'textIndexVersion', type: 'INTEGER' },
    { name: 'deletedAt', type: 'DATETIME' }
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

// Every library listing hides trashed items; only the Trash view shows them.
export function getItems() {
  return db.prepare('SELECT * FROM items WHERE deletedAt IS NULL ORDER BY dateAdded DESC').all();
}

/**
 * Trash (v10.2): soft delete first, so nothing is lost by a misclick and merges
 * (Phase 1) can be undone. Emptying the trash purges every row that hangs off
 * the item; the caller removes the stored files it returns.
 */
export function trashItem(id: number) {
  db.prepare('UPDATE items SET deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  logSync('TRASH', 'items', id);
}

export function restoreItem(id: number) {
  db.prepare('UPDATE items SET deletedAt = NULL WHERE id = ?').run(id);
  logSync('RESTORE', 'items', id);
}

export function getTrashedItems() {
  return db.prepare('SELECT * FROM items WHERE deletedAt IS NOT NULL ORDER BY deletedAt DESC').all();
}

/** True if any item (trashed or not) still points at this file. */
export function isFileReferenced(filePath: string) {
  return !!db.prepare('SELECT 1 FROM items WHERE filePath = ? OR snapshotPath = ? LIMIT 1').get(filePath, filePath);
}

/** Permanently deletes trashed items (all of them, or just `ids`). Returns their file paths for cleanup. */
export function purgeTrashedItems(ids?: number[]): string[] {
  const trashed: any[] = getTrashedItems().filter((i: any) => !ids || ids.includes(i.id));
  const files: string[] = [];
  const purge = db.transaction((items: any[]) => {
    for (const item of items) {
      const id = item.id;
      db.prepare('DELETE FROM item_tags WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM collection_items WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM notes WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM annotations WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM item_relations WHERE itemId = ? OR relatedItemId = ?').run(id, id);
      db.prepare('DELETE FROM itemCreators WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM search_index WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM page_text WHERE itemId = ?').run(id);
      db.prepare('DELETE FROM items WHERE id = ?').run(id);
      logSync('PURGE', 'items', id, { title: item.title });
      if (item.filePath) files.push(item.filePath);
      if (item.snapshotPath) files.push(item.snapshotPath);
    }
  });
  purge(trashed);
  return files;
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
    WHERE collection_items.collectionId = ? AND items.deletedAt IS NULL
    ORDER BY items.dateAdded DESC
  `).all(collectionId);
}

/**
 * Sync & Core Actions
 */
/** The shared connection, for feature modules (e.g. duplicates.ts) that need transactions across tables. */
export function getDb() {
  return db;
}

export function logSync(action: string, targetTable: string, targetId: number, data: any = null) {
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

/** Replaces an item's per-page text in the FTS index (pages[0] is page 1). */
export function setPageText(itemId: number, pages: string[]) {
  const write = db.transaction(() => {
    db.prepare('DELETE FROM page_text WHERE itemId = ?').run(itemId);
    const insert = db.prepare('INSERT INTO page_text (text, itemId, page) VALUES (?, ?, ?)');
    pages.forEach((text, i) => { if (text.trim()) insert.run(text, itemId, i + 1); });
  });
  write();
}

/** PDFs whose text was never extracted with the current extractor version. */
export function getItemsNeedingTextIndex(version: number) {
  return db.prepare(`
    SELECT * FROM items
    WHERE deletedAt IS NULL AND filePath LIKE '%.pdf'
      AND (textIndexVersion IS NULL OR textIndexVersion < ?)
    ORDER BY dateAdded DESC
  `).all(version);
}

/**
 * User text → safe FTS5 query: every word must appear (implicit AND), the last
 * one as a prefix so results show up while typing. Quoting each token keeps
 * FTS5 syntax characters in user input from throwing.
 */
function toFtsQuery(query: string): string | null {
  const tokens = (query.match(/[\p{L}\p{N}]+/gu) || []).slice(0, 12);
  if (tokens.length === 0) return null;
  return tokens.map((t, i) => `"${t}"${i === tokens.length - 1 ? '*' : ''}`).join(' ');
}

/** Ranked full-text hits grouped per item: [{ itemId, hits: [{ page, snippet }] }], best first. */
export function searchFullText(query: string, limit = 50) {
  const fts = toFtsQuery(query);
  if (!fts) return [];
  const rows = db.prepare(`
    SELECT p.itemId AS itemId, p.page AS page,
           snippet(page_text, 0, '«', '»', '…', 14) AS snippet
    FROM page_text p
    JOIN items i ON i.id = p.itemId
    WHERE page_text MATCH ? AND i.deletedAt IS NULL
    ORDER BY bm25(page_text)
    LIMIT 500
  `).all(fts);

  const byItem = new Map<number, { itemId: number; hits: { page: number; snippet: string }[] }>();
  for (const r of rows as any[]) {
    let entry = byItem.get(r.itemId);
    if (!entry) {
      if (byItem.size >= limit) continue;
      entry = { itemId: r.itemId, hits: [] };
      byItem.set(r.itemId, entry);
    }
    if (entry.hits.length < 5) entry.hits.push({ page: r.page, snippet: r.snippet });
  }
  return Array.from(byItem.values());
}

/**
 * Items matching `query` with their most relevant page text as `content` —
 * the retrieval step for the Oracle. Full-text hits first, then title-only matches.
 */
export const searchDeep = (query: string): any[] => {
  const results: any[] = [];
  const seen = new Set<number>();
  const pageStmt = db.prepare('SELECT text FROM page_text WHERE itemId = ? AND page = ?');

  for (const { itemId, hits } of searchFullText(query, 10)) {
    const item = getItemById(itemId);
    if (!item) continue;
    const content = hits.slice(0, 2)
      .map(h => `[p. ${h.page}] ${(pageStmt.get(itemId, h.page) as any)?.text || ''}`)
      .join('\n\n');
    results.push({ ...item, content, pages: hits.map(h => h.page) });
    seen.add(itemId);
  }

  const titleMatches = db.prepare(`
    SELECT i.*, s.fullText AS content FROM items i
    LEFT JOIN search_index s ON i.id = s.itemId
    WHERE i.deletedAt IS NULL AND i.title LIKE ?
    LIMIT 10
  `).all(`%${query}%`);
  for (const item of titleMatches as any[]) {
    if (!seen.has(item.id)) results.push(item);
  }
  return results;
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
    return db.prepare('SELECT * FROM items WHERE deletedAt IS NULL ORDER BY dateAdded DESC LIMIT 50').all();
  }
  if (category === 'unfiled') {
    return db.prepare(`
      SELECT * FROM items
      WHERE deletedAt IS NULL AND id NOT IN (SELECT itemId FROM collection_items)
      ORDER BY dateAdded DESC
    `).all();
  }
  if (category === 'trash') {
    return getTrashedItems();
  }
  return [];
}

export function getItemsByTag(tagId: number) {
  return db.prepare(`
    SELECT items.* FROM items
    JOIN item_tags ON items.id = item_tags.itemId
    WHERE item_tags.tagId = ? AND items.deletedAt IS NULL
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
