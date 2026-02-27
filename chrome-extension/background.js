// background.js — Makro BuyBox Pro
// Handles page_scraped messages from content.js to notify bridge queue

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  if (msg.action === 'page_scraped') {
    // Content.js finished scraping a page — tell all dashboard tabs so bridge advances queue
    chrome.tabs.query({ url: 'https://davidbard1226.github.io/*' }, function(tabs) {
      tabs.forEach(function(tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'page_scraped_notify', data: msg.data }, function() {
          if (chrome.runtime.lastError) {} // ignore — bridge tab may not have listener
        });
      });
    });
    // Also fire storage change so bridge.js onChanged picks it up
    sendResponse({ ok: true });
    return true;
  }
});
