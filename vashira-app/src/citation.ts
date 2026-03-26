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

const MINIMAL_IEEE_STYLE = `<?xml version="1.0" encoding="utf-8"?>
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

const MINIMAL_MLA_STYLE = `<?xml version="1.0" encoding="utf-8"?>
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

  constructor(items: any[], styleXml: string) {
    this.sys = {
      retrieveLocale: () => MINIMAL_LOCALE,
      retrieveItem: (id: string) => {
        const item = items.find(i => i.id.toString() === id);
        return item ? this.transformToCSL(item) : null;
      }
    };

    this.citeproc = new CSL.Engine(this.sys, styleXml);
  }

  private transformToCSL(item: any) {
    // Advanced Mapping for Professional Mastery
    return {
      id: item.id.toString(),
      type: 'article-journal',
      title: item.title,
      DOI: item.doi,
      author: item.authors ? item.authors.split(',').map((a: string) => {
        const parts = a.trim().split(' ');
        return { 
          family: parts[parts.length - 1], 
          given: parts.length > 1 ? parts.slice(0, -1).join(' ') : '' 
        };
      }) : [],
      issued: { 'date-parts': [[new Date(item.dateAdded).getFullYear()]] },
      'container-title': item.published || 'Unknown Source'
    };
  }

  public formatCitation(id: number) {
    this.citeproc.updateItems([id.toString()]);
    const result = this.citeproc.makeBibliography();
    return result[1][0]; // Returns the formatted string
  }
}
