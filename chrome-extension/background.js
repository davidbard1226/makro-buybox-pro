// background.js — Makro BuyBox Pro
chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.action === 'ping') { sendResponse({ pong: true }); return true; }
  sendResponse({ ok: true });
  return true;
});
