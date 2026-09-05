const STORAGE_KEY = "shortify_link_history";
const MAX_HISTORY = 10;

// Element references
const form = document.getElementById("shorten-form");
const longUrlInput = document.getElementById("long-url");
const customAliasInput = document.getElementById("custom-alias");
const expiresAtInput = document.getElementById("expires-at");
const submitBtn = document.getElementById("submit-btn");
const urlError = document.getElementById("url-error");
const resultCard = document.getElementById("result-card");
const resultLink = document.getElementById("result-link");
const resultOriginal = document.getElementById("result-original");
const copyBtn = document.getElementById("copy-btn");
const copyLabel = document.getElementById("copy-label");
const qrBtn = document.getElementById("qr-btn");
const statsBtn = document.getElementById("stats-btn");
const historyCard = document.getElementById("history-card");
const historyList = document.getElementById("history-list");
const historyCount = document.getElementById("history-count");
const toast = document.getElementById("toast");

// Modals
const qrModal = document.getElementById("qr-modal");
const qrModalClose = document.getElementById("qr-modal-close");
const qrContainer = document.getElementById("qr-container");
const qrModalUrl = document.getElementById("qr-modal-url");
const downloadQrBtn = document.getElementById("download-qr-btn");

const statsModal = document.getElementById("stats-modal");
const statsModalClose = document.getElementById("stats-modal-close");
const statClicks = document.getElementById("stat-clicks");
const statStatus = document.getElementById("stat-status");
const statCreated = document.getElementById("stat-created");
const statExpires = document.getElementById("stat-expires");

let currentShortData = null;

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.className = "toast show" + (isError ? " error" : "");
  toast.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 3000);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.querySelector(".btn-text").hidden = loading;
  submitBtn.querySelector(".btn-spinner").hidden = !loading;
}

