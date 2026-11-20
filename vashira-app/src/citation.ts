// @ts-ignore
import CSL from 'citeproc';

export const MINIMAL_APA_STYLE = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" demote-non-dropping-particle="never" default-locale="en-US">
  <info>
    <title>Vashira APA (Minimal)</title>
    <id>http://www.zotero.org/styles/vashira-apa</id>
    <author><name>Rafael Domingo Ramones</name></author>
    <category citation-format="author-date"/>
    <updated>2026-03-26T00:00:00+00:00</updated>
  </info>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="all" and="symbol" sort-separator=", " initialize-with=". " delimiter=", " delimiter-precedes-last="always"/>
      <label form="short" prefix=" (" suffix=")"/>
      <substitute>
        <text variable="title"/>
      </substitute>
    </names>
  </macro>
  <citation>
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
        <text macro="author"/>
        <date variable="issued">
          <date-part name="year"/>
        </date>
      </group>
    </layout>
  </citation>
  <bibliography>
    <layout>
      <text macro="author" suffix="."/>
      <date variable="issued" prefix=" (" suffix=").">
        <date-part name="year"/>
      </date>
      <text variable="title" prefix=" " suffix="." font-style="italic"/>
      <text variable="container-title" prefix=" " suffix="."/>
      <text variable="DOI" prefix=" https://doi.org/"/>
    </layout>
  </bibliography>
</style>`;

export const MINIMAL_IEEE_STYLE = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0" demote-non-dropping-particle="never">
  <info><title>Vashira IEEE</title><id>v-ieee</id><updated>2026-03-26T00:00:00+00:00</updated></info>
  <layout prefix="[" suffix="]" delimiter=", ">
    <text variable="citation-number"/>
  </layout>
  <bibliography>
    <layout>
      <text variable="citation-number" prefix="[" suffix="] "/>
      <names variable="author" suffix=", "><name and="text" delimiter=", " initialize-with=". "/></names>
      <text variable="title" prefix='"' suffix=',"' font-style="italic"/>
      <text variable="container-title" prefix=" " suffix="."/>
    </layout>
  </bibliography>
</style>`;

export const MINIMAL_MLA_STYLE = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" class="in-text" version="1.0">
  <info><title>Vashira MLA</title><id>v-mla</id><updated>2026-03-26T00:00:00+00:00</updated></info>
  <bibliography>
    <layout>
      <names variable="author" suffix=". "><name name-as-sort-order="all" and="text" delimiter=", " initialize-with=". "/></names>
      <text variable="title" prefix='"' suffix='."'/>
      <text variable="container-title" font-style="italic" prefix=" " suffix="."/>
      <date variable="issued" prefix=" " suffix="."><date-part name="year"/></date>
    </layout>
  </bibliography>
