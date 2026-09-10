const GUMROAD_PRODUCT_PERMALINK = "https://vixenhavoc1.gumroad.com/l/mqseou";
const GUMROAD_BUY_URL = "https://vixenhavoc1.gumroad.com/l/mqseou?wanted=true";
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  rules: [],
  masterEnabled: true,
  activity: [],
  webhookHistory: [],
  editingId: null,
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function timeAgo(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

async function loadAll() {
  const data = await chrome.storage.local.get(["rules", "masterEnabled", "activity", "webhookHistory"]);
  state.rules = data.rules ?? [];
  state.masterEnabled = data.masterEnabled ?? true;
  state.activity = data.activity ?? [];
  state.webhookHistory = data.webhookHistory ?? [];
  render();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.activity) {
    state.activity = changes.activity.newValue ?? [];
    renderActivity();
  }
});

async function saveRules() {
  await chrome.storage.local.set({ rules: state.rules });
}

/* ---------------- tabs ---------------- */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    $$(".view").forEach((v) => v.classList.remove("active"));
    $(`#view-${tab.dataset.tab}`).classList.add("active");
  });
});

/* ---------------- master toggle ---------------- */
$("#masterToggle").addEventListener("change", async (e) => {
  state.masterEnabled = e.target.checked;
  await chrome.storage.local.set({ masterEnabled: state.masterEnabled });
  $("#statusLine").textContent = state.masterEnabled ? "Intercepting on this tab" : "Interception paused";
});

/* ---------------- rule form ---------------- */
function resetForm() {
  $("#f-name").value = "";
  $("#f-method").value = "ANY";
  $("#f-matchtype").value = "contains";
  $("#f-match").value = "";
  $("#f-status").value = 200;
  $("#f-delay").value = 0;
  $("#f-bodytype").value = "json";
  $("#f-body").value = '{\n  "ok": true\n}';
  state.editingId = null;
}

$("#newRuleBtn").addEventListener("click", () => {
  resetForm();
  $("#ruleForm").classList.remove("hidden");
});
$("#cancelRuleBtn").addEventListener("click", () => {
  $("#ruleForm").classList.add("hidden");
});

$("#saveRuleBtn").addEventListener("click", async () => {
  const match = $("#f-match").value.trim();
  if (!match) { $("#f-match").focus(); return; }

  const rule = {
    id: state.editingId ?? uid(),
    name: $("#f-name").value.trim(),
    method: $("#f-method").value,
    matchType: $("#f-matchtype").value,
    match,
    status: Number($("#f-status").value) || 200,
    delayMs: Number($("#f-delay").value) || 0,
    bodyType: $("#f-bodytype").value,
    body: $("#f-body").value,
    headers: {},
    enabled: true,
  };

  const idx = state.rules.findIndex((r) => r.id === rule.id);
  if (idx >= 0) {
    rule.enabled = state.rules[idx].enabled;
    state.rules[idx] = rule;
  } else {
    state.rules.unshift(rule);
  }

  await saveRules();
  $("#ruleForm").classList.add("hidden");
  renderRules();
});

function editRule(id) {
  const rule = state.rules.find((r) => r.id === id);
  if (!rule) return;
  state.editingId = id;
  $("#f-name").value = rule.name || "";
  $("#f-method").value = rule.method;
  $("#f-matchtype").value = rule.matchType;
  $("#f-match").value = rule.match;
  $("#f-status").value = rule.status;
  $("#f-delay").value = rule.delayMs;
  $("#f-bodytype").value = rule.bodyType;
  $("#f-body").value = rule.body;
  $("#ruleForm").classList.remove("hidden");
}

async function toggleRule(id) {
  const rule = state.rules.find((r) => r.id === id);
  if (!rule) return;
  rule.enabled = !rule.enabled;
  await saveRules();
  renderRules();
}

async function deleteRule(id) {
  state.rules = state.rules.filter((r) => r.id !== id);
  await saveRules();
  renderRules();
}

/* ---------------- render: rules ---------------- */
function renderRules() {
  const list = $("#ruleList");
  list.innerHTML = "";
  $("#ruleCount").textContent = `${state.rules.length} rule${state.rules.length === 1 ? "" : "s"}`;
  $("#emptyRules").style.display = state.rules.length ? "none" : "block";

  for (const rule of state.rules) {
    const li = document.createElement("li");
    li.className = `rule-card ${rule.enabled ? "on" : "off"}`;
    li.innerHTML = `
      <span class="method">${rule.method}</span>
      <span class="info">
        <span class="name">${escapeHtml(rule.name || rule.match)}</span><br/>
        <span class="pattern">${escapeHtml(rule.match)}</span>
      </span>
      <span class="status-tag">${rule.status}</span>
      <span class="actions">
        <button class="icon-btn toggle" title="${rule.enabled ? "Disable" : "Enable"}">${rule.enabled ? "On" : "Off"}</button>
        <button class="icon-btn edit" title="Edit">Edit</button>
        <button class="icon-btn danger del" title="Delete">Del</button>
      </span>
    `;
    li.querySelector(".toggle").addEventListener("click", () => toggleRule(rule.id));
    li.querySelector(".edit").addEventListener("click", () => editRule(rule.id));
    li.querySelector(".del").addEventListener("click", () => deleteRule(rule.id));
    list.appendChild(li);
  }
}

