// Isolated world: has chrome.* access, relays rules to the MAIN-world injected.js
// via postMessage, and forwards mock-hit reports to the background service worker.
(() => {
  const CHANNEL = "__payload_sidecar__";

  async function pushRules() {
    const { rules = [], masterEnabled = true } = await chrome.storage.local.get(["rules", "masterEnabled"]);
    window.postMessage({ channel: CHANNEL, type: "SYNC_RULES", rules, masterEnabled }, "*");
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.rules || changes.masterEnabled) pushRules();
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL) return;
    if (msg.type === "READY") {
      pushRules();
    } else if (msg.type === "MOCK_HIT") {
      chrome.runtime.sendMessage({ type: "MOCK_HIT", entry: { ...msg.entry, pageUrl: location.href } });
    }
  });
})();
