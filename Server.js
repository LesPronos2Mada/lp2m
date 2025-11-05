import express from "express";
import cors from "cors";
import compression from "compression";
import fetch from "node-fetch";

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

// debug
app.get("/api/debug-key", (req, res) => {
  res.json({ key: API_KEY || null });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const r = await fetch(url, {
    headers: { "x-apisports-key": API_KEY }
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(txt);
  return JSON.parse(txt);
}

app.get("/api/fixtures", async (req, res) => {
  try {
    const { league } = req.query;
    const season = new Date().getFullYear();

    const data = await apiGet("/fixtures", {
      league,
      season,
      next: 10
    });

    res.json(data.response || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ LP2M running on " + PORT));