function renderActivity() {
  const list = $("#activityList");
  list.innerHTML = "";
  $("#emptyActivity").style.display = state.activity.length ? "none" : "block";
  for (const entry of state.activity.slice(0, 20)) {
    const li = document.createElement("li");
    li.className = "activity-item";
    li.innerHTML = `
      <span class="status-dot"></span>
      <span class="url">${escapeHtml(entry.method)} ${escapeHtml(entry.url)}</span>
      <span class="when">${timeAgo(entry.ts)}</span>
    `;
    list.appendChild(li);
  }
}

/* ---------------- webhooks ---------------- */
function addHeaderRow(key = "", value = "") {
  const row = document.createElement("div");
  row.className = "header-row";
  row.innerHTML = `
    <input type="text" class="mono h-key" placeholder="Header-Name" value="${escapeHtml(key)}" />
    <input type="text" class="mono h-val" placeholder="value" value="${escapeHtml(value)}" />
    <button class="icon-btn danger h-del">Del</button>
  `;
  row.querySelector(".h-del").addEventListener("click", () => row.remove());
  $("#headerRows").appendChild(row);
}

$("#addHeaderBtn").addEventListener("click", () => addHeaderRow());

$("#prettifyBtn").addEventListener("click", () => {
  const el = $("#w-body");
  try {
    el.value = JSON.stringify(JSON.parse(el.value), null, 2);
  } catch (e) {
    // leave as-is if not valid JSON
  }
});

function collectHeaders() {
  const headers = {};
  $$(".header-row").forEach((row) => {
    const k = row.querySelector(".h-key").value.trim();
    const v = row.querySelector(".h-val").value;
    if (k) headers[k] = v;
  });
  return headers;
}

$("#sendWebhookBtn").addEventListener("click", async () => {
  const url = $("#w-url").value.trim();
  if (!url) { $("#w-url").focus(); return; }
  const method = $("#w-method").value;
  const headers = collectHeaders();
  const body = $("#w-body").value;

  const btn = $("#sendWebhookBtn");
  btn.disabled = true;
  btn.textContent = "Sending…";

  const record = await chrome.runtime.sendMessage({
    type: "SEND_WEBHOOK",
    payload: { url, method, headers, body },
  });

  btn.disabled = false;
  btn.textContent = "Send payload";

  showResponse(record);
  const data = await chrome.storage.local.get("webhookHistory");
  state.webhookHistory = data.webhookHistory ?? [];
  renderHistory();
});

function showResponse(record) {
  const panel = $("#responsePanel");
  panel.classList.remove("hidden");
  const pill = $("#respStatus");
  if (record.ok) {
    pill.textContent = `${record.status} ${record.statusText || ""}`.trim();
    pill.className = "status-pill ok";
  } else {
    pill.textContent = "Failed";
    pill.className = "status-pill fail";
  }
  $("#respDuration").textContent = `${record.durationMs}ms`;
  $("#respBody").textContent = record.ok ? (record.responseBody || "(empty body)") : record.error;
}

function renderHistory() {
  const list = $("#historyList");
  list.innerHTML = "";
  $("#emptyHistory").style.display = state.webhookHistory.length ? "none" : "block";
  for (const rec of state.webhookHistory.slice(0, 20)) {
    const li = document.createElement("li");
    li.className = "history-item";
    const badgeClass = rec.ok ? "ok" : "fail";
    const badgeText = rec.ok ? rec.status : "ERR";
    li.innerHTML = `
      <span class="badge ${badgeClass}">${badgeText}</span>
      <span class="url">${escapeHtml(rec.method)} ${escapeHtml(rec.url)}</span>
      <span class="when">${timeAgo(rec.ts)}</span>
    `;
    li.addEventListener("click", () => {
      $("#w-method").value = rec.method;
      $("#w-url").value = rec.url;
      $("#w-body").value = rec.body || "";
      $("#headerRows").innerHTML = "";
      Object.entries(rec.headers || {}).forEach(([k, v]) => addHeaderRow(k, v));
      showResponse(rec);
      $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === "webhooks"));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-webhooks"));
    });
    list.appendChild(li);
  }
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function render() {
  $("#masterToggle").checked = state.masterEnabled;
  $("#statusLine").textContent = state.masterEnabled ? "Intercepting on this tab" : "Interception paused";
  renderRules();
  renderActivity();
  renderHistory();
  if (!$$(".header-row").length) addHeaderRow("Content-Type", "application/json");
}

loadAll();
