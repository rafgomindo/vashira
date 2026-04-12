/**
 * Vashira Sentinel Background Worker
 */

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'MASTER_PAGE') {
    chrome.action.setBadgeText({ text: 'SAV' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });

    try {
      const response = await fetch('http://localhost:51235', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data)
      });

      if (response.ok) {
        chrome.action.setBadgeText({ text: 'OK' });
        chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
      } else {
        throw new Error('Save failed');
      }
    } catch (e) {
      console.error('[Sentinel] Vashira Hub unreachable or error:', e);
      chrome.action.setBadgeText({ text: 'ERR' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
    }
  }
});

