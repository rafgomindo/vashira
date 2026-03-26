/**
 * Vashira 3.0: Mastering Import Formats
 * Parsers for BibTeX, RIS, and PDF Heuristics.
 */

export interface ResearchItem {
  title: string;
  itemType: string;
  authors: string;
  published: string;
  doi?: string;
  url?: string;
  abstract?: string;
  extra?: string;
}

export function parseBibTeX(content: string): ResearchItem[] {
  const items: ResearchItem[] = [];
  // Basic Regex for @type{key, fields...}
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),([\s\S]+?)\n\}/g;
  const fieldRegex = /(\w+)\s*=\s*\{?([^},]+)\}?/g;

  let match;
  while ((match = entryRegex.exec(content)) !== null) {
    const type = match[1];
    const fieldsText = match[3];
    const fields: any = {};
    
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(fieldsText)) !== null) {
      fields[fieldMatch[1].toLowerCase()] = fieldMatch[2].trim();
    }

    items.push({
      title: fields.title || 'Untitled BibTeX',
      itemType: type === 'article' ? 'journalArticle' : (type === 'book' ? 'book' : 'generic'),
      authors: fields.author || 'Unknown',
      published: fields.year || fields.date || 'N/A',
      doi: fields.doi || '',
      url: fields.url || '',
      abstract: fields.abstract || ''
    });
  }
  return items;
}

export function parseRIS(content: string): ResearchItem[] {
  const items: ResearchItem[] = [];
  const entries = content.split(/ER  - /);
  
  for (const entry of entries) {
    if (!entry.trim()) continue;
    
    const lines = entry.split('\n');
    const fields: any = {};
    
    for (const line of lines) {
      const tagMatch = line.match(/^([A-Z0-9]{2})  - (.*)/);
      if (tagMatch) {
        const tag = tagMatch[1];
        const value = tagMatch[2].trim();
        
        if (!fields[tag]) fields[tag] = [];
        fields[tag].push(value);
      }
    }

    if (fields['TI'] || fields['T1']) {
      items.push({
        title: fields['TI']?.[0] || fields['T1']?.[0] || 'Untitled RIS',
        itemType: fields['TY']?.[0] === 'JOUR' ? 'journalArticle' : 'generic',
        authors: fields['AU']?.join(', ') || 'Unknown',
        published: fields['PY']?.[0] || 'N/A',
        doi: fields['DO']?.[0] || '',
        url: fields['UR']?.[0] || '',
        abstract: fields['AB']?.[0] || ''
      });
    }
  }
  return items;
}

/**
 * Heuristic extraction for PDFs without DOI
 */
export function extractMetadataFromHeuristics(text: string): Partial<ResearchItem> {
  // Clean text
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  
  // Usually the first long line is the title
  const title = lines[0] || 'Imported PDF';
  
  // Look for "Abstract" section
  const abstractMatch = text.match(/Abstract[:\s]+([\s\S]{50,500})/i);
  
  return {
    title: title.length > 200 ? title.substring(0, 200) + '...' : title,
    abstract: abstractMatch ? abstractMatch[1].trim() : ''
  };
}
