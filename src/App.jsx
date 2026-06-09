import { useState, useEffect, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────
const RACE_DATE   = new Date("2026-09-06");
const START_DATE  = new Date("2026-05-25");
const N_WEEKS     = 15;
const STORAGE_KEY = "hm_bighalf_v1";

// Target 2:13–2:21 pace guide
const PACE_GUIDE = {
  "Easy Run":  { range:"7:10–7:30/km", tip:"Fully conversational. If you can't sing, slow down." },
  "Long Run":  { range:"7:00–7:20/km", tip:"Steady effort. Time on feet matters more than pace." },
  "Tempo Run": { range:"6:00–6:20/km", tip:"Comfortably hard. A few words, not full sentences." },
  "Intervals": { range:"5:35–5:55/km", tip:"Per rep only. Full recovery between. Quality over quantity." },
  "Race":      { range:"6:18–6:41/km", tip:"First 5km should feel almost too easy. Even splits win races." },
};


// ── Training milestones ───────────────────────────────────────────────────────
const MILESTONES = {
  6: {
    emoji: "👟",
    title: "Time to buy your race day trainers",
    body: "Head to a running store this week for a proper gait analysis. You need 6–8 weeks to break new shoes in before race day — don't leave it later. Bring your old pair so staff can assess your wear pattern.",
    color: "#FBBF24",
    bg: "rgba(251,191,36,0.07)",
    border: "rgba(251,191,36,0.2)",
  },
  7: {
    emoji: "🧂",
    title: "Introduce electrolytes on long runs",
    body: "Long runs start this week. Add electrolyte tabs (e.g. SiS, Nuun, or High5) to your water on any run over 45 minutes. This also primes your gut for race nutrition.",
    color: "#60A5FA",
    bg: "rgba(96,165,250,0.07)",
    border: "rgba(96,165,250,0.2)",
  },
  9: {
    emoji: "🍯",
    title: "Start practising with energy gels",
    body: "Your long runs are now 14km+ (~90 min on your feet). Take a gel at 45–50 min in. Use the same brand you plan to use on race day — never try anything new on the start line.",
    color: "#F97316",
    bg: "rgba(249,115,22,0.07)",
    border: "rgba(249,115,22,0.2)",
  },
};

// Period tracking (24-day cycle, 6-day period, first period Jun 8)
const PERIODS = [
  { start: new Date("2026-06-08"), end: new Date("2026-06-13"), num: 1 },
  { start: new Date("2026-07-02"), end: new Date("2026-07-07"), num: 2 },
  { start: new Date("2026-07-26"), end: new Date("2026-07-31"), num: 3 },
  { start: new Date("2026-08-19"), end: new Date("2026-08-24"), num: 4 },
];

function getPeriodInfo(dateStr) {
  const d = new Date(dateStr);
  for (const p of PERIODS) {
    if (d >= p.start && d <= p.end) {
      const day = Math.floor((d - p.start) / 86400000) + 1;
      return { onPeriod: true, day, num: p.num, heavy: day <= 2 };
    }
    const pre = new Date(p.start);
    pre.setDate(pre.getDate() - 2);
    if (d >= pre && d < p.start) return { onPeriod: false, isLuteal: true };
  }
  return { onPeriod: false, isLuteal: false };
}

function getPeriodWeeks() {
  const weeks = new Set();
  for (const p of PERIODS) {
    for (let d = new Date(p.start); d <= p.end; d.setDate(d.getDate() + 1)) {
      const wk = Math.floor((d - START_DATE) / 86400000 / 7) + 1;
      if (wk >= 1 && wk <= N_WEEKS) weeks.add(wk);
    }
  }
  return weeks;
}
const PERIOD_WEEKS = getPeriodWeeks();

// Intensity config
const INT = {
  low:    { l: "Easy",     c: "#4ADE80", bg: "rgba(74,222,128,0.08)",  b: "rgba(74,222,128,0.2)"  },
  medium: { l: "Tempo",    c: "#FB923C", bg: "rgba(251,146,60,0.08)",  b: "rgba(251,146,60,0.2)"  },
  high:   { l: "Hard",     c: "#F87171", bg: "rgba(248,113,113,0.08)", b: "rgba(248,113,113,0.2)" },
  gym:    { l: "Strength", c: "#818CF8", bg: "rgba(129,140,248,0.08)", b: "rgba(129,140,248,0.2)" },
  rest:   { l: "Rest",     c: "#2D3748", bg: "rgba(45,55,72,0.05)",    b: "rgba(45,55,72,0.1)"    },
  race:   { l: "Race Day", c: "#FBBF24", bg: "rgba(251,191,36,0.1)",   b: "rgba(251,191,36,0.35)" },
};
const ICON = {
  "Easy Run": "🏃", "Tempo Run": "⚡", "Long Run": "🛣️", "Intervals": "💥",
  "Rest": "💤", "Race": "🏆", "Legs (Gym)": "🏋️", "Upper Body (Gym)": "💪",
};
const FEEL = [
  { v: 1, e: "😵", l: "Brutal"  },
  { v: 2, e: "😓", l: "Hard"    },
  { v: 3, e: "😐", l: "Okay"    },
  { v: 4, e: "😊", l: "Good"    },
  { v: 5, e: "🔥", l: "Crushed" },
];
const MOOD_OPTS = ["Low energy", "Okay", "Good", "Great"];

// Strava helpers
function formatPace(movingTimeSec, distanceMetres) {
  if (!distanceMetres) return "—";
  const paceSecPerKm = movingTimeSec / (distanceMetres / 1000);
  const mins = Math.floor(paceSecPerKm / 60);
  const secs = Math.floor(paceSecPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}/km`;
}

// ── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#070A0E;color:#E2DDD6;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:2px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fi{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes bar{0%{left:-55%}100%{left:110%}}
.dn{font-family:'Bebas Neue',sans-serif;letter-spacing:.06em}
.fi{animation:fi .3s ease forwards}
.su{animation:slideUp .3s ease forwards}
.btn{background:#E84A00;color:#fff;border:none;border-radius:10px;padding:13px 22px;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;
  transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.btn:hover{background:#C94000;transform:translateY(-1px);box-shadow:0 6px 20px rgba(232,74,0,.3)}
.btn:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}
.ghost{background:rgba(255,255,255,.04);color:#6B7280;border:1px solid rgba(255,255,255,.08);
  border-radius:8px;padding:7px 12px;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:all .2s}
.ghost:hover{background:rgba(255,255,255,.08);color:#E2DDD6}
.card{background:#111620;border:1px solid rgba(255,255,255,.07);border-radius:14px}
.wchip{background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:8px;
  padding:5px 10px;font-size:11px;font-weight:500;color:#6B7280;cursor:pointer;
  white-space:nowrap;transition:all .2s;font-family:'DM Sans',sans-serif}
.wchip:hover{border-color:rgba(232,74,0,.4);color:#E2DDD6}
.wchip.on{background:rgba(232,74,0,.12);border-color:rgba(232,74,0,.5);color:#E84A00;font-weight:700}
.opt{border:1px solid rgba(255,255,255,.1);background:transparent;border-radius:8px;
  padding:7px 12px;font-size:13px;color:#6B7280;cursor:pointer;transition:all .18s;
  font-family:'DM Sans',sans-serif;white-space:nowrap}
.opt:hover{border-color:rgba(232,74,0,.3);color:#E2DDD6}
.opt.sel{border-color:#E84A00;background:rgba(232,74,0,.1);color:#E84A00;font-weight:600}
`;

// ── Deterministic plan builder ───────────────────────────────────────────────
// The plan is fully specified, so we build it locally — no API key required.
const WEEK_THEMES = [
  "Foundation", "Foundation", "Building", "Cutback & Recover", "Building",
  "First Tempo", "Long Run Begins", "Cutback & Recover", "Endurance",
  "Speed & Intervals", "Peak Building", "Peak Week", "Taper Begins",
  "Taper", "Race Week",
];

// Tuesday key run per week (index 0 = week 1)
const TUE_RUNS = [
  { km: 5,  type: "Easy Run"  }, { km: 5,  type: "Easy Run"  },
  { km: 6,  type: "Easy Run"  }, { km: 5,  type: "Easy Run"  },
  { km: 7,  type: "Easy Run"  }, { km: 8,  type: "Tempo Run" },
  { km: 6,  type: "Easy Run"  }, { km: 5,  type: "Easy Run"  },
  { km: 8,  type: "Tempo Run" }, { km: 8,  type: "Intervals" },
  { km: 10, type: "Tempo Run" }, { km: 8,  type: "Easy Run"  },
  { km: 6,  type: "Easy Run"  }, { km: 5,  type: "Easy Run"  },
  { km: 3,  type: "Easy Run"  },
];

// Wednesday long run distance (weeks 7–15); weeks 1–6 are an Upper Body gym day
const WED_LONG = { 7: 12, 8: 9, 9: 14, 10: 16, 11: 18, 12: 19, 13: 14, 14: 8, 15: 3 };

// Saturday easy run km per week; 0 = rest (week 15, legs fresh for race)
const SAT_KM = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 4, 3, 0];

const PLAN_START_MS = Date.UTC(2026, 4, 25); // Monday 25 May 2026
const DAY_MS = 86400000;
const DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MON_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PACE_MID_MIN = { "Easy Run": 7.33, "Long Run": 7.17, "Tempo Run": 6.17, "Intervals": 6.5, "Race": 6.5 };
const INTENSITY = { "Easy Run": "low", "Long Run": "low", "Tempo Run": "medium", "Intervals": "high", "Race": "race" };

const isoDate    = ms => new Date(ms).toISOString().split("T")[0];
const prettyDate = ms => { const d = new Date(ms); return `${d.getUTCDate()} ${MON_ABBR[d.getUTCMonth()]}`; };
const estDuration = (type, km) => `${Math.round(km * (PACE_MID_MIN[type] || 7))} min`;

function periodNote(dateStr) {
  const info = getPeriodInfo(dateStr);
  if (!info.onPeriod) return "";
  return info.heavy
    ? ` 🌸 Period day ${info.day} — ease intensity ~15% today; prioritise iron and hydration.`
    : ` 🌸 Period day ${info.day} — energy returning, trust the training.`;
}

function runDesc(type, role, km) {
  if (type === "Tempo Run") return `Tempo session — comfortably hard, a few words not full sentences. Warm up 1km easy, hold the effort, ease down. Target pace: ${PACE_GUIDE["Tempo Run"].range}.`;
  if (type === "Intervals") return `Interval session — quality over quantity. Full recovery between reps; hold per-rep pace only. Target: ${PACE_GUIDE["Intervals"].range}.`;
  if (role === "long")      return `Long run — time on feet matters more than pace. Steady, controlled effort. Flexible: shift to Thursday if your week needs it. Target pace: ${PACE_GUIDE["Long Run"].range}.`;
  if (role === "tuesday")   return `Your key mid-week run — the session that builds every week. Easy conversational effort. Target pace: ${PACE_GUIDE["Easy Run"].range}.`;
  return `Your regular Saturday ${km}km — your consistency anchor. Easy, enjoyable effort. Target pace: ${PACE_GUIDE["Easy Run"].range}.`;
}

function runSession(dayIdx, weekIdx, type, km, role) {
  const dateStr = isoDate(PLAN_START_MS + (weekIdx * 7 + dayIdx) * DAY_MS);
  return {
    dayOfWeek: DOW[dayIdx], date: dateStr, type,
    distance: `${km}km`, duration: estDuration(type, km), pace: PACE_GUIDE[type].range,
    description: runDesc(type, role, km) + periodNote(dateStr), intensity: INTENSITY[type],
  };
}

function staticSession(dayIdx, weekIdx, type, duration, intensity, desc) {
  const dateStr = isoDate(PLAN_START_MS + (weekIdx * 7 + dayIdx) * DAY_MS);
  return {
    dayOfWeek: DOW[dayIdx], date: dateStr, type,
    distance: "—", duration, pace: "—",
    description: desc + periodNote(dateStr), intensity,
  };
}

function buildPlan() {
  const weeks = [];
  for (let w = 0; w < N_WEEKS; w++) {
    const weekNumber = w + 1;
    const monMs = PLAN_START_MS + w * 7 * DAY_MS;
    const has3Runs = weekNumber >= 7;
    const sessions = [];

    // Monday — heavy legs
    sessions.push(staticSession(0, w, "Legs (Gym)", "60 min", "gym",
      "Heavy compound leg day. Squats, deadlifts, leg press, lunges, Romanian deadlifts. Warm up well."));

    // Tuesday — key mid-week run
    const tue = TUE_RUNS[w];
    sessions.push(runSession(1, w, tue.type, tue.km, "tuesday"));

    // Wednesday — Upper Body gym (wks 1–6) or long run (wks 7–15)
    if (has3Runs) {
      const longType = weekNumber === 15 ? "Easy Run" : "Long Run"; // wk15 is a 3km shakeout
      sessions.push(runSession(2, w, longType, WED_LONG[weekNumber], "long"));
    } else {
      sessions.push(staticSession(2, w, "Upper Body (Gym)", "45 min", "gym",
        "Bench press, bent-over rows, overhead press, pull-ups. Finish with 10 minutes of core work."));
    }

    // Thursday — rest (doubles as long-run flex day from wk 7)
    sessions.push(staticSession(3, w, "Rest", "—", "rest",
      has3Runs
        ? "Rest day. Or run your long run here instead of Wednesday if the week needs the flexibility."
        : "Full rest. Recovery is where the adaptation happens."));

    // Friday — lighter legs
    sessions.push(staticSession(4, w, "Legs (Gym)", "40 min", "gym",
      "Lighter leg session ahead of Saturday's run. Lunges, step-ups, Bulgarian split squats, calf raises. Keep it moderate."));

    // Saturday — easy run, or rest in race week
    const satKm = SAT_KM[w];
    if (satKm > 0) {
      sessions.push(runSession(5, w, "Easy Run", satKm, "saturday"));
    } else {
      sessions.push(staticSession(5, w, "Rest", "—", "rest",
        "Rest — keep the legs fresh. Race tomorrow: hydrate, eat well, lay out your kit."));
    }

    // Sunday — rest, or the race in week 15
    if (weekNumber === 15) {
      const dateStr = isoDate(monMs + 6 * DAY_MS);
      sessions.push({
        dayOfWeek: "Sunday", date: dateStr, type: "Race",
        distance: "21.1km", duration: "~2:17", pace: PACE_GUIDE["Race"].range,
        description: `🏆 THE BIG HALF. First 5km should feel almost too easy — even splits win races. Trust your training. Target pace: ${PACE_GUIDE["Race"].range}.`,
        intensity: "race",
      });
    } else {
      sessions.push(staticSession(6, w, "Rest", "—", "rest",
        "Rest and recover. Prepare mentally for the week ahead."));
    }

    // totalKm = running distance for the week, excluding the race itself
    const totalKm = sessions
      .filter(s => ["low", "medium", "high"].includes(s.intensity))
      .reduce((sum, s) => sum + (parseFloat(s.distance) || 0), 0);

    weeks.push({
      weekNumber,
      dateRange: `${prettyDate(monMs)} – ${prettyDate(monMs + 6 * DAY_MS)}`,
      theme: WEEK_THEMES[w],
      totalKm,
      sessions,
    });
  }
  return { weeks };
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,     setScreen]     = useState("loading");
  const [plan,       setPlan]       = useState(null);
  const [sw,         setSw]         = useState(1);
  const [gm,         setGm]         = useState("Mapping your schedule…");
  const [err,        setErr]        = useState(false);
  const [completed,  setCompleted]  = useState({});
  const [quizzes,    setQuizzes]    = useState({});
  const [quizSess,   setQuizSess]   = useState(null);
  const [strava,     setStrava]     = useState(null);
  const [stravaSync, setStravaSync] = useState("idle"); // idle|syncing|done|error

  const dtr = Math.ceil((RACE_DATE - new Date()) / 86400000);
  const cw  = Math.max(1, Math.min(N_WEEKS, Math.floor((new Date() - START_DATE) / 86400000 / 7) + 1));

  // Inject global CSS
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // On mount: handle Strava OAuth callback + load localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaToken   = params.get("strava_token");
    const stravaAthlete = params.get("strava_athlete");
    const stravaError   = params.get("strava_error");

    if (stravaToken) {
      const stravaData = {
        token:   stravaToken,
        refresh: params.get("strava_refresh"),
        expires: params.get("strava_expires"),
        athlete: stravaAthlete || "Athlete",
      };
      localStorage.setItem("strava", JSON.stringify(stravaData));
      setStrava(stravaData);
      window.history.replaceState({}, "", "/");
    } else if (stravaError) {
      window.history.replaceState({}, "", "/");
    } else {
      const stored = localStorage.getItem("strava");
      if (stored) {
        try { setStrava(JSON.parse(stored)); } catch (_) {}
      }
    }

    // Load plan data
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const s = JSON.parse(stored);
        setPlan(s.plan);
        setCompleted(s.completed || {});
        setQuizzes(s.quizzes || {});
        setSw(cw);
        setScreen("dashboard");
      } else {
        setScreen("generating");
        genPlan();
      }
    } catch {
      setScreen("generating");
      genPlan();
    }
  }, []);

  function saveLocal(newPlan, newCompleted, newQuizzes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      plan:      newPlan      || plan,
      completed: newCompleted || completed,
      quizzes:   newQuizzes   || quizzes,
    }));
  }

  function toggleComplete(s) {
    const isRun = ["low", "medium", "high", "race"].includes(s.intensity);
    const key   = s.date;
    if (completed[key]) {
      const nc = { ...completed };
      delete nc[key];
      setCompleted(nc);
      saveLocal(null, nc, null);
    } else if (isRun) {
      setQuizSess(s);
    } else {
      const nc = { ...completed, [key]: true };
      setCompleted(nc);
      saveLocal(null, nc, null);
    }
  }

  function submitQuiz(data) {
    const key = quizSess.date;
    const nc  = { ...completed, [key]: true };
    const nq  = { ...quizzes, [key]: data };
    setCompleted(nc);
    setQuizzes(nq);
    saveLocal(null, nc, nq);
    setQuizSess(null);
  }


  // Auto-sync Strava on load (once, when both plan and strava token are ready)
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (plan && strava && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      syncStrava();
    }
  }, [plan, strava]);

  // ── Plan generation ──────────────────────────────────────────────────────
  // Built locally and deterministically — no API key or network required.
  function genPlan() {
    setErr(false);
    try {
      const p = buildPlan();
      setPlan(p);
      setSw(cw);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ plan: p, completed: {}, quizzes: {} }));
      setScreen("dashboard");
    } catch (e) {
      console.error(e);
      setErr(true);
      setScreen("generating");
      setGm("Something went wrong — tap Retry.");
    }
  }

  // ── Strava sync ──────────────────────────────────────────────────────────
  function connectStrava() {
    const clientId    = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/strava-auth`;
    const scope       = "activity:read_all";
    window.location.href =
      `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  }

  async function syncStrava() {
    if (!strava?.token) return;
    setStravaSync("syncing");

    // ── Refresh token if expired or expiring in <5 min ──────────────────────
    let activeToken = strava.token;
    const nowSec = Math.floor(Date.now() / 1000);
    if (strava.expires && parseInt(strava.expires) < nowSec + 300) {
      try {
        const refreshRes = await fetch(`/api/strava-refresh?refresh_token=${encodeURIComponent(strava.refresh)}`);
        if (refreshRes.ok) {
          const newTokenData = await refreshRes.json();
          const updatedStrava = {
            ...strava,
            token:   newTokenData.access_token,
            expires: newTokenData.expires_at,
            refresh: newTokenData.refresh_token,
          };
          localStorage.setItem("strava", JSON.stringify(updatedStrava));
          setStrava(updatedStrava);
          activeToken = newTokenData.access_token;
        } else {
          localStorage.removeItem("strava");
          setStrava(null);
          setStravaSync("error");
          return;
        }
      } catch (e) {
        console.error("Strava token refresh failed:", e);
        setStravaSync("error");
        return;
      }
    }

    try {
      const after  = Math.floor(START_DATE.getTime() / 1000);
      const before = Math.floor(Date.now() / 1000);
      const res    = await fetch(`/api/strava-activities?token=${activeToken}&after=${after}&before=${before}`);

      if (res.status === 401) {
        localStorage.removeItem("strava");
        setStrava(null);
        setStravaSync("error");
        return;
      }

      const activities = await res.json();

      // Build date → run activity map
      const runsByDate = {};
      for (const act of activities) {
        if (act.type === "Run" || act.sport_type === "Run") {
          const date = new Date(act.start_date_local).toISOString().split("T")[0];
          runsByDate[date] = {
            pace:  formatPace(act.moving_time, act.distance),
            dist:  `${(act.distance / 1000).toFixed(2)}km`,
            name:  act.name,
            id:    act.id,
          };
        }
      }

      // Auto-complete matching sessions
      const nc = { ...completed };
      const nq = { ...quizzes };
      let matched = 0;

      plan.weeks.forEach(week => {
        week.sessions.forEach(session => {
          const isRun = ["low", "medium", "high", "race"].includes(session.intensity);
          if (isRun && runsByDate[session.date]) {
            const act = runsByDate[session.date];
            if (!nc[session.date]) {
              nc[session.date] = true;
              nq[session.date] = {
                feel: null,
                pace: act.pace,
                mood: "",
                notes: `Auto-synced from Strava: "${act.name}" (${act.dist})`,
                fromStrava: true,
              };
              matched++;
            }
          }
        });
      });

      setCompleted(nc);
      setQuizzes(nq);
      saveLocal(null, nc, nq);
      setStravaSync(matched > 0 ? "done" : "idle");
    } catch (e) {
      console.error("Strava sync error:", e);
      setStravaSync("error");
    }
  }

  // ── Calendar export (.ics) ────────────────────────────────────────────────
  function exportICS() {
    const runs = plan.weeks.flatMap(w => w.sessions).filter(s =>
      ["low", "medium", "high", "race"].includes(s.intensity)
    );
    const gym = plan.weeks.flatMap(w => w.sessions).filter(s => s.intensity === "gym");

    function icsDate(dateStr) { return dateStr.replace(/-/g, ""); }
    function nextDay(dateStr) {
      const d = new Date(dateStr); d.setDate(d.getDate() + 1);
      return d.toISOString().split("T")[0].replace(/-/g, "");
    }

    let ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//The Big Half Training//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:The Big Half Training",
    ].join("\r\n");

    [...runs, ...gym].forEach(s => {
      const desc = s.description.replace(/[,;\\]/g, "").replace(/\n/g, "\\n");
      ics += "\r\nBEGIN:VEVENT\r\n" +
        `DTSTART;VALUE=DATE:${icsDate(s.date)}\r\n` +
        `DTEND;VALUE=DATE:${nextDay(s.date)}\r\n` +
        `SUMMARY:${s.type}${s.distance !== "—" ? " – " + s.distance : ""}\r\n` +
        `DESCRIPTION:${desc}\r\n` +
        `CATEGORIES:${s.intensity === "gym" ? "GYM" : "RUNNING"}\r\n` +
        "END:VEVENT";
    });

    // Period reminders
    PERIODS.forEach(p => {
      const ds = p.start.toISOString().split("T")[0].replace(/-/g, "");
      const de = new Date(p.end); de.setDate(de.getDate() + 1);
      const de_s = de.toISOString().split("T")[0].replace(/-/g, "");
      ics += "\r\nBEGIN:VEVENT\r\n" +
        `DTSTART;VALUE=DATE:${ds}\r\n` +
        `DTEND;VALUE=DATE:${de_s}\r\n` +
        "SUMMARY:🌸 Period – Adjust Training\r\n" +
        "DESCRIPTION:Days 1-2: reduce intensity 10-15% and prioritise iron and hydration. Energy returns from day 3.\r\n" +
        "CATEGORIES:HEALTH\r\n" +
        "END:VEVENT";
    });

    ics += "\r\nEND:VCALENDAR";

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "big-half-training.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function disconnectStrava() {
    localStorage.removeItem("strava");
    setStrava(null);
    setStravaSync("idle");
  }

  function resetPlan() {
    localStorage.removeItem(STORAGE_KEY);
    setPlan(null); setCompleted({}); setQuizzes({});
    setStravaSync("idle"); genPlan();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (screen === "loading" || screen === "generating") {
    return <Generating msg={gm} onRetry={err ? genPlan : null} />;
  }

  return (
    <>
      <Dashboard
        plan={plan} sw={sw} setSw={setSw} cw={cw} dtr={dtr}
        completed={completed} quizzes={quizzes} onToggle={toggleComplete}
        strava={strava} stravaSync={stravaSync}
        onConnectStrava={connectStrava} onSyncStrava={syncStrava} onDisconnectStrava={disconnectStrava}
        onExportICS={exportICS} onReset={resetPlan}
      />
      {quizSess && (
        <QuizModal session={quizSess} onSubmit={submitQuiz} onClose={() => setQuizSess(null)} />
      )}
    </>
  );
}

