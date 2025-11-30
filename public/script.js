// ===========================
// URL → Sitemap → Meta Data → llms.txt (grouped by URL folders)
// + Optional FAQ extraction from a user-provided FAQ URL
// ===========================

const siteUrlInput = document.getElementById("siteUrl");
const requestDelayInput = document.getElementById("requestDelay");
const faqUrlInput = document.getElementById("faqUrl");
const runBtn = document.getElementById("runBtn");
const toolStatus = document.getElementById("toolStatus");
const downloadCsvBtn = document.getElementById("downloadCsvBtn");
const downloadLlmsBtn = document.getElementById("downloadLlmsBtn");
const resultTableBody = document.getElementById("resultTableBody");
const llmsPreview = document.getElementById("llmsPreview");

const PROXY_ENDPOINT = "/proxy";

let metadataRows = [];
let llmsTextContent = "";

// Will be filled if FAQ URL is provided and FAQ extraction succeeds
let faqItems = []; // { question: string, answer: string }[]

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

// ---------- FAQ helpers (schema.org + fallback) ----------

function looksLikeQuestion(text) {
  const t = (text || "").trim().toLowerCase();
  if (!t) return false;
  if (t.includes("?")) return true;
  const starts = [
    "what",
    "how",
    "why",
    "when",
    "where",
    "who",
    "does",
    "do",
    "can",
    "is",
    "are",
    "should",
    "will",
    "could",
  ];
  return starts.some((p) => t.startsWith(p + " "));
}

/**
 * Extract FAQs based on schema.org FAQPage microdata markup.
 * Looks for itemtype="https://schema.org/FAQPage".
 * Returns list of {question, answer}.
 */
function extractFaqSchemaMicrodata(doc) {
  const faqs = [];
  const faqRoots = doc.querySelectorAll('[itemtype="https://schema.org/FAQPage"]');
  if (!faqRoots.length) return faqs;

  faqRoots.forEach((root) => {
    const entities =
      root.querySelectorAll('[itemprop="mainEntity"]') ||
      root.querySelectorAll('[itemprop="mainEntityOfPage"]');

    entities.forEach((ent) => {
      const qEl = ent.querySelector('[itemprop="name"]');
      const aEl = ent.querySelector('[itemprop="text"]');
      const question = (qEl?.textContent || "").trim();
      const answer = (aEl?.textContent || "").trim();
      if (question && answer) {
        faqs.push({ question, answer });
      }
    });
  });

  return faqs;
}

/**
 * Helper to walk parsed JSON-LD object and collect FAQ Q/A pairs.
 */
function extractFaqsFromLdJsonObject(obj) {
  const faqs = [];

  function handleQuestion(qObj) {
    if (!qObj || typeof qObj !== "object") return;
    const qText = (qObj.name || qObj.headline || "").toString();
    const aPart = qObj.acceptedAnswer || qObj.acceptedAnswers || qObj.suggestedAnswer;

    const answers = [];
    if (Array.isArray(aPart)) {
      answers.push(...aPart);
    } else if (aPart) {
      answers.push(aPart);
    }

    answers.forEach((ansObj) => {
      if (!ansObj || typeof ansObj !== "object") return;
      const aText = (ansObj.text || ansObj.description || "").toString();
      if (qText && aText) {
        faqs.push({
          question: qText.trim(),
          answer: aText.trim(),
        });
      }
    });
  }

  function nodeHasType(node, typeSubstring) {
    const t = node["@type"] || node.type;
    if (!t) return false;
    if (Array.isArray(t)) {
      return t.some((v) =>
        String(v).toLowerCase().includes(typeSubstring.toLowerCase())
      );
    }
    return String(t).toLowerCase().includes(typeSubstring.toLowerCase());
  }

  function walk(node) {
    if (!node) return;

    if (Array.isArray(node)) {
      node.forEach((item) => walk(item));
      return;
    }

    if (typeof node === "object") {
      if (nodeHasType(node, "faqpage")) {
        const entities =
          node.mainEntity || node.mainEntityOfPage || node.mainEntityOfPageList;
        if (entities) {
          const list = Array.isArray(entities) ? entities : [entities];
          list.forEach((ent) => {
            if (nodeHasType(ent, "question")) {
              handleQuestion(ent);
            }
          });
        }
      } else if (nodeHasType(node, "question")) {
        handleQuestion(node);
      }

      Object.values(node).forEach((v) => walk(v));
    }
  }

  walk(obj);
  return faqs;
}

/**
 * Extract FAQs based on schema.org FAQPage JSON-LD.
 * Returns list of {question, answer}.
 */
