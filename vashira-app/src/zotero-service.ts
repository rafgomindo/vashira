/**
 * Vashira 5.0 - Zotero Sync Service
 * Integration with Zotero API v3 (metadata only).
 */

export interface ZoteroItem {
  key: string;
  version: number;
  data: {
    itemType: string;
    title: string;
    creators: Array<{ firstName?: string; lastName?: string; name?: string }>;
    date: string;
    doi?: string;
    ISBN?: string;
    abstractNote?: string;
  };
}

export async function fetchZoteroLibrary(userId: string, apiKey: string) {
  const url = `https://api.zotero.org/users/${userId}/items?v=3&format=json`;
  const response = await fetch(url, {
    headers: {
      'Zotero-API-Key': apiKey,
      'Zotero-API-Version': '3'
    }
  });

  if (!response.ok) {
    throw new Error(`Zotero Sync Failed: ${response.statusText}`);
  }

  return await response.json() as ZoteroItem[];
}

/**
 * Smart Diffing logic:
 * Compares Zotero version with local version (if stored).
 * Map Zotero fields to Vashira ResearchItem fields.
 */
export function mapZoteroToVashira(zItem: ZoteroItem) {
  const authors = zItem.data.creators?.map(c => 
    c.lastName ? `${c.lastName}, ${c.firstName}` : c.name
  ).join('; ') || 'Unknown';

  return {
    title: zItem.data.title || 'Untitled',
    itemType: zItem.data.itemType,
    doi: zItem.data.doi || zItem.data.ISBN || '',
    authors: authors,
    published: zItem.data.date?.substring(0, 4) || 'n.d.',
    abstract: zItem.data.abstractNote || '',
    zoteroKey: zItem.key,
    zoteroVersion: zItem.version
  };
}
