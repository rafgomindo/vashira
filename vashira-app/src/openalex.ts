import { getDb } from './database';
import { normalizeDoi, normalizeTitle } from './duplicates';

/**
 * OpenAlex discovery (v10.3) — references, cited-by, similar works, keyword search,
 * and "works your library keeps citing". Called directly from this computer (no
 * Vashira server). Free without a key: single-record lookups cost nothing; list and
 * search calls draw on a small daily per-IP budget. Responses are cached in SQLite
 * for CACHE_DAYS, so revisiting an item is free and works offline.
 */

const BASE = 'https://api.openalex.org';
const CACHE_DAYS = 14;
const USER_AGENT = 'Vashira/10.3 (+https://vashira.org)';
const WORK_FIELDS = [
  'id', 'doi', 'display_name', 'publication_year', 'type', 'authorships', 'primary_location',
  'cited_by_count', 'referenced_works', 'related_works', 'best_oa_location', 'abstract_inverted_index', 'biblio',
].join(',');

let apiKey: string | null = null;
export function setOpenAlexKey(key?: string | null) {
  apiKey = key?.trim() || null;
}

export class OpenAlexLimitError extends Error {}

function ensureCacheTable() {
  getDb().exec(`CREATE TABLE IF NOT EXISTS openalex_cache (
    key TEXT PRIMARY KEY, json TEXT NOT NULL, fetchedAt INTEGER NOT NULL
  )`);
}

async function getJson(pathAndQuery: string): Promise<any> {
  ensureCacheTable();
  const db = getDb();
  const cached = db.prepare('SELECT json, fetchedAt FROM openalex_cache WHERE key = ?').get(pathAndQuery) as any;
  if (cached && Date.now() - cached.fetchedAt < CACHE_DAYS * 86400_000) return JSON.parse(cached.json);

  const url = new URL(BASE + pathAndQuery);
  if (apiKey) url.searchParams.set('api_key', apiKey);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (res.status === 429 || res.status === 409 || res.status === 402) {
    throw new OpenAlexLimitError('Discovery limit reached for today. Add a free OpenAlex key in Settings for 10× more, or try again tomorrow.');
  }
  if (!res.ok) throw new Error(`OpenAlex error ${res.status}`);
  const json = await res.json();
  db.prepare('INSERT OR REPLACE INTO openalex_cache (key, json, fetchedAt) VALUES (?, ?, ?)').run(pathAndQuery, JSON.stringify(json), Date.now());
  return json;
}

// ---------- mapping ----------

export type Candidate = {
  openalexId: string;
  title: string;
  authors: string;
  published: string;
  doi: string;
  journal: string;
  itemType: string;
  citedByCount: number;
  oaPdfUrl: string;
  abstract: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  inLibraryId?: number | null;
  citedByYourLibrary?: number;
};

const TYPE_MAP: Record<string, string> = {
  article: 'journalArticle', book: 'book', 'book-chapter': 'bookSection', dissertation: 'thesis',
  preprint: 'preprint', report: 'report', review: 'journalArticle', 'proceedings-article': 'conferencePaper',
};

function abstractFromIndex(index?: Record<string, number[]> | null): string {
  if (!index) return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) for (const p of positions) words[p] = word;
  return words.filter(Boolean).join(' ');
}

const shortId = (id?: string) => (id || '').replace('https://openalex.org/', '');

export function toCandidate(w: any): Candidate {
  const source = w.primary_location?.source;
  const first = w.biblio?.first_page, last = w.biblio?.last_page;
  return {
    openalexId: shortId(w.id),
    title: w.display_name || 'Untitled',
    authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean).slice(0, 12).join(', '),
    published: w.publication_year ? String(w.publication_year) : '',
    doi: normalizeDoi(w.doi),
    journal: source?.type === 'journal' ? source.display_name || '' : '',
    itemType: TYPE_MAP[w.type] || 'journalArticle',
    citedByCount: w.cited_by_count || 0,
    oaPdfUrl: w.best_oa_location?.pdf_url || '',
    abstract: abstractFromIndex(w.abstract_inverted_index),
    volume: w.biblio?.volume || '',
    issue: w.biblio?.issue || '',
    pages: first ? (last && last !== first ? `${first}-${last}` : String(first)) : '',
    publisher: source?.host_organization_name || '',
  };
}

