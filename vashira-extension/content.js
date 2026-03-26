/**
 * Vashira Snatcher-X Content Script
 */

function extractDOI() {
  // 1. Check meta tags (High confidence)
  const metaDoi = document.querySelector('meta[name="citation_doi"]') || 
                  document.querySelector('meta[name="dc.identifier"]') ||
                  document.querySelector('meta[property="og:doi"]');
  
  if (metaDoi) return metaDoi.content || metaDoi.getAttribute('content');

  // 2. Scan for DOI links
  const doiLink = document.querySelector('a[href*="doi.org/"]');
  if (doiLink) {
    const match = doiLink.href.match(/10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+/);
    if (match) return match[0];
  }

  // 3. Regex scan (Low confidence)
  const bodyText = document.body.innerText;
  const match = bodyText.match(/10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+/);
  return match ? match[0] : null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_METADATA') {
    const doi = extractDOI();
    sendResponse({
      doi: doi,
      title: document.title,
      url: window.location.href,
      published: new Date().getFullYear().toString()
    });
  }
});
