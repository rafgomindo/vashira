/**
 * Vashira Snatcher-X Background Worker
 */

chrome.runtime.onMessage.addListener(async (message) => {
  if (message.type === 'MASTER_PAGE') {
    try {
      const response = await fetch('http://localhost:51235', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message.data)
      });

      if (response.ok) {
        chrome.action.setBadgeText({ text: 'OK' });
        setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000);
      }
    } catch (e) {
      console.error('[Snatcher-X] Vashira Hub unreachable. Is the app open?', e);
    }
  }
});