// ── Generating screen ────────────────────────────────────────────────────────
function Generating({ msg, onRetry }) {
  return (
    <div style={{ minHeight: "100vh", background: "#070A0E", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26 }}>
      <div className="dn" style={{ fontSize: 42, color: "#E84A00", textAlign: "center", padding: "0 20px", lineHeight: 1.15 }}>
        BUILDING YOUR<br />TRAINING PLAN
      </div>
      <div style={{ width: 220, height: 3, background: "rgba(255,255,255,.07)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", height: "100%", width: "50%", background: "#E84A00", borderRadius: 2, animation: "bar 1.9s ease-in-out infinite" }} />
      </div>
      <div style={{ fontSize: 13, color: "#6B7280", animation: "pulse 1.6s ease infinite", textAlign: "center", padding: "0 28px" }}>{msg}</div>
      {onRetry && <button className="btn" onClick={onRetry} style={{ marginTop: 6 }}>Retry →</button>}
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px 16px", fontSize: 11, color: "#1F2937", textAlign: "center", padding: "0 20px" }}>
        {["🏋️ Mon Legs", "🏃 Tue Key Run", "💪 Wed Upper", "💤 Thu Rest", "🏋️ Fri Legs", "🏃 Sat 5km"].map(l => <span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ plan, sw, setSw, cw, dtr, completed, quizzes, onToggle, strava, stravaSync, onConnectStrava, onSyncStrava, onDisconnectStrava, onExportICS, onReset }) {
  const chipRef = useRef(null);
  const wd = plan?.weeks?.find(w => w.weekNumber === sw);

  const allRuns  = plan?.weeks.flatMap(w => w.sessions).filter(s => ["low","medium","high","race"].includes(s.intensity)) ?? [];
  const doneRuns = allRuns.filter(s => completed[s.date]);
  const pct      = allRuns.length > 0 ? Math.round((doneRuns.length / allRuns.length) * 100) : 0;

  const wkRunTotal = wd?.sessions?.filter(s => ["low","medium","high","race"].includes(s.intensity)).length ?? 0;
  const wkRunDone  = wd?.sessions?.filter(s => ["low","medium","high","race"].includes(s.intensity) && completed[s.date]).length ?? 0;
  const wkGymTotal = wd?.sessions?.filter(s => s.intensity === "gym").length ?? 0;
  const wkGymDone  = wd?.sessions?.filter(s => s.intensity === "gym" && completed[s.date]).length ?? 0;

  const isPeriod = PERIOD_WEEKS.has(sw);
  const is3rdRun = sw >= 7;

  useEffect(() => {
    if (chipRef.current) {
      chipRef.current.querySelector(".wchip.on")?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [sw]);

  return (
    <div style={{ background: "#070A0E", minHeight: "100vh", maxWidth: 700, margin: "0 auto", paddingBottom: 160 }}>

      {/* ── Sticky header ── */}
      <div style={{ position: "sticky", top: 0, background: "#070A0E", zIndex: 10, padding: "14px 16px 0", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div className="dn" style={{ fontSize: 26, color: "#E84A00", lineHeight: 1 }}>THE BIG HALF</div>
            <div style={{ fontSize: 10, color: "#374151", marginTop: 2, letterSpacing: ".1em", textTransform: "uppercase" }}>London · 6 Sep 2026</div>
          </div>
          <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
            <div style={{ background: "rgba(232,74,0,.1)", border: "1px solid rgba(232,74,0,.22)", borderRadius: 9, padding: "4px 11px", textAlign: "center" }}>
              <div className="dn" style={{ fontSize: 22, color: "#E84A00", lineHeight: 1 }}>{dtr}</div>
              <div style={{ fontSize: 9, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".1em" }}>days</div>
            </div>
            <button className="ghost" style={{ padding: "5px 9px", fontSize: 13 }} onClick={onReset} title="Regenerate plan">⚙</button>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 11 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: "#4B5563", textTransform: "uppercase", letterSpacing: ".08em" }}>Run sessions</span>
            <span style={{ fontSize: 10, color: "#6B7280" }}>{doneRuns.length}/{allRuns.length} · {pct}%</span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,.07)", borderRadius: 2 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "#E84A00", borderRadius: 2, transition: "width .5s" }} />
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 6, marginTop: 11, overflowX: "auto", paddingBottom: 2 }}>
          {[
            ["Week", `${cw}/${N_WEEKS}`],
            ["Runs", `${wkRunDone}/${wkRunTotal}`],
            ["Gym",  `${wkGymDone}/${wkGymTotal}`],
            ["Km",   wd ? `${wd.totalKm}km` : "—"],
            ["Phase", wd?.theme || "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ background: "#111620", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "6px 11px", flexShrink: 0 }}>
              <div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: ".08em" }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E2DDD6", marginTop: 1 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginTop: 9, overflowX: "auto" }}>
          {[["#4ADE80","Running"],["#818CF8","Gym"],["#EC4899","Period"]].map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
              <span style={{ fontSize: 10, color: "#4B5563" }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Week chips */}
        <div ref={chipRef} style={{ display: "flex", gap: 4, overflowX: "auto", padding: "9px 0 12px", scrollbarWidth: "none" }}>
          {plan.weeks.map(w => {
            const hasPeriod  = PERIOD_WEEKS.has(w.weekNumber);
            const isCur      = w.weekNumber === cw;
            return (
              <button key={w.weekNumber} className={`wchip ${sw === w.weekNumber ? "on" : ""}`}
                onClick={() => setSw(w.weekNumber)}
                style={{ position: "relative", borderColor: sw === w.weekNumber ? undefined : hasPeriod ? "rgba(236,72,153,.25)" : undefined }}>
                W{w.weekNumber}
                {isCur && <span style={{ color: "#FBBF24", fontSize: 7, marginLeft: 2 }}>●</span>}
                {hasPeriod && !isCur && <span style={{ color: "#EC4899", fontSize: 7, marginLeft: 2 }}>●</span>}
                {w.weekNumber === 7 && <span style={{ position: "absolute", top: -7, right: -3, fontSize: 7, color: "#818CF8", fontWeight: 700, background: "#070A0E", padding: "0 1px" }}>+3</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Week content ── */}
      {wd && (
        <div style={{ padding: "14px 16px" }}>

          {/* Week header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Week {wd.weekNumber} — <span style={{ color: "#E84A00" }}>{wd.theme}</span></div>
              <div style={{ fontSize: 11, color: "#374151", marginTop: 1 }}>{wd.dateRange}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="dn" style={{ fontSize: 26, color: "#E2DDD6", lineHeight: 1 }}>{wd.totalKm}km</div>
              <div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase" }}>running</div>
            </div>
          </div>

          {/* Banners */}
          {sw === 7 && (
            <div style={{ marginBottom: 10, padding: "10px 13px", background: "rgba(129,140,248,.07)", border: "1px solid rgba(129,140,248,.2)", borderRadius: 10, display: "flex", gap: 9 }}>
              <span style={{ fontSize: 16 }}>🎯</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#818CF8" }}>3 run days start here</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Wednesday is now your long run. Flexible — shift to Thursday based on how you feel. Keep Friday legs lighter if you run Thursday.</div>
              </div>
            </div>
          )}
          {isPeriod && (
            <div style={{ marginBottom: 10, padding: "10px 13px", background: "rgba(236,72,153,.06)", border: "1px solid rgba(236,72,153,.18)", borderRadius: 10, display: "flex", gap: 9 }}>
              <span style={{ fontSize: 16 }}>🌸</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#EC4899" }}>Period week</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Days 1–2 are toughest — ease off 10–15%, prioritise iron and hydration. Strength typically returns from day 3.</div>
              </div>
            </div>
          )}

          {/* Pace reference */}
          <div style={{ marginBottom: 12, padding: "10px 13px", background: "#0D1219", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10 }}>
            <div style={{ fontSize: 10, color: "#374151", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 7 }}>This week's pace targets · 2:13–2:21 goal</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px 18px" }}>
              {Object.entries(PACE_GUIDE)
                .filter(([k]) => wd.sessions.some(s => s.type === k))
                .map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 10, color: "#6B7280" }}>{k.replace(" Run", "")}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#E2DDD6" }}>{v.range}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Milestone reminder */}
          {MILESTONES[sw] && (
            <div style={{ marginBottom: 12, padding: "12px 14px", background: MILESTONES[sw].bg, border: `1px solid ${MILESTONES[sw].border}`, borderRadius: 10, display: "flex", gap: 11, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{MILESTONES[sw].emoji}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: MILESTONES[sw].color, marginBottom: 3 }}>{MILESTONES[sw].title}</div>
                <div style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.55 }}>{MILESTONES[sw].body}</div>
              </div>
            </div>
          )}

          {/* Sessions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {wd.sessions.map((s, i) => (
              <SCard key={i} s={s}
                past={new Date(s.date) < new Date()}
                completed={!!completed[s.date]}
                quiz={quizzes[s.date]}
                onToggle={() => onToggle(s)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 700, padding: "8px 16px 20px", background: "linear-gradient(to top,#070A0E 55%,transparent)" }}>

        {/* Strava row */}
        <div style={{ marginBottom: 8 }}>
          {!strava ? (
            <button onClick={onConnectStrava}
              style={{ width: "100%", padding: "11px 0", background: "rgba(252,76,2,.1)", border: "1px solid rgba(252,76,2,.3)", borderRadius: 10, color: "#FC4C02", fontFamily: "DM Sans,sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#FC4C02"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
              Connect Strava — auto-complete your runs
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onSyncStrava} disabled={stravaSync === "syncing"}
                style={{ flex: 1, padding: "10px 0", background: stravaSync === "done" ? "rgba(74,222,128,.1)" : "rgba(252,76,2,.1)", border: `1px solid ${stravaSync === "done" ? "rgba(74,222,128,.3)" : "rgba(252,76,2,.3)"}`, borderRadius: 10, color: stravaSync === "done" ? "#4ADE80" : "#FC4C02", fontFamily: "DM Sans,sans-serif", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all .2s" }}>
                {stravaSync === "idle"    && `⚡ Sync Strava · ${strava.athlete}`}
                {stravaSync === "syncing" && "⏳ Syncing…"}
                {stravaSync === "done"    && "✅ Strava synced"}
                {stravaSync === "error"   && "⚠️ Retry sync"}
              </button>
              <button className="ghost" style={{ padding: "10px 12px", fontSize: 12 }} onClick={onDisconnectStrava}>Disconnect</button>
            </div>
          )}
        </div>

        {/* Calendar export */}
        <button className="btn" style={{ width: "100%", justifyContent: "center", padding: 13, fontSize: 13 }} onClick={onExportICS}>
          📅  Download calendar (.ics) — import to Google, Apple or Outlook
        </button>
      </div>
    </div>
  );
}

// ── Session Card ─────────────────────────────────────────────────────────────
function SCard({ s, past, completed, quiz, onToggle }) {
  const [open, setOpen] = useState(false);
  const cfg     = INT[s.intensity] || INT.rest;
  const isRest  = s.intensity === "rest";
  const isRun   = ["low", "medium", "high", "race"].includes(s.intensity);
  const isGym   = s.intensity === "gym";
  const pg      = PACE_GUIDE[s.type];
  const pi      = getPeriodInfo(s.date);
  const isToday = new Date(s.date).toDateString() === new Date().toDateString();

  return (
    <div className="card"
      style={{
        padding: "11px 13px",
        opacity: (past && !completed) ? 0.55 : 1,
        background: isToday ? "#161D2A" : open ? "#161D28" : "#111620",
        borderColor: completed ? "rgba(74,222,128,.2)" : isToday ? "rgba(251,191,36,.22)" : pi.onPeriod && pi.heavy ? "rgba(236,72,153,.18)" : "rgba(255,255,255,.07)",
        transition: "all .18s",
      }}>

      {isToday && !completed && <div style={{ fontSize: 9, color: "#FBBF24", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 5 }}>TODAY</div>}
      {pi.onPeriod && <div style={{ fontSize: 9, color: "#EC4899", fontWeight: 600, marginBottom: 4 }}>🌸 Period day {pi.day}{pi.heavy ? " — ease off today" : ""}</div>}
      {pi.isLuteal && !pi.onPeriod && <div style={{ fontSize: 9, color: "rgba(236,72,153,.45)", marginBottom: 4 }}>Pre-period — energy may dip slightly</div>}
      {quiz?.fromStrava && <div style={{ fontSize: 9, color: "rgba(252,76,2,.7)", marginBottom: 4 }}>⚡ Synced from Strava</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Checkbox */}
        {!isRest && (
          <button onClick={e => { e.stopPropagation(); onToggle(); }}
            style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `2px solid ${completed ? "#4ADE80" : "rgba(255,255,255,.15)"}`, background: completed ? "rgba(74,222,128,.15)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s" }}>
            {completed && <span style={{ fontSize: 12, color: "#4ADE80" }}>✓</span>}
          </button>
        )}

        <div style={{ fontSize: 18, width: 28, textAlign: "center", flexShrink: 0 }}>{ICON[s.type] || "📅"}</div>

        <div style={{ flex: 1, minWidth: 0, cursor: isRest ? "default" : "pointer" }} onClick={() => !isRest && setOpen(o => !o)}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 1 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: ".07em" }}>{s.dayOfWeek}</span>
            {completed && <span style={{ fontSize: 9, background: isGym ? "rgba(129,140,248,.12)" : "rgba(74,222,128,.1)", color: isGym ? "#818CF8" : "#4ADE80", padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>DONE</span>}
            {s.type === "Long Run" && <span style={{ fontSize: 9, color: "rgba(129,140,248,.6)", padding: "1px 5px", borderRadius: 3, background: "rgba(129,140,248,.07)" }}>flex Wed/Thu</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: isRest ? "#1F2937" : "#E2DDD6" }}>{s.type}</div>
        </div>

        {!isRest && (
          <div style={{ textAlign: "right", flexShrink: 0, cursor: "pointer" }} onClick={() => !isRest && setOpen(o => !o)}>
            <div style={{ fontSize: 14, fontWeight: 700, color: completed ? "rgba(74,222,128,.7)" : "#E2DDD6" }}>{s.distance}</div>
            <div style={{ fontSize: 10, color: "#6B7280" }}>{s.duration}</div>
            <div style={{ fontSize: 8, fontWeight: 700, color: cfg.c, background: cfg.bg, border: `1px solid ${cfg.b}`, padding: "2px 6px", borderRadius: 4, marginTop: 3, letterSpacing: ".07em", textTransform: "uppercase", display: "inline-block" }}>{cfg.l}</div>
          </div>
        )}
      </div>

      {/* Expanded detail */}
      {open && !isRest && (
        <div className="fi" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.05)" }}>
          {pg && (
            <div style={{ marginBottom: 9, padding: "9px 11px", background: "rgba(232,74,0,.05)", border: "1px solid rgba(232,74,0,.12)", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: "#E84A00", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>Target for 2:13–2:21</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#E84A00" }}>{pg.range}</span>
              </div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{pg.tip}</div>
            </div>
          )}
          {isRun && (
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <div><div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: ".07em" }}>Plan pace</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{s.pace}</div></div>
              <div><div style={{ fontSize: 9, color: "#374151", textTransform: "uppercase", letterSpacing: ".07em" }}>Duration</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 1 }}>{s.duration}</div></div>
              {quiz?.pace && <div><div style={{ fontSize: 9, color: "#4ADE80", textTransform: "uppercase", letterSpacing: ".07em" }}>Actual</div><div style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80", marginTop: 1 }}>{quiz.pace}</div></div>}
            </div>
          )}
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, background: "#0A0E14", padding: "9px 11px", borderRadius: 7, marginBottom: quiz ? 8 : 0 }}>{s.description}</div>
          {quiz && (
            <div style={{ display: "flex", gap: 10, padding: "8px 11px", background: "rgba(74,222,128,.04)", border: "1px solid rgba(74,222,128,.1)", borderRadius: 7, marginTop: 8, flexWrap: "wrap" }}>
              {quiz.feel && <span style={{ fontSize: 18 }}>{FEEL.find(f => f.v === quiz.feel)?.e}</span>}
              <div style={{ fontSize: 11, color: "#6B7280" }}>
                {quiz.feel && <span style={{ color: "#4ADE80", fontWeight: 600 }}>{FEEL.find(f => f.v === quiz.feel)?.l}</span>}
                {quiz.mood && <> · {quiz.mood}</>}
                {quiz.notes && <div style={{ marginTop: 3, fontStyle: "italic" }}>"{quiz.notes}"</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quiz Modal ───────────────────────────────────────────────────────────────
function QuizModal({ session, onSubmit, onClose }) {
  const [feel,  setFeel]  = useState(null);
  const [pace,  setPace]  = useState("");
  const [mood,  setMood]  = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,.75)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="su" style={{ width: "100%", maxWidth: 700, margin: "0 auto", background: "#111620", borderRadius: "18px 18px 0 0", padding: "20px 18px 32px", border: "1px solid rgba(255,255,255,.08)" }}>

        <div style={{ width: 38, height: 4, background: "rgba(255,255,255,.1)", borderRadius: 2, margin: "0 auto 16px" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>How was your run? 🏃</div>
            <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2 }}>{session.type} · {session.distance} · {session.dayOfWeek}</div>
          </div>
          <button className="ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕</button>
        </div>

        {/* How did it feel */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 9 }}>How did it feel?</div>
          <div style={{ display: "flex", gap: 7 }}>
            {FEEL.map(f => (
              <button key={f.v} onClick={() => setFeel(f.v)}
                style={{ flex: 1, padding: "10px 4px", border: `1px solid ${feel === f.v ? "#4ADE80" : "rgba(255,255,255,.08)"}`, background: feel === f.v ? "rgba(74,222,128,.08)" : "transparent", borderRadius: 9, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, transition: "all .15s" }}>
                <span style={{ fontSize: 20 }}>{f.e}</span>
                <span style={{ fontSize: 9, color: feel === f.v ? "#4ADE80" : "#374151", fontWeight: 600, textTransform: "uppercase" }}>{f.l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Actual pace */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
            Actual pace <span style={{ color: "#374151", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </div>
          <input value={pace} onChange={e => setPace(e.target.value)} placeholder={`Plan: ${session.pace}`}
            style={{ width: "100%", background: "#0D1219", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "10px 12px", fontSize: 14, color: "#E2DDD6", fontFamily: "DM Sans,sans-serif", outline: "none" }} />
          {PACE_GUIDE[session.type] && (
            <div style={{ fontSize: 11, color: "#374151", marginTop: 5 }}>
              2:13–2:21 target: <span style={{ color: "#E84A00", fontWeight: 600 }}>{PACE_GUIDE[session.type].range}</span>
            </div>
          )}
        </div>

        {/* Mood */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>Energy going in</div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {MOOD_OPTS.map(m => (
              <button key={m} className={`opt ${mood === m ? "sel" : ""}`} onClick={() => setMood(m)}>{m}</button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
            Notes <span style={{ color: "#374151", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Anything worth remembering…" rows={2}
            style={{ width: "100%", background: "#0D1219", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#E2DDD6", fontFamily: "DM Sans,sans-serif", resize: "none", outline: "none" }} />
        </div>

        {/* Reschedule note */}
        <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" id="rescheduled" checked={notes.startsWith("🔄")}
            onChange={e => setNotes(e.target.checked ? "🔄 Did this on a different day — " + notes.replace(/^🔄 Did this on a different day — /, "") : notes.replace(/^🔄 Did this on a different day — /, ""))}
            style={{ accentColor: "#E84A00", width: 15, height: 15, cursor: "pointer" }} />
          <label htmlFor="rescheduled" style={{ fontSize: 12, color: "#6B7280", cursor: "pointer" }}>I did this on a different day</label>
        </div>

        <button className="btn" style={{ width: "100%", justifyContent: "center", padding: 14 }}
          disabled={feel === null}
          onClick={() => onSubmit({ feel, pace, mood, notes })}>
          ✓ Mark as complete
        </button>
      </div>
    </div>
  );
}
