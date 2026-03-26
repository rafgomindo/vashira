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
  // Clean text: skip binary PDF header and common metadata segments
  // We look for the first line that doesn't start with % or look like raw PDF objects
  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 5 && !l.startsWith('%')) // Skip %PDF and other PDF comments
    .filter(l => !/^\d+ \d+ obj/.test(l)) // Skip PDF objects
    .filter(l => !/endobj|stream|endstream|xref|trailer/.test(l)); // Skip PDF structural keywords
  
  // Usually the first long line in a clean text stream is the title or part of it
  // We prioritize lines that look like a title (Title Case, no weird symbols)
  let title = 'Imported PDF';
  for (const line of lines) {
    if (line.length > 10 && line.length < 200 && !line.includes('<<') && !line.includes('>>')) {
      title = line;
      break;
    }
  }
  
  // Look for "Abstract" section
  const abstractMatch = text.match(/Abstract[:\s]+([\s\S]{50,500})/i);
  
  return {
    title: title,
    abstract: abstractMatch ? abstractMatch[1].trim() : ''
  };
}

export function generateBibTeX(items: any[]): string {
  return items.map(item => {
    const key = (item.authors?.split(' ')[0] || 'Unknown').toLowerCase() + (item.published || 'n.d.').substring(0,4) + (item.title?.split(' ')[0] || 'ref').toLowerCase();
    
    let bib = `@article{${key.replace(/[^a-z0-9]/gi, '')},\n`;
    bib += `  title = {${item.title}},\n`;
    bib += `  author = {${item.authors}},\n`;
    bib += `  year = {${item.published || 'n.d.'}},\n`;
    if (item.doi) bib += `  doi = {${item.doi}},\n`;
    if (item.abstract) bib += `  abstract = {${item.abstract}},\n`;
    bib += `}`;
    return bib;
  }).join('\n\n');
}

export function categorizeItems(items: any[]): { itemId: number, category: string }[] {
  const commonCategories = [
    { name: 'Computer Science', keywords: ['computer', 'software', 'algorithm', 'system', 'artificial', 'intelligence', 'network', 'machine', 'learning'] },
    { name: 'Physics', keywords: ['physics', 'quantum', 'particle', 'matter', 'energy', 'force', 'gravity', 'space', 'astronomy'] },
    { name: 'Biology', keywords: ['biology', 'cell', 'gene', 'protein', 'evolution', 'organism', 'medical', 'health'] },
    { name: 'Philosophy', keywords: ['philosophy', 'ethics', 'logic', 'existence', 'thought', 'mind', 'epistemology'] }
  ];

  return items.map(item => {
    const content = `${item.title} ${item.abstract}`.toLowerCase();
    let bestCategory = 'General Research';
    let maxHits = 0;

    for (const cat of commonCategories) {
      const hits = cat.keywords.filter(k => content.includes(k.toLowerCase())).length;
      if (hits > maxHits) {
        maxHits = hits;
        bestCategory = cat.name;
      }
    }
    return { itemId: item.id, category: bestCategory };
  });
}
