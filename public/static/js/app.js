const { useState, useEffect, useCallback, useRef } = React;

const STORAGE_KEY = "shortify_link_history";
const MAX_HISTORY = 10;

function normalizeUrl(value) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function extractDomain(urlStr) {
  if (!urlStr) return "";
  try {
    const full = normalizeUrl(urlStr);
    const parsed = new URL(full);
    return parsed.hostname;
  } catch {
    return "";
  }
}

function App() {
  const [longUrl, setLongUrl] = useState("");
  const [customAlias, setCustomAlias] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentResult, setCurrentResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'qr' | 'stats' | null
  const [selectedLinkData, setSelectedLinkData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }, []);

  // Save to history helper
  const saveToHistory = useCallback((entry) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.short_code !== entry.short_code);
      const updated = [entry, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error("Failed to save history:", e);
      }
      return updated;
    });
  }, []);

  // Toast Handler
  const showToast = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  }, []);

  // Paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setLongUrl(text);
        setErrorMessage("");
        showToast("Pasted from clipboard!");
      }
    } catch {
      showToast("Please allow clipboard access to paste.", true);
    }
  };

  // Copy URL
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied to clipboard!");
      return true;
    } catch {
      showToast("Could not copy — please select manually", true);
      return false;
    }
  };

  const handleCopyResult = async () => {
    if (!currentResult) return;
    const ok = await copyText(currentResult.short_url);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Fetch Link Telemetry Stats
  const fetchStats = async (shortCode) => {
    setStatsLoading(true);
    setStatsData(null);
    setSelectedLinkData({ short_code: shortCode });
    setActiveModal("stats");

    try {
      let res = await fetch(`/api/v1/urls/${shortCode}`);
      if (res.status === 404) res = await fetch(`/v1/urls/${shortCode}`);
      if (res.status === 404) res = await fetch(`/urls/${shortCode}`);

      if (!res.ok) {
        showToast("Could not fetch stats for this link.", true);
        setActiveModal(null);
        return;
      }
      const data = await res.json();
      setStatsData(data);
    } catch {
      showToast("Network error fetching stats.", true);
      setActiveModal(null);
    } finally {
      setStatsLoading(false);
    }
  };

  // Open QR Code Modal
  const openQrModal = (item) => {
    setSelectedLinkData(item);
    setActiveModal("qr");
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const rawUrl = longUrl.trim();
    if (!rawUrl) {
      setErrorMessage("Please enter a destination URL.");
      return;
    }

    const fullUrl = normalizeUrl(rawUrl);
    try {
      new URL(fullUrl);
    } catch {
      setErrorMessage("Please enter a valid HTTP/HTTPS URL.");
      return;
    }

    const payload = { long_url: fullUrl };

    const alias = customAlias.trim();
    if (alias) {
      if (!/^[A-Za-z0-9_-]{3,20}$/.test(alias)) {
        setErrorMessage("Custom alias must be 3–20 characters (letters, numbers, hyphens & underscores).");
        return;
      }
      payload.custom_alias = alias;
    }

    if (expiresAt) {
      payload.expires_at = new Date(expiresAt).toISOString();
    }

    setIsLoading(true);

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

      if (res.status === 404) {
        res = await fetch("/urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        const detail = body.detail;
        const msg = typeof detail === "string"
          ? detail
          : Array.isArray(detail)
            ? detail.map((d) => d.msg).join(", ")
            : "Something went wrong. Please try again.";
        setErrorMessage(msg);
        showToast(msg, true);
        return;
      }

      setCurrentResult(body);
      saveToHistory(body);
      showToast("Short link created & stored in Supabase!");
    } catch (err) {
      setErrorMessage("Network error. Is the server running?");
      showToast("Network error — check connection.", true);
    } finally {
      setIsLoading(false);
    }
  };

  const domain = extractDomain(longUrl);

  return (
    <div className="app-layout">
      {/* SaaS Navbar */}
      <header className="navbar">
        <div className="navbar-container">
          <a href="#" className="brand">
            <div className="brand-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span>Shortify</span>
            <span className="brand-version">v2.4</span>
          </a>
          <nav className="nav-links">
            <a href="https://github.com/iaditya2307/Shortify" target="_blank" rel="noopener noreferrer" className="nav-link">GitHub</a>
            <a href="/docs" className="nav-link">API Docs</a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">URL Shortener & Analytics</h1>
          <p className="page-description">
            Shorten long links, set custom aliases, and inspect real-time click telemetry using Supabase PostgreSQL persistence.
          </p>
        </div>

        {/* Shortener Form Panel */}
        <div className="panel">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="long-url" className="form-label">
                Destination URL <span style={{ color: "var(--error)" }}>*</span>
              </label>
              <div className="input-row">
                <div className="input-container">
                  <input
                    type="text"
                    id="long-url"
                    className="form-control input-mono"
                    placeholder="https://example.com/very-long-url-path..."
                    value={longUrl}
                    onChange={(e) => {
                      setLongUrl(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn-input-action"
                    onClick={handlePaste}
                    title="Paste from clipboard"
                  >
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Paste</span>
                  </button>
                </div>

                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? (
                    <span className="btn-spinner"></span>
                  ) : (
                    <>
                      <span>Shorten</span>
                      <kbd className="shortcut-kbd">↵</kbd>
                    </>
                  )}
                </button>
              </div>

              {domain && (
                <div className="domain-preview">
                  <span className="preview-label">Domain:</span>
                  <span className="preview-domain">{domain}</span>
                </div>
              )}

              {errorMessage && <p className="form-error">{errorMessage}</p>}
            </div>

            {/* Advanced Options Accordion */}
            <details
              className="options-drawer"
              open={showOptions}
              onToggle={(e) => setShowOptions(e.target.open)}
            >
              <summary className="drawer-toggle">
                <svg
                  className="toggle-icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span>Advanced Options (Custom Alias, Expiration)</span>
              </summary>

              <div className="drawer-body grid-2col">
                <div className="form-group">
                  <label className="form-label">
                    Custom Alias <span className="label-optional">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="my-custom-alias"
                    value={customAlias}
                    onChange={(e) => setCustomAlias(e.target.value)}
                  />
                  <p className="form-hint">3–20 characters (letters, numbers, hyphen, underscore)</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Expiration Date <span className="label-optional">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="form-hint">Link expires automatically after date</p>
                </div>
              </div>
            </details>
          </form>
        </div>

        {/* Result Panel */}
        {currentResult && (
          <div className="panel result-panel">
            <div className="result-header">
              <div className="result-status">
                <span className="status-indicator"></span>
                <span className="status-title">Short Link Active</span>
              </div>
              <span className="badge-subtle">Stored in Supabase</span>
            </div>

            <div className="result-body">
              <div className="result-url-wrapper">
                <a
                  href={currentResult.short_url}
                  className="result-url"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {currentResult.short_url}
                </a>
              </div>

              <div className="result-actions">
                <button
                  type="button"
                  className={`btn btn-secondary ${copySuccess ? "btn-copy copied" : "btn-copy"}`}
                  onClick={handleCopyResult}
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>{copySuccess ? "Copied!" : "Copy"}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openQrModal(currentResult)}
                >
                  QR Code
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => fetchStats(currentResult.short_code)}
                >
                  Stats
                </button>
              </div>
            </div>

            <div className="result-meta">
              <span>Destination:</span>
              <span className="meta-value">{currentResult.long_url}</span>
            </div>
          </div>
        )}

        {/* History Table */}
        {history.length > 0 && (
          <section className="section">
            <div className="section-header">
              <div>
                <h2 className="section-title">Link History</h2>
                <p className="section-desc">Shortened URLs saved in your browser session.</p>
              </div>
              <span className="badge-count">
                {history.length} link{history.length === 1 ? "" : "s"}
              </span>
            </div>

            <div className="table-container">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Short Link</th>
                    <th>Destination</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.short_code}>
                      <td className="col-short">
                        <a
                          href={item.short_url}
                          className="link-primary"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.short_code}
                        </a>
                      </td>
                      <td className="col-long" title={item.long_url}>
                        {item.long_url}
                      </td>
                      <td className="text-right">
                        <button
                          type="button"
                          className="btn-table"
                          style={{ marginRight: "0.4rem" }}
                          onClick={() => copyText(item.short_url)}
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          className="btn-table"
                          onClick={() => fetchStats(item.short_code)}
                        >
                          Stats
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Specifications Grid */}
        <section className="specs-grid">
          <div className="spec-card">
            <h3 className="spec-title">⚡ Cryptographic Base62</h3>
            <p className="spec-text">Non-predictable 7-character random Base62 codes generated with CSPRNG and optimistic DB collision retries.</p>
          </div>
          <div className="spec-card">
            <h3 className="spec-title">🗄️ Supabase PostgreSQL</h3>
            <p className="spec-text">Persistent cloud database storage with real-time click counter increments.</p>
          </div>
          <div className="spec-card">
            <h3 className="spec-title">📊 QR Code & Analytics</h3>
            <p className="spec-text">Instant high-res QR generation and live click telemetry endpoint.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <p className="footer-text">Shortify &copy; 2026. Built with FastAPI & React.</p>
          <div className="footer-links">
            <a href="https://github.com/iaditya2307/Shortify" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <span className="footer-divider">•</span>
            <a href="/docs">Docs</a>
          </div>
        </div>
      </footer>

      {/* Toast Notification */}
      <div className={`toast-notification ${toast ? "show" : ""} ${toast && toast.isError ? "error" : ""}`}>
        {toast ? toast.message : ""}
      </div>

      {/* QR Code Modal */}
      {activeModal === "qr" && selectedLinkData && (
        <QrModal
          linkData={selectedLinkData}
          onClose={() => setActiveModal(null)}
          onToast={showToast}
        />
      )}

      {/* Stats Modal */}
      {activeModal === "stats" && (
        <StatsModal
          shortCode={selectedLinkData ? selectedLinkData.short_code : ""}
          stats={statsData}
          loading={statsLoading}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}

// QR Code Modal Component
function QrModal({ linkData, onClose, onToast }) {
  const qrRef = useRef(null);
  const targetUrl = linkData.short_url || (linkData.short_code ? `${window.location.origin}/${linkData.short_code}` : "");

  useEffect(() => {
    if (!qrRef.current) return;
    qrRef.current.innerHTML = "";

    if (window.qrcode) {
      const typeNumber = 0;
      const errorCorrectionLevel = "H";
      const qr = window.qrcode(typeNumber, errorCorrectionLevel);
      qr.addData(targetUrl);
      qr.make();
      qrRef.current.innerHTML = qr.createImgTag(5, 10);
    } else {
      const img = document.createElement("img");
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;
      img.alt = "QR Code";
      qrRef.current.appendChild(img);
    }
  }, [targetUrl]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDownload = () => {
    const img = qrRef.current ? qrRef.current.querySelector("img") : null;
    if (img) {
      const a = document.createElement("a");
      a.href = img.src;
      a.download = `shortify-qr-${linkData.short_code || "code"}.png`;
      a.click();
      onToast("Downloading QR code image...");
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target.classList.contains("modal-backdrop") && onClose()}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 className="modal-title">QR Code</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p className="modal-desc">Scan or download this QR code to access the short link on mobile devices.</p>
          <div className="qr-wrapper" ref={qrRef}></div>
          <p className="qr-url">{targetUrl}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary btn-full" onClick={handleDownload}>
            Download QR Code
          </button>
        </div>
      </div>
    </div>
  );
}

// Stats Modal Component
function StatsModal({ shortCode, stats, loading, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target.classList.contains("modal-backdrop") && onClose()}
    >
      <div className="modal-dialog">
        <div className="modal-header">
          <h3 className="modal-title">Link Analytics ({shortCode})</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <span className="btn-spinner" style={{ width: "24px", height: "24px" }}></span>
              <p style={{ marginTop: "0.5rem", color: "var(--text-muted)" }}>Loading analytics...</p>
            </div>
          ) : stats ? (
            <div className="stats-summary-grid">
              <div className="stat-cell">
                <span className="stat-cell-label">Total Clicks</span>
                <span className="stat-cell-value text-success">{stats.click_count || 0}</span>
              </div>
              <div className="stat-cell">
                <span className="stat-cell-label">Status</span>
                <span className="stat-cell-value" style={{ fontSize: "1rem", marginTop: "0.2rem" }}>
                  {stats.is_active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="stat-cell col-span-2">
                <span className="stat-cell-label">Created At</span>
                <span className="stat-cell-mono">
                  {stats.created_at ? new Date(stats.created_at).toLocaleString() : "-"}
                </span>
              </div>
              <div className="stat-cell col-span-2">
                <span className="stat-cell-label">Expires At</span>
                <span className="stat-cell-mono">
                  {stats.expires_at ? new Date(stats.expires_at).toLocaleString() : "Never"}
                </span>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "1rem" }}>
              No telemetry stats found.
            </p>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-full" onClick={onClose}>
            Close Analytics
          </button>
        </div>
      </div>
    </div>
  );
}

// Render React App into DOM
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
