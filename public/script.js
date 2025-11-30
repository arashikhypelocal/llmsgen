// ===========================
// URL → Sitemap → Meta Data → llms.txt (grouped by URL folders)
// ===========================

const siteUrlInput = document.getElementById("siteUrl");
const requestDelayInput = document.getElementById("requestDelay");
const runBtn = document.getElementById("runBtn");
const toolStatus = document.getElementById("toolStatus");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadLlmsBtn = document.getElementById("downloadLlmsBtn");
const resultTableBody = document.getElementById("resultTableBody");
const llmsPreview = document.getElementById("llmsPreview");

const PROXY_ENDPOINT = "/proxy";

let metadataRows = [];
let llmsTextContent = "";

// ---------- Helpers: proxy fetch & parsing ----------

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
 * Discover sitemap URLs for a given site origin.
 * 1) Check /robots.txt for "Sitemap:" lines
 * 2) Fallback to /sitemap.xml
 */
async function discoverSitemaps(origin) {
  const sitemapUrls = new Set();

  // 1. robots.txt
  const robotsUrl = `${origin}/robots.txt`;
  const robotsText = await fetchUrlGeneric(robotsUrl, false);

  if (robotsText) {
    const lines = robotsText.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^sitemap:/i.test(trimmed)) {
        const afterColon = trimmed.split(/:/i).slice(1).join(":").trim();
        if (afterColon) {
          sitemapUrls.add(afterColon);
        }
      }
    }
  }

  // 2. Fallback: /sitemap.xml
  if (sitemapUrls.size === 0) {
    sitemapUrls.add(`${origin}/sitemap.xml`);
  }

  return Array.from(sitemapUrls);
}

/**
 * Extracts all URLs from a sitemap or sitemap index (recursive).
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
  return Array.from(new Set(urls)); // dedupe
}

/**
 * Extract meta title & description from HTML string.
 */
function extractMetaFromHtml(html, url) {
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
    meta_description: description,
  };
}

// ---------- Grouping helpers ----------

/**
 * Turn "post-category" → "Post Category"
 */
function toTitleFromSlug(slug) {
  if (!slug) return "";
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Determine group name based on URL path:
 *
 * - If path is "/" or single segment (e.g. "/about-us") → "Page"
 * - If path has at least two segments:
 *     domain/folder1/slug            → group = folder1
 *     domain/folder1/folder2/slug    → group = folder2
 *   i.e. always use the *last folder* before the slug.
 */
function getGroupNameFromUrl(url) {
  try {
    const u = new URL(url);
    let path = u.pathname || "/";

    // Normalize: remove trailing slash except root "/"
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }

    // Split into segments, ignoring empty ones
    const segments = path.split("/").filter(Boolean);

    // Root or single slug → "Page"
    if (segments.length <= 1) {
      return "Page";
    }

    // More than one segment: last folder is second-to-last segment
    const folderSegment = segments[segments.length - 2];
    const title = toTitleFromSlug(folderSegment);
    return title || "Page";
  } catch {
    return "Page";
  }
}

// ---------- UI helpers ----------

function resetResultsUI() {
  metadataRows = [];
  llmsTextContent = "";
  downloadCsvBtn.disabled = true;
  downloadLlmsBtn.disabled = true;

  if (resultTableBody) {
    resultTableBody.innerHTML = "";
  }
  if (llmsPreview) {
    llmsPreview.value = "";
    llmsPreview.disabled = true;
  }
}

function updateMetadataTable() {
  if (!resultTableBody) return;
  resultTableBody.innerHTML = "";

  const previewRows = metadataRows.slice(0, 200); // limit for UI

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
    resultTableBody.appendChild(tr);
  });
}

/**
 * Build llms.txt content grouped by URL pattern.
 *
 * Example:
 * ## Page
 *
 * - [Home](https://www.swroofing.ca/): description...
 *
 * ## Post
 *
 * - [Some Post](https://www.swroofing.ca/post/...): description...
 */
