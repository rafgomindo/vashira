/**
 * Vashira Sentinel (formerly Snatcher-X) Content Script
 */

function extractDeepMetadata() {
  const metadata = {
    title: document.title,
    url: window.location.href,
    doi: null,
    published: '',
    authors: '',
    abstract: '',
    publisher: '',
    journal: ''
  };

  // Highwire Press & Dublin Core Extractors
  const metaTags = document.getElementsByTagName('meta');
  const authors = [];

  for (let i = 0; i < metaTags.length; i++) {
    const name = (metaTags[i].getAttribute('name') || metaTags[i].getAttribute('property') || '').toLowerCase();
    const content = metaTags[i].getAttribute('content') || '';

    if (!content) continue;

    if (name === 'citation_doi' || name === 'dc.identifier' || name === 'og:doi' || name === 'citation_pmid') {
      if (!metadata.doi) metadata.doi = content;
    } else if (name === 'citation_title' || name === 'dc.title' || name === 'og:title') {
      metadata.title = content;
    } else if (name === 'citation_author' || name === 'dc.creator') {
      authors.push(content);
    } else if (name === 'citation_publication_date' || name === 'dc.date') {
      metadata.published = content.substring(0, 4); // Keep just the year for simplicity or full date
    } else if (name === 'citation_journal_title' || name === 'dc.relation.ispartof') {
      metadata.journal = content;
    } else if (name === 'citation_publisher' || name === 'dc.publisher') {
      metadata.publisher = content;
    } else if (name === 'citation_abstract' || name === 'dc.description' || name === 'og:description') {
      if (!metadata.abstract) metadata.abstract = content;
    }
  }

  // Fallbacks: Try to parse DOI from URL or body
  if (!metadata.doi) {
    const doiLink = document.querySelector('a[href*="doi.org/"]');
    if (doiLink) {
      const match = doiLink.href.match(/10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+/);
      if (match) metadata.doi = match[0];
    } else {
      const bodyText = document.body.innerText;
      const match = bodyText.match(/10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+/);
      if (match) metadata.doi = match[0];
    }
  }

  if (authors.length > 0) metadata.authors = authors.join(', ');

  return metadata;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_METADATA') {
    const metadata = extractDeepMetadata();
    // Also grab the HTML snapshot
    metadata.htmlContent = document.documentElement.outerHTML;
    
    sendResponse(metadata);
  }
});

