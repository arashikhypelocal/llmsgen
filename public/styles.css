/* ===========
   Base layout
   =========== */

*,
*::before,
*::after {
  box-sizing: border-box;
}

:root {
  --bg: #08041e;
  --bg-card: #ffffff;
  --bg-card-soft: #f9fafb;
  --border-subtle: #e5e7eb;
  --text-main: #0f172a;
  --text-muted: #6b7280;
  --accent: #7c3aed;
  --accent-soft: #8b5cf6;
  --accent-strong: #f97316;
  --shadow-soft: 0 18px 40px rgba(15, 23, 42, 0.25);
  --radius-card: 24px;
  --radius-pill: 999px;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text",
    "Segoe UI", sans-serif;
}

html,
body {
  margin: 0;
  padding: 0;
  min-height: 100%;
  font-family: var(--font-sans);
  color: var(--text-main);
  background: radial-gradient(circle at top, #4c1d95 0, #1d0c47 40%, #020617 100%);
}

/* Main page container */

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ===========
   Hero section
   =========== */

.hero {
  padding: 3.25rem 1.5rem 2.5rem;
}

.hero-inner {
  max-width: 960px;
  margin: 0 auto;
  text-align: center;
  color: #f9fafb;
}

.hero-title {
  font-size: clamp(2.1rem, 3vw, 2.8rem);
  font-weight: 800;
  letter-spacing: 0.02em;
  margin: 0 0 0.75rem;
}

.hero-highlight {
  background: linear-gradient(90deg, #facc15, #f97316, #fb7185);
  -webkit-background-clip: text;
  color: transparent;
}

.hero-subtitle {
  margin: 0 auto;
  max-width: 640px;
  font-size: 0.98rem;
  line-height: 1.6;
  color: #e5e7eb;
}

/* ===========
   Main content
   =========== */

.main {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 1.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* Card */

.card {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft);
  border: 1px solid rgba(148, 163, 184, 0.15);
  overflow: hidden;
}

.main-card {
  padding: 1.75rem 1.75rem 1.9rem;
}

.card-header {
  margin-bottom: 1rem;
}

.card-title {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
  font-weight: 600;
}

.card-subtitle {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* URL row */

.url-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: stretch;
}

.url-input {
  width: 100%;
  resize: vertical;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  padding: 0.9rem 1rem;
  font-size: 0.95rem;
  outline: none;
  box-shadow: inset 0 0 0 1px transparent;
  background: #ffffff;
  color: var(--text-main);
  transition: border 0.15s ease, box-shadow 0.15s ease, transform 0.08s ease;
}

.url-input::placeholder {
  color: #9ca3af;
}

.url-input:focus {
  border-color: #a855f7;
  box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.4);
}

/* Buttons */

.btn {
  border: none;
  border-radius: var(--radius-pill);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.8rem 1.6rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  transition: transform 0.08s ease, box-shadow 0.12s ease,
    background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  white-space: nowrap;
}

.btn-primary {
  background: linear-gradient(90deg, #8b5cf6, #6366f1, #f97316);
  color: #f9fafb;
  box-shadow: 0 14px 35px rgba(79, 70, 229, 0.45);
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 18px 45px rgba(79, 70, 229, 0.6);
}

.btn-secondary {
  background: #ffffff;
  color: #4f46e5;
  border-radius: var(--radius-pill);
  border: 1px solid rgba(129, 140, 248, 0.4);
}

.btn-secondary:hover {
  background: #eef2ff;
  border-color: rgba(99, 102, 241, 0.8);
}

.btn-outline {
  background: #ffffff;
  color: #374151;
  border: 1px solid #d1d5db;
}

.btn-outline:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-outline:hover:not(:disabled) {
  background: #f3f4f6;
  border-color: #cbd5f5;
}

.btn-small {
  padding-inline: 1.1rem;
  padding-block: 0.55rem;
  font-size: 0.83rem;
}

.generate-btn {
  min-width: 190px;
}

/* Advanced options */

.advanced {
  margin-top: 0.7rem;
  border-radius: 14px;
  border: 1px dashed #e5e7eb;
  background: #f9fafb;
}

.advanced > summary {
  padding: 0.5rem 0.8rem;
  font-size: 0.82rem;
  cursor: pointer;
  list-style: none;
  color: #4b5563;
}

.advanced > summary::-webkit-details-marker {
  display: none;
}

.advanced > summary::before {
  content: "▸";
  display: inline-block;
  margin-right: 0.35rem;
  transition: transform 0.15s ease;
}

.advanced[open] > summary::before {
  transform: rotate(90deg);
}

.advanced-inner {
  padding: 0 0.8rem 0.75rem;
}

.advanced-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
  color: #4b5563;
}

.advanced-input {
  width: 120px;
  padding: 0.35rem 0.6rem;
  border-radius: 10px;
  border: 1px solid #d1d5db;
  font-size: 0.85rem;
}

.advanced-help {
  margin: 0.35rem 0 0;
  font-size: 0.8rem;
  color: var(--text-muted);
}

/* Status + downloads */

.status {
  margin-top: 0.6rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.status.error {
  color: #b91c1c;
}

.download-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

/* ===========
   Results area
   =========== */

.results {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr);
  gap: 1.25rem;
}

.results-card {
  background: var(--bg-card-soft);
  border-radius: 20px;
  border: 1px solid rgba(209, 213, 219, 0.8);
  padding: 1.1rem 1.25rem 1.3rem;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
}

.results-title {
  margin: 0 0 0.6rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.results-textarea {
  width: 100%;
  min-height: 210px;
  resize: vertical;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 0.7rem 0.8rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  font-size: 0.82rem;
  background: #ffffff;
  color: #111827;
}

.results-textarea:disabled {
  background: #f9fafb;
}

/* Table */

.table-wrapper {
  max-height: 230px;
  overflow: auto;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.results-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f9fafb;
  text-align: left;
  padding: 0.45rem 0.6rem;
  font-weight: 600;
  color: #6b7280;
  border-bottom: 1px solid #e5e7eb;
}

.results-table tbody td {
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: top;
}

.results-table tbody tr:nth-child(even) {
  background: #f9fafb;
}

/* ===========
   Footer
   =========== */

.footer {
  margin-top: auto;
  padding: 1.3rem 1.5rem 1.6rem;
  text-align: center;
  font-size: 0.78rem;
  color: #e5e7eb;
}

/* Utility */

.inline {
  background: #f3f4ff;
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
  font-size: 0.78rem;
  border: 1px solid #e5e7eb;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  border: 0;
}

/* ===========
   Responsive
   =========== */

@media (max-width: 840px) {
  .main-card {
    padding: 1.4rem 1.25rem 1.6rem;
  }

  .url-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .generate-btn {
    width: 100%;
  }

  .results {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .hero {
    padding-inline: 1.1rem;
  }

  .main {
    padding-inline: 1.1rem;
  }
}
