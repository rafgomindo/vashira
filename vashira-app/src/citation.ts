// @ts-ignore
import CSL from 'citeproc';

const MINIMAL_APA_STYLE = `<?xml version="1.0" encoding="utf-8"?>
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

const MINIMAL_LOCALE = `<?xml version="1.0" encoding="utf-8"?>
<locale xmlns="http://purl.org/net/xbiblio/csl" version="1.0" xml:lang="en-US">
  <terms>
    <term name="and">and</term>
    <term name="et-al">et al.</term>
  </terms>
</locale>`;

export class CitationEngine {
  private citeproc: any;
  private sys: any;

  constructor(items: any[]) {
    this.sys = {
      retrieveLocale: () => MINIMAL_LOCALE,
      retrieveItem: (id: string) => {
        const item = items.find(i => i.id.toString() === id);
        return item ? this.transformToCSL(item) : null;
      }
    };

    this.citeproc = new CSL.Engine(this.sys, MINIMAL_APA_STYLE);
  }

  private transformToCSL(item: any) {
    return {
      id: item.id.toString(),
      type: 'article-journal',
      title: item.title,
      DOI: item.doi,
      author: item.authors ? item.authors.split(',').map((a: string) => ({ family: a.trim() })) : [],
      issued: { 'date-parts': [[new Date(item.dateAdded).getFullYear()]] },
    };
  }

  public formatCitation(id: number) {
    this.citeproc.updateItems([id.toString()]);
    const result = this.citeproc.makeBibliography();
    return result[1][0]; // Returns the formatted string
  }
}
