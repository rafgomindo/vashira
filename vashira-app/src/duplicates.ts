import { getDb, logSync } from './database';

/**
 * Duplicate detection & merging (v10.3).
 *
 * Exact duplicates share a DOI, an ISBN or a file fingerprint (fileHash).
 * Likely duplicates have near-identical titles (trigram Dice ≥ 0.9) AND the same
 * year or the same first-author surname. Merging moves everything attached to
 * the losing records onto the master, trashes the losers, and writes a MERGE
 * snapshot to sync_log so the merge can be undone.
 */

// ---------- normalization ----------

export function normalizeDoi(doi?: string | null): string {
  if (!doi) return '';
  return doi.trim().toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, '')
    .replace(/^doi:\s*/, '');
}

/** ISBN-10 or ISBN-13 → ISBN-13 digits ('' if not a valid-looking ISBN). */
export function normalizeIsbn(isbn?: string | null): string {
  if (!isbn) return '';
  const raw = isbn.toUpperCase().replace(/[^0-9X]/g, '');
  if (raw.length === 13) return raw;
  if (raw.length !== 10) return '';
  const core = '978' + raw.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return core + ((10 - (sum % 10)) % 10);
}

export function normalizeTitle(title?: string | null): string {
  return (title || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function trigrams(s: string): Set<string> {
  const padded = `  ${s} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function dice(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return (2 * common) / (a.size + b.size);
}

function year(published?: string | null): string {
  return (published || '').match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] || '';
}

function firstSurname(authors?: string | null): string {
  const first = (authors || '').split(/;| and |&/)[0].trim();
  if (!first || /extracted content|unknown/i.test(first)) return '';
  // "Mbembe, Achille" → mbembe ; "Achille Mbembe" → mbembe
  const name = first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop() || '';
  return normalizeTitle(name);
}

// ---------- detection ----------

export const LIKELY_THRESHOLD = 0.9;

type Prepared = { item: any; doi: string; isbn: string; hash: string; title: string; tri: Set<string>; year: string; surname: string };

function prepare(item: any): Prepared {
  const title = normalizeTitle(item.title);
  return {
    item,
    doi: normalizeDoi(item.doi),
    isbn: normalizeIsbn(item.isbn),
    hash: (item.fileHash || '').trim(),
    title,
    tri: trigrams(title),
    year: year(item.published),
    surname: firstSurname(item.authors),
  };
}

/** Why two prepared items are duplicates, or null. */
function matchReason(a: Prepared, b: Prepared): { kind: 'exact' | 'likely'; reason: string } | null {
  if (a.doi && a.doi === b.doi) return { kind: 'exact', reason: 'Same DOI' };
  if (a.isbn && a.isbn === b.isbn) return { kind: 'exact', reason: 'Same ISBN' };
  if (a.hash && a.hash === b.hash) return { kind: 'exact', reason: 'Same file' };
  // Two different DOIs/ISBNs are different works, however similar the titles
  // (e.g. a paper and its erratum, or volume 1 and 2 of a book).
  if ((a.doi && b.doi) || (a.isbn && b.isbn)) return null;
  if (a.title.length < 8 || b.title.length < 8) return null;
  const lenRatio = Math.min(a.title.length, b.title.length) / Math.max(a.title.length, b.title.length);
  if (lenRatio < 0.8) return null;
  const sim = dice(a.tri, b.tri);
  if (sim < LIKELY_THRESHOLD) return null;
  const sameYear = !!a.year && a.year === b.year;
  const sameAuthor = !!a.surname && a.surname === b.surname;
  if (!sameYear && !sameAuthor) return null;
  return { kind: 'likely', reason: `Title ${Math.round(sim * 100)}% similar, same ${sameYear ? 'year' : 'first author'}` };
}

function dismissedPairs(): Set<string> {
  const rows = getDb().prepare('SELECT itemA, itemB FROM not_duplicates').all() as any[];
  return new Set(rows.map(r => `${r.itemA}:${r.itemB}`));
}

const pairKey = (x: number, y: number) => (x < y ? `${x}:${y}` : `${y}:${x}`);

export type DuplicateGroup = { key: string; kind: 'exact' | 'likely'; reasons: string[]; items: any[] };

/** All duplicate groups in the (non-trashed) library, exact groups first. */
export function findDuplicateGroups(): DuplicateGroup[] {
  const items = getDb().prepare('SELECT * FROM items WHERE deletedAt IS NULL ORDER BY dateAdded ASC').all() as any[];
  const prepared = items.map(prepare);
  const dismissed = dismissedPairs();

  // Union-find over matching pairs.
  const parent = prepared.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const edges: { a: number; b: number; kind: 'exact' | 'likely'; reason: string }[] = [];

  for (let i = 0; i < prepared.length; i++) {
    for (let j = i + 1; j < prepared.length; j++) {
      if (dismissed.has(pairKey(prepared[i].item.id, prepared[j].item.id))) continue;
      const m = matchReason(prepared[i], prepared[j]);
      if (!m) continue;
      edges.push({ a: i, b: j, ...m });
      parent[find(i)] = find(j);
    }
  }

  const groups = new Map<number, { members: Set<number>; kinds: Set<string>; reasons: Set<string> }>();
  for (const e of edges) {
    const root = find(e.a);
    if (!groups.has(root)) groups.set(root, { members: new Set(), kinds: new Set(), reasons: new Set() });
    const g = groups.get(root)!;
    g.members.add(e.a); g.members.add(e.b); g.kinds.add(e.kind); g.reasons.add(e.reason);
  }

  return Array.from(groups.values())
    .map(g => {
      const groupItems = Array.from(g.members).map(i => prepared[i].item);
      return {
        key: groupItems.map(i => i.id).sort((a, b) => a - b).join('-'),
        // A group is "exact" only if every link in it is exact.
        kind: (g.kinds.has('likely') ? 'likely' : 'exact') as 'exact' | 'likely',
        reasons: Array.from(g.reasons),
        items: groupItems,
      };
    })
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'exact' ? -1 : 1));
}

/** Exact duplicates already in the library for a not-yet-added item (used on import). */
export function findExactDuplicatesFor(candidate: any): any[] {
  const c = prepare(candidate);
  if (!c.doi && !c.isbn && !c.hash) return [];
  const items = getDb().prepare('SELECT * FROM items WHERE deletedAt IS NULL').all() as any[];
  return items.filter(i => {
    if (candidate.id && i.id === candidate.id) return false;
    const m = matchReason(c, prepare(i));
    return m?.kind === 'exact';
  });
}

/** Exact + likely duplicates of an existing item (detail-panel warning). */
export function findDuplicatesOfItem(itemId: number): any[] {
  const db = getDb();
  const target = db.prepare('SELECT * FROM items WHERE id = ?').get(itemId);
  if (!target) return [];
  const t = prepare(target);
  const dismissed = dismissedPairs();
  const items = db.prepare('SELECT * FROM items WHERE deletedAt IS NULL AND id != ?').all(itemId) as any[];
  return items.filter(i => !dismissed.has(pairKey(itemId, i.id)) && matchReason(t, prepare(i)));
}

export function markNotDuplicates(itemIds: number[]) {
  const db = getDb();
  const insert = db.prepare('INSERT OR IGNORE INTO not_duplicates (itemA, itemB) VALUES (?, ?)');
  db.transaction(() => {
    for (let i = 0; i < itemIds.length; i++) {
      for (let j = i + 1; j < itemIds.length; j++) {
        const [a, b] = itemIds[i] < itemIds[j] ? [itemIds[i], itemIds[j]] : [itemIds[j], itemIds[i]];
        insert.run(a, b);
      }
    }
  })();
}

// ---------- merging ----------

/** Fields the merge screen lets the user pick between. */
export const MERGE_FIELDS = [
  'title', 'authors', 'published', 'itemType', 'doi', 'isbn', 'abstract', 'journal', 'volume',
  'issue', 'pages', 'publisher', 'edition', 'url', 'extra', 'filePath', 'fileHash', 'snapshotPath',
] as const;

const isBlank = (v: any) => v === null || v === undefined || v === '' || v === 0 || v === 'N/A';

/** Which record to keep by default: has a file, then most filled-in fields, then oldest. */
export function pickDefaultMaster(items: any[]): any {
  const score = (i: any) => (i.filePath ? 1000 : 0) + MERGE_FIELDS.filter(f => !isBlank(i[f])).length;
  return [...items].sort((a, b) => score(b) - score(a) || a.id - b.id)[0];
}

/** Field values for a merge that keeps the master's data and fills its blanks from the others. */
export function fillBlanksOverrides(master: any, others: any[]): Record<string, any> {
  const overrides: Record<string, any> = {};
  for (const f of MERGE_FIELDS) {
    if (!isBlank(master[f])) continue;
    const donor = others.find(o => !isBlank(o[f]));
    if (donor) overrides[f] = donor[f];
  }
  // A file and its fingerprint travel together.
  if (overrides.filePath && !overrides.fileHash) {
    const donor = others.find(o => o.filePath === overrides.filePath);
    if (donor?.fileHash) overrides.fileHash = donor.fileHash;
  }
  return overrides;
}

/**
 * Merge `otherIds` into `masterId`. `fieldValues` are the final values for any
 * master fields the user changed. Returns the sync_log id used to undo.
 */
export function mergeItems(masterId: number, otherIds: number[], fieldValues: Record<string, any> = {}): number {
  const db = getDb();
  const others = otherIds.filter(id => id !== masterId);
  if (others.length === 0) throw new Error('Nothing to merge');

  const run = db.transaction(() => {
    const master = db.prepare('SELECT * FROM items WHERE id = ?').get(masterId);
    if (!master) throw new Error('Master record not found');

    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if ((MERGE_FIELDS as readonly string[]).includes(k)) fields[k] = v;
    }

    const snapshot = {
      masterId,
      otherIds: others,
      masterBefore: Object.fromEntries(Object.keys(fields).map(k => [k, master[k]])),
      addedTags: [] as number[],
      addedCollections: [] as number[],
      movedNotes: [] as { id: number; from: number }[],
      movedAnnotations: [] as { id: number; from: number }[],
      // Each original relation row we removed, plus the repointed row we inserted (if any).
      movedRelations: [] as { orig: { itemId: number; relatedItemId: number; relationType: string }; inserted: [number, number] | null }[],
    };

    if (Object.keys(fields).length > 0) {
      const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
      db.prepare(`UPDATE items SET ${sets} WHERE id = ?`).run(...Object.values(fields), masterId);
    }

    const masterTags = new Set((db.prepare('SELECT tagId FROM item_tags WHERE itemId = ?').all(masterId) as any[]).map(r => r.tagId));
    const masterCols = new Set((db.prepare('SELECT collectionId FROM collection_items WHERE itemId = ?').all(masterId) as any[]).map(r => r.collectionId));

    for (const otherId of others) {
      for (const { tagId } of db.prepare('SELECT tagId FROM item_tags WHERE itemId = ?').all(otherId) as any[]) {
        if (masterTags.has(tagId)) continue;
        db.prepare('INSERT OR IGNORE INTO item_tags (itemId, tagId) VALUES (?, ?)').run(masterId, tagId);
        masterTags.add(tagId);
        snapshot.addedTags.push(tagId);
      }
      for (const { collectionId } of db.prepare('SELECT collectionId FROM collection_items WHERE itemId = ?').all(otherId) as any[]) {
        if (masterCols.has(collectionId)) continue;
        db.prepare('INSERT INTO collection_items (itemId, collectionId) VALUES (?, ?)').run(masterId, collectionId);
        masterCols.add(collectionId);
        snapshot.addedCollections.push(collectionId);
      }
      for (const { id } of db.prepare('SELECT id FROM notes WHERE itemId = ?').all(otherId) as any[]) {
        db.prepare('UPDATE notes SET itemId = ? WHERE id = ?').run(masterId, id);
        snapshot.movedNotes.push({ id, from: otherId });
      }
      for (const { id } of db.prepare('SELECT id FROM annotations WHERE itemId = ?').all(otherId) as any[]) {
        db.prepare('UPDATE annotations SET itemId = ? WHERE id = ?').run(masterId, id);
        snapshot.movedAnnotations.push({ id, from: otherId });
      }
      // Relations pointing at the loser now point at the master (dropping self-links).
      for (const rel of db.prepare('SELECT * FROM item_relations WHERE itemId = ? OR relatedItemId = ?').all(otherId, otherId) as any[]) {
        db.prepare('DELETE FROM item_relations WHERE itemId = ? AND relatedItemId = ?').run(rel.itemId, rel.relatedItemId);
        const a = others.includes(rel.itemId) ? masterId : rel.itemId;
        const b = others.includes(rel.relatedItemId) ? masterId : rel.relatedItemId;
        let inserted: [number, number] | null = null;
        if (a !== b) {
          const res = db.prepare('INSERT OR IGNORE INTO item_relations (itemId, relatedItemId, relationType) VALUES (?, ?, ?)').run(a, b, rel.relationType);
          if (res.changes > 0) inserted = [a, b];
        }
        snapshot.movedRelations.push({ orig: rel, inserted });
      }
      db.prepare('UPDATE items SET deletedAt = CURRENT_TIMESTAMP WHERE id = ?').run(otherId);
    }

    // If the kept file came from a loser, carry its extracted text over too.
    if (fields.filePath && fields.filePath !== master.filePath) {
      const donor = others.find(id => (db.prepare('SELECT filePath FROM items WHERE id = ?').get(id) as any)?.filePath === fields.filePath);
      if (donor) {
        db.prepare('DELETE FROM page_text WHERE itemId = ?').run(masterId);
        db.prepare('INSERT INTO page_text (text, itemId, page) SELECT text, ?, page FROM page_text WHERE itemId = ?').run(masterId, donor);
        const flat = db.prepare('SELECT fullText FROM search_index WHERE itemId = ?').get(donor) as any;
        if (flat) db.prepare('INSERT OR REPLACE INTO search_index (itemId, fullText) VALUES (?, ?)').run(masterId, flat.fullText);
        (snapshot as any).textCopied = true;
        const donorRow = db.prepare('SELECT textIndexVersion, masteryStatus FROM items WHERE id = ?').get(donor) as any;
        db.prepare('UPDATE items SET textIndexVersion = ?, masteryStatus = ? WHERE id = ?').run(donorRow.textIndexVersion, donorRow.masteryStatus, masterId);
      }
    }

    logSync('MERGE', 'items', masterId, snapshot);
    return (db.prepare('SELECT last_insert_rowid() AS id').get() as any).id as number;
  });
  return run();
}

/** Reverses a merge recorded in sync_log (only while the merged-away items still exist). */
export function undoMerge(mergeLogId: number) {
  const db = getDb();
  const row = db.prepare("SELECT * FROM sync_log WHERE id = ? AND action = 'MERGE'").get(mergeLogId) as any;
  if (!row) throw new Error('Merge record not found');
  const s = JSON.parse(row.data);
  const stillThere = s.otherIds.every((id: number) => db.prepare('SELECT 1 FROM items WHERE id = ?').get(id));
  if (!stillThere) throw new Error('Can’t undo: the merged items were permanently deleted from the Trash.');

  db.transaction(() => {
    const keys = Object.keys(s.masterBefore);
    if (keys.length > 0) {
      db.prepare(`UPDATE items SET ${keys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`).run(...keys.map(k => s.masterBefore[k]), s.masterId);
    }
    for (const tagId of s.addedTags) db.prepare('DELETE FROM item_tags WHERE itemId = ? AND tagId = ?').run(s.masterId, tagId);
    for (const cId of s.addedCollections) db.prepare('DELETE FROM collection_items WHERE itemId = ? AND collectionId = ?').run(s.masterId, cId);
    for (const n of s.movedNotes) db.prepare('UPDATE notes SET itemId = ? WHERE id = ?').run(n.from, n.id);
    for (const a of s.movedAnnotations) db.prepare('UPDATE annotations SET itemId = ? WHERE id = ?').run(a.from, a.id);
    for (const { inserted } of s.movedRelations) {
      if (inserted) db.prepare('DELETE FROM item_relations WHERE itemId = ? AND relatedItemId = ?').run(inserted[0], inserted[1]);
    }
    for (const { orig } of s.movedRelations) {
      db.prepare('INSERT OR IGNORE INTO item_relations (itemId, relatedItemId, relationType) VALUES (?, ?, ?)').run(orig.itemId, orig.relatedItemId, orig.relationType);
    }
    if (s.textCopied) {
      // The master's text came from a loser's PDF; drop it and let the background
      // re-index rebuild it from the master's own file (if any) on next launch.
      db.prepare('DELETE FROM page_text WHERE itemId = ?').run(s.masterId);
      db.prepare('DELETE FROM search_index WHERE itemId = ?').run(s.masterId);
      db.prepare('UPDATE items SET textIndexVersion = NULL WHERE id = ?').run(s.masterId);
    }
    for (const id of s.otherIds) db.prepare('UPDATE items SET deletedAt = NULL WHERE id = ?').run(id);
    db.prepare("UPDATE sync_log SET action = 'MERGE_UNDONE' WHERE id = ?").run(mergeLogId);
  })();
}
