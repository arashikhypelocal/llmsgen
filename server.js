// server.js
// Simple Express server that serves the frontend and provides a /proxy
// endpoint to fetch remote URLs server-side (avoids browser CORS issues).

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// ------------ Serve Static Files ------------
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ------------ Proxy Endpoint ------------
// IMPORTANT: Node 18+ required for global fetch.
// This proxy is now OPEN (allows ALL hosts).

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

  // --------------------------------------------------
  // 🟢 OPEN PROXY MODE — ALLOW ALL DOMAINS
  // (You removed ALLOWED_HOSTS restrictions)
  // --------------------------------------------------

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

    res.set("Content-Type", "text/plain; charset=utf-8");
    res.set("Access-Control-Allow-Origin", "*");
    res.send(text);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).send("Proxy fetch error");
  }
});

// ------------ Start Server ------------
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