function showError(message) {
  urlError.textContent = message;
  urlError.hidden = !message;
}

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveToHistory(entry) {
  const history = getHistory().filter((h) => h.short_code !== entry.short_code);
  history.unshift(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  renderHistory();
}

function renderHistory() {
  const history = getHistory();
  if (!history.length) {
    historyCard.hidden = true;
    return;
  }

  historyCard.hidden = false;
  historyCount.textContent = `${history.length} saved`;
  historyList.innerHTML = history
    .map(
      (item) => `
    <li class="history-item">
      <a href="${item.short_url}" class="history-short" target="_blank" rel="noopener noreferrer">${item.short_code}</a>
      <span class="history-original" title="${escapeHtml(item.long_url)}">${escapeHtml(item.long_url)}</span>
      <div class="history-actions">
        <button type="button" class="history-btn history-copy-btn" data-url="${escapeHtml(item.short_url)}" title="Copy Link">Copy</button>
        <button type="button" class="history-btn history-stats-btn" data-code="${escapeHtml(item.short_code)}" title="View Stats">Stats</button>
      </div>
    </li>`
    )
    .join("");

  historyList.querySelectorAll(".history-copy-btn").forEach((btn) => {
    btn.addEventListener("click", () => copyText(btn.dataset.url));
  });

  historyList.querySelectorAll(".history-stats-btn").forEach((btn) => {
    btn.addEventListener("click", () => fetchAndShowStats(btn.dataset.code));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard!");
    return true;
  } catch {
    showToast("Could not copy — please select manually", true);
    return false;
  }
}

function showResult(data) {
  currentShortData = data;
  resultLink.href = data.short_url;
  resultLink.textContent = data.short_url;
  resultOriginal.textContent = data.long_url;
  resultCard.hidden = false;
  copyBtn.classList.remove("copied");
  copyLabel.textContent = "Copy Link";
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  saveToHistory(data);
}

// QR Code Generator
function generateQRCode(url) {
  qrContainer.innerHTML = "";
  if (window.qrcode) {
    const typeNumber = 0; // Auto detect
    const errorCorrectionLevel = 'H'; // High
    const qr = window.qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(url);
    qr.make();
    qrContainer.innerHTML = qr.createImgTag(5, 10);
  } else {
    const img = document.createElement("img");
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
    img.alt = "QR Code";
    qrContainer.appendChild(img);
  }
  qrModalUrl.textContent = url;
  qrModal.hidden = false;
}

// Fetch Stats from API
async function fetchAndShowStats(shortCode) {
  try {
    let res = await fetch(`/api/v1/urls/${shortCode}`);
    if (res.status === 404) {
      res = await fetch(`/v1/urls/${shortCode}`);
    }

    if (!res.ok) {
      showToast("Could not fetch stats for this link.", true);
      return;
    }
    const data = await res.json();
    statClicks.textContent = data.click_count || 0;
    statStatus.textContent = data.is_active ? "Active" : "Inactive";
    statStatus.className = "stat-value " + (data.is_active ? "status-active" : "error");
    statCreated.textContent = data.created_at ? new Date(data.created_at).toLocaleString() : "-";
    statExpires.textContent = data.expires_at ? new Date(data.expires_at).toLocaleString() : "Never";
    statsModal.hidden = false;
  } catch {
    showToast("Network error fetching stats.", true);
  }
}

// Event Listeners
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError("");

  const rawUrl = longUrlInput.value.trim();
  if (!rawUrl) {
    showError("Please enter a destination URL.");
    longUrlInput.focus();
    return;
  }

  const longUrl = normalizeUrl(rawUrl);
  try {
    new URL(longUrl);
  } catch {
    showError("Please enter a valid HTTP/HTTPS URL.");
    return;
  }

  const payload = { long_url: longUrl };

  const alias = customAliasInput.value.trim();
  if (alias) {
    if (!/^[A-Za-z0-9_-]{3,20}$/.test(alias)) {
      showError("Custom alias must be 3–20 characters (letters, numbers, hyphens & underscores).");
      return;
    }
    payload.custom_alias = alias;
  }

  if (expiresAtInput.value) {
    payload.expires_at = new Date(expiresAtInput.value).toISOString();
  }

  setLoading(true);

  try {
    let res = await fetch("/api/v1/urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      res = await fetch("/v1/urls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      const detail = body.detail;
      const message = typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d) => d.msg).join(", ")
          : "Something went wrong. Please try again.";
      showError(message);
      showToast(message, true);
      return;
    }

    showResult(body);
    showToast("Short link created & stored in Supabase!");
  } catch {
    showError("Network error. Is the server running?");
    showToast("Network error — check connection.", true);
  } finally {
    setLoading(false);
  }
});

copyBtn.addEventListener("click", async () => {
  if (!currentShortData) return;
  const ok = await copyText(currentShortData.short_url);
  if (ok) {
    copyBtn.classList.add("copied");
    copyLabel.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.classList.remove("copied");
      copyLabel.textContent = "Copy Link";
    }, 2000);
  }
});

qrBtn.addEventListener("click", () => {
  if (currentShortData) {
    generateQRCode(currentShortData.short_url);
  }
});

statsBtn.addEventListener("click", () => {
  if (currentShortData) {
    fetchAndShowStats(currentShortData.short_code);
  }
});

// Modal close handlers
qrModalClose.addEventListener("click", () => { qrModal.hidden = true; });
statsModalClose.addEventListener("click", () => { statsModal.hidden = true; });

qrModal.addEventListener("click", (e) => {
  if (e.target === qrModal) qrModal.hidden = true;
});
statsModal.addEventListener("click", (e) => {
  if (e.target === statsModal) statsModal.hidden = true;
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    qrModal.hidden = true;
    statsModal.hidden = true;
  }
});

downloadQrBtn.addEventListener("click", () => {
  const img = qrContainer.querySelector("img");
  if (img) {
    const a = document.createElement("a");
    a.href = img.src;
    a.download = `shortify-qr-${currentShortData ? currentShortData.short_code : 'code'}.png`;
    a.click();
    showToast("Downloading QR code image...");
  }
});

renderHistory();
longUrlInput.focus();