</style>`;

// Official CSL locale files (CC BY-SA 3.0, github.com/citation-style-language/locales),
// bundled so French/Spanish styles get the right terms ("dir.", "et", "p.") offline.
import LOCALE_EN_US from './styles/locales-en-US.xml';
import LOCALE_FR_FR from './styles/locales-fr-FR.xml';
import LOCALE_ES_ES from './styles/locales-es-ES.xml';
// "Le tapuscrit" (EHESS) styles, verbatim from the official CSL style repository (CC BY-SA 3.0).
import TAPUSCRIT_NOTE from './styles/le-tapuscrit-note.csl';
import TAPUSCRIT_AUTHOR_DATE from './styles/le-tapuscrit-author-date.csl';

export const TAPUSCRIT_NOTE_STYLE: string = TAPUSCRIT_NOTE;
export const TAPUSCRIT_AUTHOR_DATE_STYLE: string = TAPUSCRIT_AUTHOR_DATE;

const LOCALES: Record<string, string> = { 'en-US': LOCALE_EN_US, 'fr-FR': LOCALE_FR_FR, 'es-ES': LOCALE_ES_ES };

function retrieveLocale(lang: string): string {
  if (LOCALES[lang]) return LOCALES[lang];
  const prefix = (lang || '').slice(0, 2).toLowerCase();
  const match = Object.keys(LOCALES).find(k => k.toLowerCase().startsWith(prefix));
  return LOCALES[match || 'en-US'];
}

// Vashira/Zotero item types → CSL types.
const CSL_TYPES: Record<string, string> = {
  journalArticle: 'article-journal', magazineArticle: 'article-magazine', newspaperArticle: 'article-newspaper',
  book: 'book', bookSection: 'chapter', thesis: 'thesis', report: 'report', webpage: 'webpage',
  conferencePaper: 'paper-conference', preprint: 'article', manuscript: 'manuscript', document: 'document',
};

type CSLName = { family?: string; given?: string; literal?: string };

function parsePerson(p: string): CSLName | null {
  const name = p.trim();
  if (!name || /^(unknown|extracted content|n\/a)$/i.test(name)) return null;
  if (name.includes(',')) {
    const [family, given] = name.split(',').map(x => x.trim());
    return { family, given };
  }
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { literal: name };
  return { family: parts[parts.length - 1], given: parts.slice(0, -1).join(' ') };
}

/**
 * The authors column comes in several shapes depending on the importer:
 * "Given Family, Given Family" (CrossRef, arXiv, OpenLibrary), "Family, Given; Family, Given"
 * (Zotero), "Family, Given and Family, Given" (BibTeX), or "Family, Given, Family, Given" (RIS).
 */
export function parseAuthors(authors?: string | null): CSLName[] {
  if (!authors) return [];
  const a = authors.trim();
  let people: string[];
  if (/;| and /.test(a)) {
    people = a.split(/;| and /);
  } else {
    const pieces = a.split(',').map(x => x.trim()).filter(Boolean);
    // "Mbembe, Achille" / "Mbembe, Achille, Balandier, Georges": comma-separated single-word pieces in pairs.
    const looksPaired = pieces.length % 2 === 0 && pieces.length > 0 && pieces.every(x => !/\s/.test(x));
    people = looksPaired ? pieces.reduce<string[]>((acc, x, i) => (i % 2 ? (acc[acc.length - 1] += ', ' + x, acc) : [...acc, x]), []) : pieces;
  }
  return people.map(parsePerson).filter(Boolean) as CSLName[];
}

function yearOf(published?: string | null): number | null {
  const m = (published || '').match(/\b(1[5-9]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
}

export function toCSL(item: any) {
  const type = CSL_TYPES[item.itemType] || (item.journal ? 'article-journal' : item.isbn || item.publisher ? 'book' : 'document');
  const year = yearOf(item.published);
  const csl: any = {
    id: item.id.toString(),
    type,
    title: item.title,
    author: parseAuthors(item.authors),
  };
  if (year) csl.issued = { 'date-parts': [[year]] };
  if (item.journal) csl['container-title'] = item.journal;
  if (item.publisher) csl.publisher = item.publisher;
  if (item.volume) csl.volume = item.volume;
  if (item.issue) csl.issue = item.issue;
  if (item.edition) csl.edition = item.edition;
  if (item.doi) csl.DOI = item.doi;
  if (item.isbn) csl.ISBN = item.isbn;
  if (item.url) csl.URL = item.url;
  // `pages` holds a page count for books, a page range for articles.
  if (item.pages) {
    if (type === 'book' || type === 'thesis' || type === 'report') csl['number-of-pages'] = String(item.pages);
    else csl.page = String(item.pages);
  }
  return csl;
}

export class CitationEngine {
  private citeproc: any;
  private sys: any;

  constructor(items: any[], styleXml: string) {
    this.sys = {
      retrieveLocale,
      retrieveItem: (id: string) => {
        const item = items.find(i => i.id.toString() === id);
        return item ? toCSL(item) : null;
      }
    };

    this.citeproc = new CSL.Engine(this.sys, styleXml);
    // Plain text: the result goes to the clipboard / a text editor, not into HTML.
    this.citeproc.setOutputFormat('text');
  }

  public formatCitation(id: number, format: 'text' | 'html' = 'text') {
    this.citeproc.setOutputFormat(format);
    this.citeproc.updateItems([id.toString()]);
    const result = this.citeproc.makeBibliography();
    return String(result[1][0]).trim();
  }

  /** Both forms, for the clipboard: Word/LibreOffice paste the HTML (italics, small caps), plain editors the text. */
  public formatCitationRich(id: number) {
    return { text: this.formatCitation(id, 'text'), html: this.formatCitation(id, 'html') };
  }
}
