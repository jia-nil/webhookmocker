const MAX_LOG = 100;
const MAX_HISTORY = 50;

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["rules", "masterEnabled", "activity", "webhookHistory"]);
  const defaults = {
    rules: existing.rules ?? [],
    masterEnabled: existing.masterEnabled ?? true,
    activity: existing.activity ?? [],
    webhookHistory: existing.webhookHistory ?? [],
  };
  await chrome.storage.local.set(defaults);
});

// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Payload Sidecar: setPanelBehavior failed", err));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "MOCK_HIT") {
    (async () => {
      const { activity = [] } = await chrome.storage.local.get("activity");
      activity.unshift(msg.entry);
      await chrome.storage.local.set({ activity: activity.slice(0, MAX_LOG) });
    })();
    return false;
  }

  if (msg?.type === "SEND_WEBHOOK") {
    (async () => {
      const { url, method, headers, body } = msg.payload;
      const started = performance.now();
      let result;
      try {
        const res = await fetch(url, {
          method,
          headers: headers || {},
          body: method === "GET" || method === "HEAD" ? undefined : body,
        });
        const text = await res.text();
        result = {
          ok: true,
          status: res.status,
          statusText: res.statusText,
          durationMs: Math.round(performance.now() - started),
          responseBody: text,
          ts: Date.now(),
        };
      } catch (err) {
        result = {
          ok: false,
          error: String(err && err.message ? err.message : err),
          durationMs: Math.round(performance.now() - started),
          ts: Date.now(),
        };
      }

      const record = { url, method, headers, body, ...result };
      const { webhookHistory = [] } = await chrome.storage.local.get("webhookHistory");
      webhookHistory.unshift(record);
      await chrome.storage.local.set({ webhookHistory: webhookHistory.slice(0, MAX_HISTORY) });

      sendResponse(record);
    })();
    return true; // keep the message channel open for the async sendResponse
  }
});
