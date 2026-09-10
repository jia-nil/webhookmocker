# Payload Sidecar — Webhook & API Payload Mocking

## Load it in Chrome
1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Click the extensions puzzle icon in the toolbar, pin **Payload Sidecar**
5. Click its icon to open the side panel

## Mocks tab
- **New rule**: match by URL substring or regex, pick a method, status code,
  optional delay, and a JSON/text response body.
- Rules apply to `fetch` and `XMLHttpRequest` on every page — nothing leaves
  the browser or hits the real network once a rule matches.
- The top-right switch pauses all interception without deleting your rules.
- **Recent activity** shows which requests got mocked, in real time.

## Webhooks tab
- Compose a method, URL, headers, and JSON/text body, then **Send payload**
  to fire a real HTTP request (sent from the extension's background worker,
  so it isn't blocked by page CORS/CSP).
- The response (status, timing, body) shows below the composer.
- **Send history** logs the last 50 sends — click one to reload it into the
  composer and resend or tweak it.

## Notes
- Rules and history are stored locally via `chrome.storage.local` — nothing
  is synced or sent anywhere by the extension itself.
- Because interception patches `fetch`/`XMLHttpRequest` in the page, it
  needs `document_start` injection, so give the tab a full reload after
  installing or after changing a rule pattern.