function extractFaqSchemaLdJson(doc) {
  const faqs = [];
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

  scripts.forEach((script) => {
    const raw = script.textContent || "";
    if (!raw.trim()) return;

    try {
      const data = JSON.parse(raw);
      const items = extractFaqsFromLdJsonObject(data);
      if (items && items.length) {
        faqs.push(...items);
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  });

  // dedupe by question+answer
  const seen = new Set();
  const unique = [];
  faqs.forEach((item) => {
    const key = `${item.question}|||${item.answer}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  });
  return unique;
}

/**
 * Fallback extractor:
 * - Treat <h2>, <h3>, <h4> as potential questions
 * - Collect following siblings (DOM order) until next heading (h1–h4)
 * - Aggregate text from p/div/li/section/article and text nodes
 */
function extractFaqHeadings(doc) {
  const faqs = [];
  const headings = doc.querySelectorAll("h2, h3, h4");

  headings.forEach((h) => {
    const qText = (h.textContent || "").trim();
    if (!looksLikeQuestion(qText)) return;

    const answerParts = [];
    let node = h.nextSibling;

    while (node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName ? node.tagName.toLowerCase() : "";

        // Stop at next heading
        if (["h1", "h2", "h3", "h4"].includes(tag)) break;

        if (["p", "div", "li", "section", "article"].includes(tag)) {
          const text = node.textContent.trim();
          if (text) answerParts.push(text);
        }
      } else if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) answerParts.push(text);
      }

      node = node.nextSibling;
    }

    const answer = answerParts.join("\n\n").trim();
    if (answer) {
      faqs.push({ question: qText, answer });
    }
  });

  return faqs;
}

/**
 * Combined FAQ extractor from HTML string:
 * 1) schema.org microdata
 * 2) schema.org JSON-LD
 * 3) heading-based fallback
 */
function extractFaqItemsFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 1) schema.org microdata
  let items = extractFaqSchemaMicrodata(doc);
  if (items.length) {
    console.log("FAQ: found", items.length, "items via schema.org microdata");
    return items;
  }

  // 2) JSON-LD schema
  items = extractFaqSchemaLdJson(doc);
  if (items.length) {
    console.log("FAQ: found", items.length, "items via JSON-LD schema.org");
    return items;
  }

  // 3) fallback: heading-based
  items = extractFaqHeadings(doc);
  console.log("FAQ: found", items.length, "items via heading-based heuristic");
  return items;
}

/**
 * Append FAQ section to llms.txt output if faqItems exist.
 * Format:
 *
 * Frequently Asked Questions (FAQ)
 * ==============================
 * - user question:
 * ...
 *
 * - agent answer:
 * ...
 * ---
 */
function appendFaqSection(lines) {
  if (!faqItems || !faqItems.length) return;

  lines.push("");
  lines.push("Frequently Asked Questions (FAQ)");
  lines.push("================================");
  lines.push("");

  faqItems.forEach((item) => {
    const q = (item.question || "").trim();
    const a = (item.answer || "").trim();
    if (!q || !a) return;

    lines.push("- user question:");
    lines.push(q);
    lines.push("");
    lines.push("- agent answer:");
    lines.push(a);
    lines.push("");
    lines.push("---");
    lines.push("");
  });
}

/**
 * Fetch and extract FAQs from a user-provided FAQ URL.
 * rawFaqUrl may be absolute or relative; we use origin as base if needed.
 */
async function fetchAndExtractFaqFromUrl(rawFaqUrl, origin) {
  let faqUrl;
  try {
    faqUrl = new URL(rawFaqUrl);
  } catch {
    try {
      faqUrl = new URL(rawFaqUrl, origin);
    } catch {
      toolStatus.textContent = "Invalid FAQ URL. Skipping FAQ extraction.";
      toolStatus.classList.add("error");
      return;
    }
  }

  toolStatus.textContent = `Fetching FAQ page: ${faqUrl.href}`;
  toolStatus.classList.remove("error");

  const html = await fetchUrlGeneric(faqUrl.href, false);
  if (!html) {
    toolStatus.textContent = "Could not fetch FAQ page.";
    toolStatus.classList.add("error");
    return;
  }

  const items = extractFaqItemsFromHtml(html);
  if (!items.length) {
    toolStatus.textContent =
      "No FAQs detected on the FAQ page with current heuristics.";
    return;
  }

  faqItems = items;
  toolStatus.textContent = `Found ${faqItems.length} FAQ item(s). They will be appended to llms.txt.`;
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
  faqItems = [];

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
 * Build llms.txt content grouped by URL pattern, then append FAQ section.
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

  // Append FAQ section at the bottom (if any)
  appendFaqSection(lines);

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

  // If user provided a FAQ URL, fetch & extract FAQs now
  const rawFaqUrl = faqUrlInput ? faqUrlInput.value.trim() : "";
  if (rawFaqUrl) {
    await fetchAndExtractFaqFromUrl(rawFaqUrl, origin);
  }

  // Build grouped llms.txt content (with FAQ section if any)
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
  a.click();
  document.body.removeChild(a);

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
