// ===========================
// Tool 1: CSV → llms.txt
// ===========================
const fileInput = document.getElementById("csvFile");
const hasHeaderCheckbox = document.getElementById("hasHeader");
const previewArea = document.getElementById("preview");
const downloadBtn = document.getElementById("downloadBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");
const fileNameLabel = document.getElementById("fileName");

let generatedText = "";

// Simple CSV parser that supports quoted fields and commas inside quotes
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentValue = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      // Escaped quote inside quoted field
      currentValue += '"';
      i++; // skip the next quote
    } else if (char === '"') {
      // Toggle quote mode
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      // End of field
      currentRow.push(currentValue);
      currentValue = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      // End of line (handle CR, LF, or CRLF)
      if (char === "\r" && nextChar === "\n") {
        i++; // skip LF after CR
      }
      currentRow.push(currentValue);
      currentValue = "";
      if (
        currentRow.length > 1 ||
        (currentRow.length === 1 && currentRow[0].trim() !== "")
      ) {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentValue += char;
    }
  }

  // Add last value if any
  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  // Filter out completely empty rows
  return rows.filter((row) => row.some((cell) => cell.trim() !== ""));
}

function rowsToLlmsTxt(rows, hasHeader) {
  const startIndex = hasHeader ? 1 : 0;
  const lines = [];

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];

    // Expecting columns: URL, Title, Meta description
    const url = (row[0] || "").trim();
    const title = (row[1] || "").trim();
    const description = (row[2] || "").trim();

    if (!url || !title || !description) {
      // skip incomplete rows
      continue;
    }

    const line = `- [${title}](${url}): ${description}`;
    lines.push(line);
  }

  return lines.join("\n");
}

function resetUI() {
  generatedText = "";
  previewArea.value = "";
  previewArea.disabled = true;
  downloadBtn.disabled = true;
  statusEl.textContent = "No file loaded yet.";
  statusEl.classList.remove("error");
  if (fileNameLabel) {
    fileNameLabel.textContent = "No file selected";
  }
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) {
    resetUI();
    return;
  }

  if (fileNameLabel) {
    fileNameLabel.textContent = file.name;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = reader.result;
      const rows = parseCSV(text);

      if (!rows.length) {
        throw new Error("CSV appears to be empty or invalid.");
      }

      generatedText = rowsToLlmsTxt(rows, hasHeaderCheckbox.checked);

      if (!generatedText) {
        throw new Error("No valid rows were found (URL, Title, Meta description).");
      }

      previewArea.disabled = false;
      previewArea.value = generatedText;
      downloadBtn.disabled = false;
      statusEl.textContent = `Loaded ${rows.length} row(s). Generated ${
        generatedText.split("\n").length
      } line(s).`;
      statusEl.classList.remove("error");
    } catch (err) {
      generatedText = "";
      previewArea.value = "";
      previewArea.disabled = true;
      downloadBtn.disabled = true;
      statusEl.textContent = "Error: " + err.message;
      statusEl.classList.add("error");
    }
  };
  reader.onerror = () => {
    resetUI();
    statusEl.textContent = "Error reading file.";
    statusEl.classList.add("error");
  };

  reader.readAsText(file);
  statusEl.textContent = "Processing CSV...";
  statusEl.classList.remove("error");
});

hasHeaderCheckbox.addEventListener("change", () => {
  // Re-process current file if one is loaded
  if (fileInput.files[0]) {
    const event = new Event("change");
    fileInput.dispatchEvent(event);
  }
});

downloadBtn.addEventListener("click", () => {
  if (!generatedText) return;

  const blob = new Blob([generatedText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "llms.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
});

clearBtn.addEventListener("click", () => {
  fileInput.value = "";
  resetUI();
});

// ===========================
// Tool 2: Sitemap Meta Scraper
// (JS adaptation of your Python logic)
// ===========================

const sitemapUrlInput = document.getElementById("sitemapUrl");
const requestDelayInput = document.getElementById("requestDelay");
const scrapeBtn = document.getElementById("scrapeBtn");
const sitemapStatus = document.getElementById("sitemapStatus");
const sitemapDownloadBtn = document.getElementById("sitemapDownloadBtn");
const sitemapTableBody = document.querySelector("#sitemapTable tbody");

const PROXY_ENDPOINT = "/proxy"; // backend route to avoid CORS
let sitemapData = [];

/**
 * Generic fetch helper. Calls the backend proxy so we don't hit CORS.
 * If parseXml is true, returns an XML Document.
 * Otherwise returns response text. Returns null on error.
 */
async function fetchUrlGeneric(url, parseXml = false) {
  try {
    const proxiedUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;
    const resp = await fetch(proxiedUrl, { method: "GET" });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const text = await resp.text();
    if (parseXml) {
      const parser = new DOMParser();
      return parser.parseFromString(text, "application/xml");
    }
    return text;
  } catch (e) {
    console.error("[ERROR] Could not fetch", url, e);
    return null;
  }
}

/**
 * Extracts all URLs from a sitemap or sitemap index (recursive).
 * Mirrors the Python extract_urls_from_sitemap logic.
 */
async function extractUrlsFromSitemap(sitemapUrl) {
  const urls = [];
  const visitedSitemaps = new Set();

  async function processSitemap(url) {
    if (visitedSitemaps.has(url)) return;
    visitedSitemaps.add(url);

    const xmlDoc = await fetchUrlGeneric(url, true);
    if (!xmlDoc) return;

    const sitemapIndex = xmlDoc.getElementsByTagName("sitemapindex");
    if (sitemapIndex && sitemapIndex.length > 0) {
      // Sitemap index: iterate over <sitemap><loc>
      const sitemapNodes = xmlDoc.getElementsByTagName("sitemap");
      for (const sm of sitemapNodes) {
        const locEl = sm.getElementsByTagName("loc")[0];
        if (locEl && locEl.textContent) {
          const childUrl = locEl.textContent.trim();
          await processSitemap(childUrl);
        }
      }
    } else {
      // URL sitemap: iterate over <url><loc>
      const urlNodes = xmlDoc.getElementsByTagName("url");
      for (const u of urlNodes) {
        const locEl = u.getElementsByTagName("loc")[0];
        if (locEl && locEl.textContent) {
          urls.push(locEl.textContent.trim());
        }
      }
    }
  }

  await processSitemap(sitemapUrl);
  // Remove duplicates while preserving order
  return Array.from(new Set(urls));
}

/**
 * Extract meta title & description from HTML string, similar to Python extract_meta_from_html.
 */
function extractMetaFromHtmlJS(html, url) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Title
  let title = "";
  const titleTag = doc.querySelector("title");
  if (titleTag && titleTag.textContent) {
    title = titleTag.textContent.trim();
  }
  if (!title) {
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle && ogTitle.getAttribute("content")) {
      title = ogTitle.getAttribute("content").trim();
    }
  }

  // Description
  let description = "";
  const descTag = doc.querySelector('meta[name="description"]');
  if (descTag && descTag.getAttribute("content")) {
    description = descTag.getAttribute("content").trim();
  }
  if (!description) {
    const ogDesc = doc.querySelector('meta[property="og:description"]');
    if (ogDesc && ogDesc.getAttribute("content")) {
      description = ogDesc.getAttribute("content").trim();
    }
  }

  return {
    url,
    meta_title: title,
    meta_description: description
  };
}

