import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface MetadataItem {
  title: string;
  itemType: string;
  doi?: string;
  authors: string;
  published: string;
  abstract: string;
  url?: string;
  publisher?: string;
  pages?: number;
  isbn?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  edition?: string;
  extra?: string;
}

export interface Translator {
  name: string;
  priority: number;
  canHandle: (url: string, html?: string) => boolean;
  extract: (url: string, html?: string) => Promise<MetadataItem | null>;
}

/**
 * CrossRef Translator (Fallback for DOIs)
 */
const CrossRefTranslator: Translator = {
  name: 'CrossRef',
  priority: 10,
  canHandle: (url) => /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(url),
  extract: async (url) => {
    const doiRegex = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
    const match = url.match(doiRegex);
    if (!match) return null;
    const doi = match[0];
    
    try {
      const response = await axios.get(`https://api.crossref.org/works/${doi}`, {
        headers: { 'Accept': 'application/json' }
      });
      const data = response.data.message;
      return {
        title: data.title[0],
        itemType: 'journalArticle',
        doi: doi,
        authors: data.author ? data.author.map((a: any) => `${a.given} ${a.family}`).join(', ') : 'Unknown',
        published: data.issued ? data.issued['date-parts'][0][0].toString() : 'N/A',
        abstract: data.abstract || '',
        url: url,
        publisher: data.publisher || '',
        journal: data['container-title'] ? data['container-title'][0] : '',
        volume: data.volume || '',
        issue: data.issue || '',
        pages: data.page || 0
      };
    } catch (e) {
      console.error('[CrossRef] Extraction failed:', e);
      return null;
    }
  }
};

/**
 * ArXiv Translator
 */
const ArXivTranslator: Translator = {
  name: 'ArXiv',
  priority: 100,
  canHandle: (url) => url.includes('arxiv.org/abs/') || url.includes('arxiv.org/pdf/'),
  extract: async (url) => {
    const idMatch = url.match(/\d{4}\.\d{4,5}/);
    if (!idMatch) return null;
    const id = idMatch[0];

    try {
      const response = await axios.get(`https://export.arxiv.org/api/query?id_list=${id}`);
      const xml = response.data;
      
      // Robust ArXiv XML parsing (ArXiv API has <entry> as the core paper node)
      const entryText = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1] || xml;
      const title = entryText.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || '';
      const summary = entryText.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim() || '';
      const published = entryText.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.substring(0, 4) || '';
      const authors = [...entryText.matchAll(/<name>([\s\S]*?)<\/name>/g)].map(m => m[1]).join(', ');

      return {
        title: title.replace(/\n/g, ' '),
        itemType: 'preprint',
        authors: authors,
        published: published,
        abstract: summary.replace(/\n/g, ' '),
        url: `https://arxiv.org/abs/${id}`,
        extra: `arXiv:${id}`
      };
    } catch (e) {
      console.error('[ArXiv] Extraction failed:', e);
      return null;
    }
  }
};

/**
 * OpenLibrary Translator (for Books / ISBNs)
 */
const OpenLibraryTranslator: Translator = {
  name: 'OpenLibrary',
  priority: 20,
  canHandle: (url) => url.includes('openlibrary.org') || /\b(97[89])?\d{9}(\d|X)\b/.test(url),
  extract: async (url) => {
    const isbnMatch = url.match(/\b(97[89])?\d{9}(\d|X)\b/);
    if (!isbnMatch) return null;
    const isbn = isbnMatch[0];
    
    try {
      const response = await axios.get(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
      const bookData = response.data[`ISBN:${isbn}`];
      if (!bookData) return null;
      
      return {
        title: bookData.title,
        itemType: 'book',
        authors: bookData.authors ? bookData.authors.map((a: any) => a.name).join(', ') : 'Unknown',
        published: bookData.publish_date || 'N/A',
        publisher: bookData.publishers ? bookData.publishers.map((p: any) => p.name).join(', ') : '',
        pages: bookData.number_of_pages || 0,
        abstract: bookData.notes || '',
        url: bookData.url || url,
        isbn: isbn,
        extra: `ISBN:${isbn}`
      };
    } catch (e) {
      console.error('[OpenLibrary] Extraction failed:', e);
      return null;
    }
  }
};

export class TranslatorService {
  private translators: Translator[] = [ArXivTranslator, CrossRefTranslator, OpenLibraryTranslator];

  async translate(url: string, html?: string): Promise<MetadataItem | null> {
    // [VASHIRA 6.0] Load Dynamic Extensions
    await this.loadExtensions();
    
    const sorted = [...this.translators].sort((a, b) => b.priority - a.priority);
    
    for (const translator of sorted) {
      if (translator.canHandle(url, html)) {
        console.log(`[TranslatorService] Using ${translator.name} for ${url}`);
        const result = await translator.extract(url, html);
        if (result) return result;
      }
    }
    
    return null;
  }

  private async loadExtensions() {
    try {
      const { getStoragePath } = require('./database');
      const pluginDir = path.join(path.dirname(getStoragePath()), 'plugins');
      if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir);

      const files = fs.readdirSync(pluginDir);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const pluginPath = path.join(pluginDir, file);
          const plugin = require(pluginPath);
          if (plugin && plugin.name && !this.translators.find(t => t.name === plugin.name)) {
             console.log(`[Extensions] Loaded Sovereign Plugin: ${plugin.name}`);
             this.translators.push(plugin);
          }
        }
      }
    } catch (e) {
      console.warn('[Extensions] Plugin loading failed:', e);
    }
  }
}

export const translatorService = new TranslatorService();
