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

async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!r.ok) throw new Error("API error " + r.status + " : " + await r.text());
  return r.json();
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/fixtures", async (req, res) => {
  try {
    const { league } = req.query;
    const season = new Date().getFullYear();
    const data = await apiGet("/fixtures", { league, season, next: 10 });

    const out = (data.response || []).map(m => ({
      id: m.fixture.id,
      date: m.fixture.date,
      home: m.teams.home.name,
      away: m.teams.away.name
    }));

    res.json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ LP2M backend running on " + PORT));