/**
 * Update the HTML table showing sitemap results (limited preview for UX).
 */
function updateSitemapTable() {
  if (!sitemapTableBody) return;
  sitemapTableBody.innerHTML = "";

  // Show up to first 200 rows for UI performance
  const previewRows = sitemapData.slice(0, 200);

  previewRows.forEach((row, index) => {
    const tr = document.createElement("tr");

    const tdIndex = document.createElement("td");
    tdIndex.textContent = String(index + 1);

    const tdUrl = document.createElement("td");
    tdUrl.textContent = row.url;

    const tdTitle = document.createElement("td");
    tdTitle.textContent = row.meta_title;

    const tdDesc = document.createElement("td");
    tdDesc.textContent = row.meta_description;

    tr.appendChild(tdIndex);
    tr.appendChild(tdUrl);
    tr.appendChild(tdTitle);
    tr.appendChild(tdDesc);
    sitemapTableBody.appendChild(tr);
  });
}

/**
 * Main sitemap scraping logic in JS (adapts scrape_sitemap_meta).
 */
async function scrapeSitemapMetaJS(sitemapUrl, delayMs) {
  sitemapStatus.textContent = "Fetching URLs from sitemap...";
  sitemapStatus.classList.remove("error");
  sitemapData = [];
  sitemapDownloadBtn.disabled = true;
  updateSitemapTable();

  try {
    const urls = await extractUrlsFromSitemap(sitemapUrl);
    if (!urls.length) {
      sitemapStatus.textContent = "No URLs found in sitemap.";
      return;
    }

    sitemapStatus.textContent = `Found ${urls.length} URLs. Fetching pages...`;

    let count = 0;
    for (const url of urls) {
      const html = await fetchUrlGeneric(url, false);
      if (html === null) {
        sitemapData.push({
          url,
          meta_title: "",
          meta_description: ""
        });
      } else {
        const meta = extractMetaFromHtmlJS(html, url);
        sitemapData.push(meta);
      }

      count++;
      sitemapStatus.textContent = `Scraping pages: ${count} / ${urls.length}`;
      updateSitemapTable();

      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    sitemapStatus.textContent = `Done. Scraped ${sitemapData.length} page(s).`;
    sitemapDownloadBtn.disabled = sitemapData.length === 0;
  } catch (err) {
    console.error(err);
    sitemapStatus.textContent = "Error: " + err.message;
    sitemapStatus.classList.add("error");
  }
}

/**
 * Build and download CSV from sitemapData (like your pandas DataFrame export).
 */
function downloadSitemapCSV() {
  if (!sitemapData.length) return;

  const header = ["url", "meta_title", "meta_description"];

  const escapeCSV = (value) => {
    if (value === null || value === undefined) return "";
    let s = String(value).replace(/"/g, '""');
    if (/[",\n]/.test(s)) {
      s = `"${s}"`;
    }
    return s;
  };

  const rows = [
    header.join(","),
    ...sitemapData.map((row) =>
      header.map((key) => escapeCSV(row[key])).join(",")
    )
  ];

  const blob = new Blob([rows.join("\n")], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "meta_from_sitemap.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}

// Event bindings for sitemap tool
scrapeBtn.addEventListener("click", () => {
  const sitemapUrl = sitemapUrlInput.value.trim();
  if (!sitemapUrl) {
    sitemapStatus.textContent = "Please enter a sitemap URL.";
    sitemapStatus.classList.add("error");
    return;
  }

  let delayMs = 0;
  const delayVal = requestDelayInput.value;
  if (delayVal !== "") {
    const parsed = parseFloat(delayVal);
    if (!isNaN(parsed) && parsed > 0) {
      delayMs = parsed * 1000;
    }
  }

  sitemapStatus.textContent = "Starting sitemap scrape...";
  sitemapStatus.classList.remove("error");

  scrapeSitemapMetaJS(sitemapUrl, delayMs);
});

sitemapDownloadBtn.addEventListener("click", () => {
  downloadSitemapCSV();
});
