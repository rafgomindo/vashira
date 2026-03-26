import axios from 'axios';

/**
 * Vashira Gatherer
 * Scrapes metadata from research websites or DOIs.
 */

export async function fetchMetadataFromDOI(doi: string) {
  try {
    // CrossRef API is excellent for getting JSON metadata from a DOI
    const response = await axios.get(`https://api.crossref.org/works/${doi}`, {
      headers: { 'Accept': 'application/json' }
    });
    
    const data = response.data.message;
    return {
      title: data.title[0],
      itemType: 'journalArticle',
      doi: doi,
      authors: data.author ? data.author.map((a: any) => `${a.given} ${a.family}`).join(', ') : 'Unknown',
      published: data.issued ? data.issued['date-parts'][0][0] : 'N/A',
      abstract: data.abstract || ''
    };
  } catch (error) {
    console.error('Failed to fetch DOI metadata:', error);
    return null;
  }
}

export function extractDOIFromURL(url: string) {
  // Common DOI regex
  const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const match = url.match(doiRegex);
  return match ? match[0] : null;
}

export function extractDOIFromText(text: string) {
  const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const match = text.match(doiRegex);
  return match ? match[0] : null;
}