/** Mark candidates that are already in the library (by DOI, else exact normalized title). */
function markInLibrary(cands: Candidate[]): Candidate[] {
  const items = getDb().prepare('SELECT id, doi, title FROM items WHERE deletedAt IS NULL').all() as any[];
  const byDoi = new Map(items.filter(i => i.doi).map(i => [normalizeDoi(i.doi), i.id]));
  const byTitle = new Map(items.map(i => [normalizeTitle(i.title), i.id]));
  return cands.map(c => ({ ...c, inLibraryId: (c.doi && byDoi.get(c.doi)) || byTitle.get(normalizeTitle(c.title)) || null }));
}

// ---------- lookups ----------

async function getWorkByDoi(doi: string) {
  return getJson(`/works/doi:${encodeURIComponent(normalizeDoi(doi))}?select=${WORK_FIELDS}`);
}

async function getWorkById(id: string) {
  return getJson(`/works/${encodeURIComponent(shortId(id))}?select=${WORK_FIELDS}`);
}

/** Find the OpenAlex work for a library item: by DOI (free), else by title search. */
export async function findWorkForItem(item: any): Promise<any | null> {
  if (item.doi) {
    const w = await getWorkByDoi(item.doi);
    if (w) return w;
  }
  if (!item.title) return null;
  const q = encodeURIComponent(item.title.slice(0, 200));
  const res = await getJson(`/works?search=${q}&per_page=5&select=${WORK_FIELDS}`);
  const target = normalizeTitle(item.title);
  const year = (item.published || '').match(/\d{4}/)?.[0];
  return (res?.results || []).find((w: any) => {
    const t = normalizeTitle(w.display_name);
    // An exact title is enough (books get reissued in other years); a prefix match also needs the year.
    if (t === target) return true;
    const close = t.length > 10 && (t.startsWith(target) || target.startsWith(t));
    return close && (!year || !w.publication_year || Math.abs(Number(year) - w.publication_year) <= 1);
  }) || null;
}

async function worksByIds(ids: string[]): Promise<any[]> {
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50).map(shortId).join('|');
    const res = await getJson(`/works?filter=openalex_id:${chunk}&per_page=50&select=${WORK_FIELDS}`);
    out.push(...(res?.results || []));
  }
  return out;
}

export async function relatedForItem(item: any) {
  const work = await findWorkForItem(item);
  if (!work) return { work: null, references: [], citedBy: [], similar: [] };
  const [refs, cites, similar] = await Promise.all([
    worksByIds((work.referenced_works || []).slice(0, 100)),
    getJson(`/works?filter=cites:${shortId(work.id)}&sort=cited_by_count:desc&per_page=25&select=${WORK_FIELDS}`),
    worksByIds((work.related_works || []).slice(0, 25)),
  ]);
  const sortByCites = (a: Candidate, b: Candidate) => b.citedByCount - a.citedByCount;
  return {
    work: markInLibrary([toCandidate(work)])[0],
    references: markInLibrary(refs.map(toCandidate)).sort(sortByCites),
    citedBy: markInLibrary((cites?.results || []).map(toCandidate)),
    similar: markInLibrary(similar.map(toCandidate)),
  };
}

export async function searchWorks(query: string) {
  const res = await getJson(`/works?search=${encodeURIComponent(query.slice(0, 300))}&per_page=25&select=${WORK_FIELDS}`);
  return markInLibrary((res?.results || []).map(toCandidate));
}

/**
 * "Your library keeps citing": count how often each referenced work appears across
 * the library's papers and return the most-cited ones you don't have yet.
 * Uses DOI lookups only (free); items without a DOI are skipped here.
 */
export async function librarySuggestions(limit = 20) {
  const items = getDb().prepare("SELECT * FROM items WHERE deletedAt IS NULL AND doi IS NOT NULL AND doi != '' LIMIT 300").all() as any[];
  const counts = new Map<string, number>();
  const own = new Set<string>();
  for (const item of items) {
    try {
      const w = await getWorkByDoi(item.doi);
      if (!w) continue;
      own.add(shortId(w.id));
      for (const ref of w.referenced_works || []) counts.set(shortId(ref), (counts.get(shortId(ref)) || 0) + 1);
    } catch (e) {
      if (e instanceof OpenAlexLimitError) throw e;
    }
  }
  const top = [...counts.entries()].filter(([id, n]) => !own.has(id) && n >= 2).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (top.length === 0) return { analyzed: items.length, suggestions: [] };
  const works = await worksByIds(top.map(([id]) => id));
  const byId = new Map(works.map(w => [shortId(w.id), w]));
  const suggestions = markInLibrary(top.filter(([id]) => byId.has(id)).map(([id, n]) => ({ ...toCandidate(byId.get(id)), citedByYourLibrary: n })))
    .filter(c => !c.inLibraryId);
  return { analyzed: items.length, suggestions };
}

export { getWorkById };
