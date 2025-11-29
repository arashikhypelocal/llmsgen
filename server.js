// server.js
// Simple Express server that serves the frontend and provides a /proxy
// endpoint to fetch remote URLs server-side (avoids browser CORS issues).

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ------------ Static files ------------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// Serve index.html for root
app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ------------ Proxy endpoint ------------
// IMPORTANT: Node 18+ is required for global fetch.

// Allowed hosts for the proxy. You can override the default list by setting
// the ALLOWED_HOSTS environment variable to a comma‑separated list. Use "*"
// to allow any host (not recommended for production).
const DEFAULT_ALLOWED_HOSTS = [
  "www.hypelocal.com",
  "hypelocal.com",
  "localhost",
  "127.0.0.1",
];

function getAllowedHosts() {
  const envList = process.env.ALLOWED_HOSTS;
  if (!envList) return DEFAULT_ALLOWED_HOSTS;
  return envList
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
}

const ALLOWED_HOSTS = getAllowedHosts();

app.get("/proxy", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send("Missing url parameter");
  }

  let urlObj;
  try {
    urlObj = new URL(targetUrl);
  } catch (e) {
    return res.status(400).send("Invalid URL");
  }

  // Safety: avoid turning this into an open proxy.
  const isWildcard = ALLOWED_HOSTS.includes("*");
  if (!isWildcard && !ALLOWED_HOSTS.includes(urlObj.hostname)) {
    return res.status(403).send("Host not allowed by proxy");
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "MetaScraperBot/1.0 (+https://hypelocal.com)"
      }
    });

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .send(`Upstream error ${upstream.status}`);
    }

    const text = await upstream.text();

    // Return as plain text; client decides if it's XML or HTML.
    res.set("Content-Type", "text/plain; charset=utf-8");
    // Allow the frontend origin (same-origin in this setup, * is ok here)
    res.set("Access-Control-Allow-Origin", "*");
    res.send(text);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy fetch error");
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
