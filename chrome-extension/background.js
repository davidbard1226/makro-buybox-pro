// background.js — Makro BuyBox Pro
// Background CAN create tabs freely — relay requests from bridge content script

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  // Bridge asks background to create a tab
  if (msg.action === 'create_tab') {
    chrome.tabs.create({ url: msg.url, active: false }, function(tab) {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ tabId: tab.id });
      }
    });
    return true; // async
  }

  // Bridge asks background to update an existing tab
  if (msg.action === 'update_tab') {
    chrome.tabs.update(msg.tabId, { url: msg.url, active: false }, function(tab) {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ tabId: msg.tabId });
      }
    });
    return true;
  }

  // Bridge asks background to close a tab
  if (msg.action === 'remove_tab') {
    chrome.tabs.remove(msg.tabId, function() {});
    sendResponse({ ok: true });
    return true;
  }

  sendResponse({ ok: true });
  return true;
});
