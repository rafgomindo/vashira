import axios from 'axios';
import { translatorService, MetadataItem } from './translator-service';

/**
 * Vashira Gatherer
 * Scrapes metadata from research websites or DOIs.
 */

export async function fetchMetadataFromDOI(doi: string): Promise<MetadataItem | null> {
  return translatorService.translate(`https://doi.org/${doi}`);
}

export async function fetchMetadataFromURL(url: string): Promise<MetadataItem | null> {
  return translatorService.translate(url);
}

export function extractDOIFromURL(url: string) {
  // Common DOI regex
  const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
  const match = url.match(doiRegex);
  return match ? match[0] : null;
}

export function extractDOIFromText(text: string) {
  // Enhanced DOI regex (handles more variations and delimiters)
  const doiRegex = /\b10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+\b/g;
  const matches = text.match(doiRegex);
  // Return the first match that looks like a valid DOI (length > 7)
  return matches ? matches.find(m => m.length > 7) : null;
}
export function extractISBNFromText(text: string) {
  // ISBN-10 and ISBN-13 regex
  const isbnRegex = /\b(?:ISBN(?:-1[03])?:? )?(?=[0-9X]{10}$|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}$|97[89][0-9]{10}$|(?=(?:[0-9]+[- ]){4})[- 0-9]{17}$)(?:97[89][- ]?)?[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]\b/g;
  const matches = text.match(isbnRegex);
  // Return first match, normalized (no hyphens)
  return matches ? matches[0].replace(/[- ]/g, '').replace(/ISBN/i, '').replace(':', '') : null;
}
