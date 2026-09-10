// Runs in the page's MAIN world (Chrome 111+). Has no access to chrome.* APIs,
// so rules arrive via window.postMessage from content-bridge.js (isolated world).
(() => {
  const CHANNEL = "__payload_sidecar__";
  let rules = [];
  let masterEnabled = true;

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    const msg = event.data;
    if (!msg || msg.channel !== CHANNEL) return;
    if (msg.type === "SYNC_RULES") {
      rules = Array.isArray(msg.rules) ? msg.rules : [];
      masterEnabled = msg.masterEnabled !== false;
    }
  });

  function report(entry) {
    window.postMessage({ channel: CHANNEL, type: "MOCK_HIT", entry }, "*");
  }

  function matchRule(url, method) {
    if (!masterEnabled) return null;
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (rule.method && rule.method !== "ANY" && rule.method !== method) continue;
      try {
        if (rule.matchType === "regex") {
          const re = new RegExp(rule.match);
          if (!re.test(url)) continue;
        } else {
          if (!url.includes(rule.match)) continue;
        }
      } catch (e) {
        continue; // bad regex, skip rule rather than throw
      }
      return rule;
    }
    return null;
  }

  function buildResponseBody(rule) {
    if (rule.bodyType === "json") {
      try {
        return JSON.stringify(JSON.parse(rule.body || "{}"));
      } catch (e) {
        return rule.body || "";
      }
    }
    return rule.body || "";
  }

  // ---- fetch ----
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === "string" ? input : input && input.url;
    const method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
    const rule = url ? matchRule(url, method) : null;

    if (!rule) return nativeFetch(input, init);

    const delay = Number(rule.delayMs) || 0;
    const bodyText = buildResponseBody(rule);
    const headers = new Headers(rule.headers || {});
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", rule.bodyType === "json" ? "application/json" : "text/plain");
    }

    report({ url, method, ruleName: rule.name || rule.match, status: rule.status, ts: Date.now() });

    if (delay) await new Promise((r) => setTimeout(r, delay));

    return new Response(bodyText, {
      status: Number(rule.status) || 200,
      statusText: rule.statusText || "",
      headers,
    });
  };

  // ---- XMLHttpRequest ----
  const NativeXHR = window.XMLHttpRequest;
  function PatchedXHR() {
    const xhr = new NativeXHR();
    let _url = "";
    let _method = "GET";
    let _rule = null;

    const open = xhr.open.bind(xhr);
    xhr.open = function (method, url, ...rest) {
      _method = (method || "GET").toUpperCase();
      _url = url;
      _rule = matchRule(String(url), _method);
      if (_rule) {
        // Still call open so xhr is in a valid state, but we intercept send().
        return open(method, url, ...rest);
      }
      return open(method, url, ...rest);
    };

    const send = xhr.send.bind(xhr);
    xhr.send = function (body) {
      if (!_rule) return send(body);

      const rule = _rule;
      const delay = Number(rule.delayMs) || 0;
      const bodyText = buildResponseBody(rule);
      const status = Number(rule.status) || 200;

      report({ url: _url, method: _method, ruleName: rule.name || rule.match, status, ts: Date.now() });

      setTimeout(() => {
        Object.defineProperty(xhr, "readyState", { value: 4, configurable: true });
        Object.defineProperty(xhr, "status", { value: status, configurable: true });
        Object.defineProperty(xhr, "statusText", { value: rule.statusText || "", configurable: true });
        Object.defineProperty(xhr, "responseText", { value: bodyText, configurable: true });
        Object.defineProperty(xhr, "response", { value: bodyText, configurable: true });
        Object.defineProperty(xhr, "getAllResponseHeaders", {
          value: () =>
            Object.entries(rule.headers || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join("\r\n"),
          configurable: true,
        });
        xhr.dispatchEvent(new Event("readystatechange"));
        xhr.dispatchEvent(new Event("load"));
        xhr.dispatchEvent(new Event("loadend"));
      }, delay);
    };

    return xhr;
  }
  PatchedXHR.prototype = NativeXHR.prototype;
  window.XMLHttpRequest = PatchedXHR;

  window.postMessage({ channel: CHANNEL, type: "READY" }, "*");
})();
