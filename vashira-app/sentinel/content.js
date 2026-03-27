// Advanced Sentinel Scraper (Mastery 9.0)
function scrapeMetadata() {
  const url = window.location.href;
  const title = document.title;
  let metadata = {
    title: title,
    url: url,
    itemType: 'webpage',
    dateAdded: new Date().toISOString()
  };

  // Google Scholar Scraper
  if (url.includes('scholar.google')) {
    const entry = document.querySelector('.gs_rt a');
    if (entry) metadata.title = entry.innerText;
    const authors = document.querySelector('.gs_a');
    if (authors) metadata.authors = authors.innerText;
  }

  // arXiv Scraper
  if (url.includes('arxiv.org')) {
    const arxivTitle = document.querySelector('h1.title');
    if (arxivTitle) metadata.title = arxivTitle.innerText.replace('Title:', '').trim();
    const arxivAuthors = document.querySelector('.authors');
    if (arxivAuthors) metadata.authors = arxivAuthors.innerText.replace('Authors:', '').trim();
    metadata.itemType = 'preprint';
    const pdfLink = document.querySelector('a.download-pdf');
    if (pdfLink) metadata.url = pdfLink.href;
  }

  // PubMed Scraper
  if (url.includes('pubmed.ncbi.nlm.nih.gov')) {
     const pmTitle = document.querySelector('.heading-title');
     if (pmTitle) metadata.title = pmTitle.innerText.trim();
     const pmAuthors = document.querySelector('.authors-list');
     if (pmAuthors) metadata.authors = pmAuthors.innerText.trim();
  }

  // Generic Meta Tags
  const doiMeta = document.querySelector('meta[name="citation_doi"]') || document.querySelector('meta[name="dc.identifier"]');
  if (doiMeta) metadata.doi = doiMeta.content;

  const abstractMeta = document.querySelector('meta[name="citation_abstract"]') || document.querySelector('meta[name="description"]');
  if (abstractMeta) metadata.abstract = abstractMeta.content;

  const authorMeta = document.querySelector('meta[name="citation_author"]');
  if (authorMeta && !metadata.authors) metadata.authors = authorMeta.content;

  return metadata;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getMetadata") {
    sendResponse(scrapeMetadata());
  }
});