function buildLlmsTextFromMetadata() {
  const groups = new Map(); // groupName -> array of bullet lines

  for (const row of metadataRows) {
    const url = (row.url || "").trim();
    const title = (row.meta_title || "").trim();
    const description = (row.meta_description || "").trim();
    if (!url || !title || !description) continue;

    const groupName = getGroupNameFromUrl(url);
    const line = `- [${title}](${url}): ${description}`;

    if (!groups.has(groupName)) {
      groups.set(groupName, []);
    }
    groups.get(groupName).push(line);
  }

  const lines = [];

  if (groups.size === 0) {
    lines.push("## Page");
    lines.push("");
    lines.push("// No complete rows (URL + title + description) found.");
  } else {
    // Put "Page" first if it exists, then others in insertion order
    const orderedGroups = [];
    if (groups.has("Page")) {
      orderedGroups.push("Page");
    }
    for (const key of groups.keys()) {
      if (key !== "Page") orderedGroups.push(key);
    }

    orderedGroups.forEach((groupName, index) => {
      lines.push(`## ${groupName}`);
      lines.push("");
      const groupLines = groups.get(groupName) || [];
      lines.push(...groupLines);
      if (index < orderedGroups.length - 1) {
        lines.push(""); // blank line between groups
        lines.push("");
      }
    });
  }

  llmsTextContent = lines.join("\n");

  if (llmsPreview) {
    llmsPreview.disabled = false;
    llmsPreview.value = llmsTextContent;
  }
}

// ---------- Main scraping logic ----------

async function runUrlToLlmsFlow() {
  resetResultsUI();
  toolStatus.classList.remove("error");

  let rawUrl = siteUrlInput.value.trim();
  if (!rawUrl) {
    toolStatus.textContent = "Please enter a site URL.";
    toolStatus.classList.add("error");
    return;
  }

  // Normalize URL (add https if scheme missing)
  let site;
  try {
    site = new URL(rawUrl);
  } catch {
    try {
      site = new URL("https://" + rawUrl);
    } catch {
      toolStatus.textContent = "Invalid URL. Please check and try again.";
      toolStatus.classList.add("error");
      return;
    }
  }

  const origin = site.origin;
  toolStatus.textContent = `Discovering sitemaps for ${origin}...`;

  // Discover sitemap URLs
  const sitemapUrls = await discoverSitemaps(origin);
  if (!sitemapUrls.length) {
    toolStatus.textContent = "No sitemap URLs discovered.";
    toolStatus.classList.add("error");
    return;
  }

  toolStatus.textContent = `Found ${sitemapUrls.length} sitemap URL(s). Fetching URLs...`;

  // Collect all URLs from all sitemaps
  const allUrlsSet = new Set();
  for (const smUrl of sitemapUrls) {
    const urls = await extractUrlsFromSitemap(smUrl);
    urls.forEach((u) => allUrlsSet.add(u));
  }

  const allUrls = Array.from(allUrlsSet);
  if (!allUrls.length) {
    toolStatus.textContent = "No URLs found in the discovered sitemaps.";
    toolStatus.classList.add("error");
    return;
  }

  toolStatus.textContent = `Found ${allUrls.length} URL(s). Scraping pages...`;

  let delayMs = 0;
  const delayVal = requestDelayInput.value;
  if (delayVal !== "") {
    const parsed = parseFloat(delayVal);
    if (!isNaN(parsed) && parsed > 0) {
      delayMs = parsed * 1000;
    }
  }

  // Scrape each page for meta
  let count = 0;
  for (const url of allUrls) {
    const html = await fetchUrlGeneric(url, false);
    if (html === null) {
      metadataRows.push({
        url,
        meta_title: "",
        meta_description: "",
      });
    } else {
      const meta = extractMetaFromHtml(html, url);
      metadataRows.push(meta);
    }

    count++;
    toolStatus.textContent = `Scraping pages: ${count} / ${allUrls.length}`;
    updateMetadataTable();

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Build grouped llms.txt content
  buildLlmsTextFromMetadata();

  downloadCsvBtn.disabled = metadataRows.length === 0;
  downloadLlmsBtn.disabled = !llmsTextContent;

  toolStatus.textContent = `Done. Scraped ${metadataRows.length} page(s).`;
}

// ---------- Download helpers ----------

function downloadMetadataCSV() {
  if (!metadataRows.length) return;

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
    ...metadataRows.map((row) =>
      header.map((key) => escapeCSV(row[key])).join(",")
    ),
  ];

  const blob = new Blob([rows.join("\n")], {
    type: "text/csv;charset=utf-8",
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

function downloadLlmsTxt() {
  if (!llmsTextContent) return;

  const blob = new Blob([llmsTextContent], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "llms.txt";
  document.body.appendChild(a);
  document.body.removeChild(a);
  a.click();

  URL.revokeObjectURL(url);
}

// ---------- Event bindings ----------

runBtn.addEventListener("click", () => {
  runUrlToLlmsFlow();
});

downloadCsvBtn.addEventListener("click", () => {
  downloadMetadataCSV();
});

downloadLlmsBtn.addEventListener("click", () => {
  downloadLlmsTxt();
});
