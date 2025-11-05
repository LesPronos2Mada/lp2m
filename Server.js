import express from "express";
import cors from "cors";
import compression from "compression";
import fetch from "node-fetch";

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

/* -------------------------
   OPTION 1 : TheSportsDB
   -------------------------
   - Gratuite, pas de quota agressif
   - Pas besoin de clé (on met une clé publique par défaut)
   - Donne fixtures "prochains matchs" par ligue
*/
const TSDB_KEY = process.env.THESPORTSDB_KEY || "3"; // clé publique
const TSDB_BASE = `https://www.thesportsdb.com/api/v1/json/${TSDB_KEY}`;

// Mapping TheSportsDB des ligues majeures
// (IDs confirmés pour TheSportsDB)
const TSDB_LEAGUES = {
  ligue1:      { id: 4334, name: "Ligue 1" },
  premier:     { id: 4328, name: "Premier League" },
  laliga:      { id: 4335, name: "LaLiga" },
  seriea:      { id: 4332, name: "Serie A" },
  bundesliga:  { id: 4331, name: "Bundesliga" },
  ucl:         { id: 4480, name: "UEFA Champions League" }
};

// Petite liste “publique” utilisable par le front
const PUBLIC_LEAGUES = [
  { key: "ligue1",     id: TSDB_LEAGUES.ligue1.id,     name: TSDB_LEAGUES.ligue1.name },
  { key: "premier",    id: TSDB_LEAGUES.premier.id,    name: TSDB_LEAGUES.premier.name },
  { key: "laliga",     id: TSDB_LEAGUES.laliga.id,     name: TSDB_LEAGUES.laliga.name },
  { key: "seriea",     id: TSDB_LEAGUES.seria?.id || TSDB_LEAGUES.seriea.id, name: TSDB_LEAGUES.seriea.name },
  { key: "bundesliga", id: TSDB_LEAGUES.bundesliga.id, name: TSDB_LEAGUES.bundesliga.name },
  { key: "ucl",        id: TSDB_LEAGUES.ucl.id,        name: TSDB_LEAGUES.ucl.name }
];

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/leagues", (req, res) => res.json(PUBLIC_LEAGUES));

// Prochains matchs d’une ligue (source TheSportsDB)
// Exemple : /api/fixtures?league=ucl   (ou ?league=4480)
app.get("/api/fixtures", async (req, res) => {
  try {
    let leagueParam = req.query.league;
    if (!leagueParam) return res.status(400).json({ error: "league required (key ou id)" });

    // On accepte soit la “key” (ucl, ligue1, etc.), soit l’ID chiffré
    let leagueId = Number(leagueParam);
    if (Number.isNaN(leagueId)) {
      const found = TSDB_LEAGUES[leagueParam];
      if (!found) return res.status(400).json({ error: "unknown league key" });
      leagueId = found.id;
    }

    // TheSportsDB : prochains événements d’une ligue
    const url = `${TSDB_BASE}/eventsnextleague.php?id=${leagueId}`;
    const r = await fetch(url);
    const j = await r.json();

    const events = j?.events || j?.event || [];
    const fixtures = events.map(ev => ({
      id: ev.idEvent,
      date: ev.dateEvent,
      time: ev.strTime,                // heure locale fournie par TSDB
      home: ev.strHomeTeam,
      away: ev.strAwayTeam,
      league: ev.strLeague,
      raw: ev
    }));

    res.json(fixtures);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------------------
   OPTION 3 : Moteur de pronos intégré
   ------------------------------------
   - Pas d’API externe
   - On calcule des chances via un petit modèle Poisson
   - Input : home, away, optionally strengthHome / strengthAway (0.7–1.3)
*/
function fact(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function pois(k,a){ return Math.exp(-a)*Math.pow(a,k)/fact(k); }

// Base goals (moyennes générales des grands championnats)
const BASE_HOME_XG = 1.45;
const BASE_AWAY_XG = 1.15;

// POST /api/predict  body: { strengthHome?, strengthAway?, maxGoals? }
app.post("/api/predict", (req, res) => {
  try {
    const { strengthHome=1.0, strengthAway=1.0, maxGoals=7 } = req.body || {};

    // xG ajustés par "force" (slider)
    const xgH = Math.max(0.2, BASE_HOME_XG * Number(strengthHome));
    const xgA = Math.max(0.2, BASE_AWAY_XG * Number(strengthAway));

    let pH=0,pD=0,pA=0, over25=0, scoregrid = [];
    for (let s1=0; s1<=maxGoals; s1++){
      for (let s2=0; s2<=maxGoals; s2++){
        const p = pois(s1,xgH) * pois(s2,xgA);
        if (s1>s2) pH+=p; else if (s1===s2) pD+=p; else pA+=p;
        if (s1+s2>=3) over25+=p;
        scoregrid.push({ s1, s2, p });
      }
    }

    scoregrid.sort((a,b)=>b.p-a.p);
    const topScores = scoregrid.slice(0,5).map(x=>({ score:`${x.s1}-${x.s2}`, p:+(x.p*100).toFixed(1) }));

    res.json({
      xgHome:+xgH.toFixed(2),
      xgAway:+xgA.toFixed(2),
      prob: {
        home:+(pH*100).toFixed(1),
        draw:+(pD*100).toFixed(1),
        away:+(pA*100).toFixed(1),
        over25:+(over25*100).toFixed(1)
      },
      topScores
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("LP2M backend live on " + PORT));
