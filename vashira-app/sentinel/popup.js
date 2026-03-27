// Mastery 9.0: Sentinel Logic
document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');
  const scannedInfo = document.getElementById('scanned-info');
  const success = document.getElementById('success');
  const hostStatus = document.getElementById('host-status');
  const ingestBtn = document.getElementById('ingest-btn');

  let currentMetadata = null;

  // 1. Check Sovereign Node Connection
  fetch('http://127.0.0.1:51239/', { method: 'OPTIONS' })
    .then(() => {
      hostStatus.innerText = 'Sovereign Node: ONLINE';
      hostStatus.style.color = '#10b981';
    })
    .catch(() => {
      hostStatus.innerText = 'Sovereign Node: OFFLINE (Check Vashira App)';
      hostStatus.style.color = '#ef4444';
      ingestBtn.disabled = true;
      ingestBtn.style.opacity = 0.5;
    });

  // 2. Request Metadata from Scraper
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getMetadata" }, (response) => {
      if (response) {
        currentMetadata = response;
        document.getElementById('item-title').innerText = response.title || "Unknown Title";
        document.getElementById('item-authors').innerText = response.authors || "Authors not detected";
        document.getElementById('item-doi').innerText = response.doi ? `DOI: \${response.doi}` : `URL: Local Snapshot`;
        
        loading.classList.add('hidden');
        scannedInfo.classList.remove('hidden');
      } else {
        loading.innerText = "No research detected on page.";
      }
    });
  });

  // 3. Ingest Logic
  ingestBtn.addEventListener('click', () => {
    if (!currentMetadata) return;

    ingestBtn.innerText = "MASTERING...";
    ingestBtn.disabled = true;

    fetch('http://127.0.0.1:51239/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentMetadata)
    })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        scannedInfo.classList.add('hidden');
        success.classList.remove('hidden');
      } else {
        alert("Mastery failed: " + data.error);
        ingestBtn.innerText = "RETRY MASTER";
        ingestBtn.disabled = false;
      }
    })
    .catch(() => {
      alert("Lost connection to Sovereign Node.");
      ingestBtn.innerText = "RETRY MASTER";
      ingestBtn.disabled = false;
    });
  });
});
