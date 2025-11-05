import express from "express";
import cors from "cors";
import compression from "compression";
import fetch from "node-fetch";

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

// ✅ API FOOTBALL
const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = process.env.API_FOOTBALL_KEY;

// ✅ Debug : voir si la clé arrive bien depuis Render
app.get("/api/debug-key", (req, res) => {
  res.json({ key_received: API_KEY ? true : false });
});

// ✅ Santé
app.get("/api/health", (req, res) => res.json({ ok: true }));

// ✅ Helper API-Football
async function apiGet(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const r = await fetch(url, {
    headers: { "x-apisports-key": API_KEY }
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`API error ${r.status} - ${txt}`);
  }

  return r.json();
}

// ✅ FIXTURES (10 prochains matchs)
app.get("/api/fixtures", async (req, res) => {
  try {
    const { league } = req.query;
    const season = new Date().getFullYear();

    if (!league)
      return res.status(400).json({ error: "league required" });

    const data = await apiGet("/fixtures", {
      league,
      season,
      next: 10
    });

    res.json(
      (data.response || []).map(m => ({
        id: m.fixture.id,
        date: m.fixture.date,
        home: m.teams.home.name,
        away: m.teams.away.name
      }))
    );

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ✅ Render PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("✅ LP2M backend running on " + PORT));
