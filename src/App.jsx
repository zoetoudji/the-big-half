import { useState, useEffect, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const RACE_DATE   = new Date("2026-09-06");
const START_DATE  = new Date("2026-05-25");
const N_WEEKS     = 15;
const STORAGE_KEY = "hm_bighalf_v1";
const PERIODS_KEY = "hm_periods_v1";

const PACE_GUIDE = {
  "Easy Run":  { range:"7:10–7:30/km", tip:"Fully conversational. If you can't sing, slow down." },
  "Long Run":  { range:"7:00–7:20/km", tip:"Steady effort. Time on feet matters more than pace." },
  "Tempo Run": { range:"6:00–6:20/km", tip:"Comfortably hard. A few words, not full sentences." },
  "Intervals": { range:"5:35–5:55/km", tip:"Per rep only. Full recovery between. Quality over quantity." },
  "Race":      { range:"6:18–6:41/km", tip:"First 5km should feel almost too easy. Even splits win races." },
};

const DEFAULT_PERIODS = [
  { start: new Date("2026-06-08"), end: new Date("2026-06-13"), num: 1 },
  { start: new Date("2026-07-02"), end: new Date("2026-07-07"), num: 2 },
  { start: new Date("2026-07-26"), end: new Date("2026-07-31"), num: 3 },
  { start: new Date("2026-08-19"), end: new Date("2026-08-24"), num: 4 },
];

function loadPeriods() {
  try {
    const s = localStorage.getItem(PERIODS_KEY);
    if (s) {
      return JSON.parse(s).map(p => ({ ...p, start: new Date(p.start), end: new Date(p.end) }));
    }
  } catch (_) {}
  return DEFAULT_PERIODS;
}

function getPeriodInfo(dateStr, periods) {
  const d = new Date(dateStr);
  for (const p of periods) {
    if (d >= p.start && d <= p.end) {
      const day = Math.floor((d - p.start) / 86400000) + 1;
      return { onPeriod: true, day, num: p.num, heavy: day <= 2 };
    }
    const pre = new Date(p.start); pre.setDate(pre.getDate() - 2);
    if (d >= pre && d < p.start) return { onPeriod: false, isLuteal: true };
  }
  return { onPeriod: false, isLuteal: false };
}

function getPeriodWeeks(periods) {
  const weeks = new Set();
  for (const p of periods) {
    for (let d = new Date(p.start); d <= p.end; d.setDate(d.getDate() + 1)) {
      const wk = Math.floor((d - START_DATE) / 86400000 / 7) + 1;
      if (wk >= 1 && wk <= N_WEEKS) weeks.add(wk);
    }
  }
  return weeks;
}

const MILESTONES = {
  6: { emoji:"👟", title:"Time to buy your race day trainers", color:"#D97706", bg:"rgba(217,119,6,0.06)", border:"rgba(217,119,6,0.2)",
    body:"Head to a running store for a gait analysis. You need 6–8 weeks to break them in before race day." },
  7: { emoji:"🧂", title:"Introduce electrolytes on long runs", color:"#2563EB", bg:"rgba(37,99,235,0.06)", border:"rgba(37,99,235,0.2)",
    body:"Long runs start this week. Add electrolyte tabs to your water on any run over 45 minutes." },
  9: { emoji:"🍯", title:"Start practising with energy gels", color:"#D97706", bg:"rgba(217,119,6,0.06)", border:"rgba(217,119,6,0.2)",
    body:"14km+ runs mean 90+ min on your feet. Take a gel at 45–50 min in. Always use race-day brands in training." },
};

const INT = {
  low:    { l:"Easy",     c:"#16A34A", bg:"rgba(22,163,74,0.08)",    b:"rgba(22,163,74,0.2)"    },
  medium: { l:"Tempo",    c:"#D97706", bg:"rgba(217,119,6,0.08)",    b:"rgba(217,119,6,0.2)"    },
  high:   { l:"Hard",     c:"#DC2626", bg:"rgba(220,38,38,0.08)",    b:"rgba(220,38,38,0.2)"    },
  gym:    { l:"Strength", c:"#7C3AED", bg:"rgba(124,58,237,0.08)",   b:"rgba(124,58,237,0.2)"   },
  rest:   { l:"Rest",     c:"#94A3B8", bg:"rgba(148,163,184,0.06)",  b:"rgba(148,163,184,0.15)" },
  race:   { l:"Race Day", c:"#2563EB", bg:"rgba(37,99,235,0.1)",     b:"rgba(37,99,235,0.35)"   },
};
const ICON = {
  "Easy Run":"🏃","Tempo Run":"⚡","Long Run":"🛣️","Intervals":"💥",
  "Rest":"💤","Race":"🏆","Legs (Gym)":"🏋️","Upper Body (Gym)":"💪",
};
const FEEL = [
  {v:1,e:"😵",l:"Brutal"},{v:2,e:"😓",l:"Hard"},{v:3,e:"😐",l:"Okay"},
  {v:4,e:"😊",l:"Good"},{v:5,e:"🔥",l:"Crushed"},
];
const MOOD_OPTS = ["Low energy","Okay","Good","Great"];

function formatPace(movingTimeSec, distanceMetres) {
  if (!distanceMetres) return "—";
  const s = movingTimeSec / (distanceMetres / 1000);
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}/km`;
}

function parsePaceToMin(paceStr) {
  if (!paceStr || paceStr === "—") return null;
  const m = paceStr.match(/(\d+):(\d+)/);
  if (!m) return null;
  return parseInt(m[1]) + parseInt(m[2]) / 60;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',sans-serif;background:#F8FAFC;color:#0F172A;-webkit-tap-highlight-color:transparent}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-thumb{background:rgba(15,23,42,.14);border-radius:2px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes bar{0%{left:-55%}100%{left:110%}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.dn{font-family:'Bebas Neue',sans-serif;letter-spacing:.06em}
.fi{animation:fi .25s ease forwards}
.su{animation:slideUp .3s ease forwards}
.btn{background:#2563EB;color:#fff;border:none;border-radius:12px;padding:14px 24px;
  font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;
  transition:all .2s;display:inline-flex;align-items:center;gap:8px;letter-spacing:.01em}
.btn:hover{background:#1D4ED8;transform:translateY(-1px);box-shadow:0 8px 24px rgba(37,99,235,.3)}
.btn:disabled{opacity:.35;cursor:not-allowed;transform:none;box-shadow:none}
.btn-ghost{background:transparent;color:rgba(15,23,42,.45);border:1px solid rgba(15,23,42,.12);
  border-radius:10px;padding:8px 14px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;
  cursor:pointer;transition:all .2s}
.btn-ghost:hover{background:rgba(15,23,42,.04);color:#0F172A;border-color:rgba(15,23,42,.22)}
.wchip{background:#fff;border:1px solid rgba(15,23,42,.1);border-radius:8px;
  padding:5px 11px;font-size:11px;font-weight:500;color:rgba(15,23,42,.45);cursor:pointer;
  white-space:nowrap;transition:all .18s;font-family:'DM Sans',sans-serif}
.wchip:hover{border-color:rgba(37,99,235,.35);color:rgba(15,23,42,.75)}
.wchip.on{background:#EFF6FF;border-color:#2563EB;color:#2563EB;font-weight:700}
.opt{border:1px solid rgba(15,23,42,.1);background:transparent;border-radius:8px;
  padding:7px 13px;font-size:13px;color:rgba(15,23,42,.5);cursor:pointer;transition:all .18s;
  font-family:'DM Sans',sans-serif;white-space:nowrap}
.opt:hover{border-color:rgba(37,99,235,.3);color:#0F172A}
.opt.sel{border-color:#2563EB;background:#EFF6FF;color:#2563EB;font-weight:600}
.divider{height:1px;background:rgba(15,23,42,.06);margin:0 16px}
`;

// ── Plan builder ──────────────────────────────────────────────────────────────
const WEEK_THEMES = [
  "Foundation","Foundation","Building","Cutback & Recover","Building",
  "First Tempo","Long Run Begins","Cutback & Recover","Endurance",
  "Speed & Intervals","Peak Building","Peak Week","Taper Begins","Taper","Race Week",
];
const TUE_RUNS = [
  {km:5,type:"Easy Run"},{km:5,type:"Easy Run"},{km:6,type:"Easy Run"},{km:5,type:"Easy Run"},
  {km:7,type:"Easy Run"},{km:8,type:"Tempo Run"},{km:6,type:"Easy Run"},{km:5,type:"Easy Run"},
  {km:8,type:"Tempo Run"},{km:8,type:"Intervals"},{km:10,type:"Tempo Run"},{km:8,type:"Easy Run"},
  {km:6,type:"Easy Run"},{km:5,type:"Easy Run"},{km:3,type:"Easy Run"},
];
const WED_LONG = {7:12,8:9,9:14,10:16,11:18,12:19,13:14,14:8,15:3};
const SAT_KM   = [5,5,5,5,5,5,5,5,5,5,5,5,4,3,0];
const PLAN_START_MS = Date.UTC(2026,4,25);
const DAY_MS = 86400000;
const DOW = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MON_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const PACE_MID_MIN = {"Easy Run":7.33,"Long Run":7.17,"Tempo Run":6.17,"Intervals":6.5,"Race":6.5};
const INTENSITY = {"Easy Run":"low","Long Run":"low","Tempo Run":"medium","Intervals":"high","Race":"race"};

const isoDate    = ms => new Date(ms).toISOString().split("T")[0];
const prettyDate = ms => { const d = new Date(ms); return `${d.getUTCDate()} ${MON_ABBR[d.getUTCMonth()]}`; };
const shortDateStr = dateStr => { const d = new Date(dateStr); return `${d.getUTCDate()} ${MON_ABBR[d.getUTCMonth()]}`; };
const estDuration = (type,km) => `${Math.round(km*(PACE_MID_MIN[type]||7))} min`;

function periodNote(dateStr, periods) {
  const info = getPeriodInfo(dateStr, periods);
  if (!info.onPeriod) return "";
  return info.heavy
    ? ` 🌸 Period day ${info.day} — ease intensity ~15% today.`
    : ` 🌸 Period day ${info.day} — energy returning, trust the training.`;
}

function runDesc(type,role,km) {
  if (type==="Tempo Run") return `Tempo session — comfortably hard, a few words not full sentences. Warm up 1km easy, hold the effort, ease down. Target: ${PACE_GUIDE["Tempo Run"].range}.`;
  if (type==="Intervals") return `Interval session — quality over quantity. Full recovery between reps. Target: ${PACE_GUIDE["Intervals"].range}.`;
  if (role==="long")      return `Long run — time on feet matters more than pace. Flexible: shift to Thursday if needed. Target: ${PACE_GUIDE["Long Run"].range}.`;
  if (role==="tuesday")   return `Your key mid-week run — easy conversational effort. Target: ${PACE_GUIDE["Easy Run"].range}.`;
  return `Your Saturday ${km}km — your consistency anchor. Easy, enjoyable effort. Target: ${PACE_GUIDE["Easy Run"].range}.`;
}

function buildPlan(periods) {
  const p = periods || DEFAULT_PERIODS;
  const weeks = [];
  for (let w = 0; w < N_WEEKS; w++) {
    const weekNumber = w+1;
    const monMs = PLAN_START_MS + w*7*DAY_MS;
    const has3Runs = weekNumber >= 7;
    const sessions = [];

    const mkRun = (dayIdx,type,km,role) => {
      const dateStr = isoDate(PLAN_START_MS+(w*7+dayIdx)*DAY_MS);
      return { dayOfWeek:DOW[dayIdx], date:dateStr, type, distance:`${km}km`,
        duration:estDuration(type,km), pace:PACE_GUIDE[type]?.range||"—",
        description:runDesc(type,role,km)+periodNote(dateStr,p), intensity:INTENSITY[type] };
    };
    const mkStatic = (dayIdx,type,duration,intensity,desc) => {
      const dateStr = isoDate(PLAN_START_MS+(w*7+dayIdx)*DAY_MS);
      return { dayOfWeek:DOW[dayIdx], date:dateStr, type, distance:"—",
        duration, pace:"—", description:desc+periodNote(dateStr,p), intensity };
    };

    sessions.push(mkStatic(0,"Legs (Gym)","60 min","gym","Heavy compound leg day. Squats, deadlifts, leg press, lunges."));
    sessions.push(mkRun(1,TUE_RUNS[w].type,TUE_RUNS[w].km,"tuesday"));

    if (has3Runs) {
      const longType = weekNumber===15?"Easy Run":"Long Run";
      sessions.push(mkRun(2,longType,WED_LONG[weekNumber],"long"));
    } else {
      sessions.push(mkStatic(2,"Upper Body (Gym)","45 min","gym","Bench press, rows, overhead press, pull-ups. 10 min core."));
    }

    sessions.push(mkStatic(3,"Rest","—","rest",has3Runs
      ?"Rest day. Or run your long run here instead of Wednesday if the week needs the flexibility."
      :"Full rest. Recovery is where the adaptation happens."));
    sessions.push(mkStatic(4,"Legs (Gym)","40 min","gym","Lighter leg session. Lunges, step-ups, Bulgarian split squats, calf raises."));

    const satKm = SAT_KM[w];
    if (satKm > 0) sessions.push(mkRun(5,"Easy Run",satKm,"saturday"));
    else sessions.push(mkStatic(5,"Rest","—","rest","Rest — keep legs fresh. Race tomorrow."));

    if (weekNumber===15) {
      const dateStr = isoDate(monMs+6*DAY_MS);
      sessions.push({dayOfWeek:"Sunday",date:dateStr,type:"Race",distance:"21.1km",duration:"~2:17",
        pace:PACE_GUIDE["Race"].range,description:`🏆 THE BIG HALF. First 5km should feel almost too easy. Trust your training.`,intensity:"race"});
    } else {
      sessions.push(mkStatic(6,"Rest","—","rest","Rest and recover. Prepare mentally for the week ahead."));
    }

    const totalKm = sessions.filter(s=>["low","medium","high"].includes(s.intensity))
      .reduce((sum,s)=>sum+(parseFloat(s.distance)||0),0);
    weeks.push({ weekNumber, dateRange:`${prettyDate(monMs)} – ${prettyDate(monMs+6*DAY_MS)}`,
      theme:WEEK_THEMES[w], totalKm, sessions });
  }
  return { weeks };
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,      setScreen]      = useState("loading");
  const [plan,        setPlan]        = useState(null);
  const [sw,          setSw]          = useState(1);
  const [completed,   setCompleted]   = useState({});
  const [quizzes,     setQuizzes]     = useState({});
  const [quizSess,    setQuizSess]    = useState(null);
  const [strava,      setStrava]      = useState(null);
  const [stravaSync,  setStravaSync]  = useState("idle");
  const [syncMsg,     setSyncMsg]     = useState("");
  const [showSettings,setShowSettings]= useState(false);
  const [periods,     setPeriods]     = useState(DEFAULT_PERIODS);

  const dtr = Math.ceil((RACE_DATE - new Date()) / 86400000);
  const cw  = Math.max(1, Math.min(N_WEEKS, Math.floor((new Date() - START_DATE) / 86400000 / 7) + 1));

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stravaToken   = params.get("strava_token");
    const stravaAthlete = params.get("strava_athlete");
    const stravaError   = params.get("strava_error");

    if (stravaToken) {
      const sd = { token:stravaToken, refresh:params.get("strava_refresh"),
        expires:params.get("strava_expires"), athlete:stravaAthlete||"Athlete" };
      localStorage.setItem("strava", JSON.stringify(sd));
      setStrava(sd);
      window.history.replaceState({}, "", "/");
    } else if (stravaError) {
      window.history.replaceState({}, "", "/");
    } else {
      const stored = localStorage.getItem("strava");
      if (stored) { try { setStrava(JSON.parse(stored)); } catch (_) {} }
    }

    const savedPeriods = loadPeriods();
    setPeriods(savedPeriods);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const s = JSON.parse(stored);
        setPlan(s.plan); setCompleted(s.completed||{}); setQuizzes(s.quizzes||{});
        setSw(cw); setScreen("dashboard");
      } else { setScreen("generating"); genPlan(savedPeriods); }
    } catch { setScreen("generating"); genPlan(savedPeriods); }
  }, []);

  // Auto-sync Strava once on load
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (plan && strava && !autoSyncedRef.current) {
      autoSyncedRef.current = true;
      syncStrava();
    }
  }, [plan, strava]);

  function saveLocal(newPlan, newCompleted, newQuizzes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      plan: newPlan||plan, completed: newCompleted||completed, quizzes: newQuizzes||quizzes,
    }));
  }

  function toggleComplete(s) {
    const isRun = ["low","medium","high","race"].includes(s.intensity);
    const key   = s.date;
    if (completed[key]) {
      const nc = {...completed}; delete nc[key];
      setCompleted(nc); saveLocal(null,nc,null);
    } else if (isRun) { setQuizSess(s); }
    else { const nc={...completed,[key]:true}; setCompleted(nc); saveLocal(null,nc,null); }
  }

  function submitQuiz(data) {
    const key = quizSess.date;
    const nc  = {...completed,[key]:true};
    const nq  = {...quizzes,[key]:data};
    setCompleted(nc); setQuizzes(nq); saveLocal(null,nc,nq); setQuizSess(null);
  }

  function genPlan(p) {
    const perds = p || periods;
    try {
      const newPlan = buildPlan(perds);
      setPlan(newPlan); setSw(cw);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({plan:newPlan,completed:{},quizzes:{}}));
      setScreen("dashboard");
    } catch(e) { console.error(e); setScreen("generating"); }
  }

  function savePeriods(newPeriods) {
    localStorage.setItem(PERIODS_KEY, JSON.stringify(newPeriods.map(p=>({
      ...p, start:p.start.toISOString(), end:p.end.toISOString()
    }))));
    setPeriods(newPeriods);
    const newPlan = buildPlan(newPeriods);
    setPlan(newPlan);
    saveLocal(newPlan, null, null);
  }

  // ── Strava sync (±2 day matching) ────────────────────────────────────────
  async function syncStrava() {
    if (!strava?.token) return;
    setStravaSync("syncing"); setSyncMsg("");

    let activeToken = strava.token;
    const nowSec = Math.floor(Date.now()/1000);
    if (strava.expires && parseInt(strava.expires) < nowSec+300) {
      try {
        const r = await fetch(`/api/strava-refresh?refresh_token=${encodeURIComponent(strava.refresh)}`);
        if (r.ok) {
          const d = await r.json();
          const updated = {...strava,token:d.access_token,expires:d.expires_at,refresh:d.refresh_token};
          localStorage.setItem("strava",JSON.stringify(updated)); setStrava(updated);
          activeToken = d.access_token;
        } else { localStorage.removeItem("strava"); setStrava(null); setStravaSync("error"); return; }
      } catch(e) { console.error("Token refresh failed:",e); setStravaSync("error"); return; }
    }

    try {
      const after  = Math.floor(START_DATE.getTime()/1000);
      const before = Math.floor(Date.now()/1000);
      const res    = await fetch(`/api/strava-activities?token=${activeToken}&after=${after}&before=${before}`);

      if (res.status===401) { localStorage.removeItem("strava"); setStrava(null); setStravaSync("error"); return; }

      const activities = await res.json();

      const runsByDate = {};
      for (const act of activities) {
        if (act.type==="Run"||act.sport_type==="Run") {
          const date = new Date(act.start_date_local).toISOString().split("T")[0];
          runsByDate[date] = {
            pace: formatPace(act.moving_time, act.distance),
            dist: `${(act.distance/1000).toFixed(2)}km`,
            name: act.name, id: act.id,
          };
        }
      }

      const nc={...completed}, nq={...quizzes};
      let matched=0;

      plan.weeks.forEach(week => {
        week.sessions.forEach(session => {
          const isRun = ["low","medium","high","race"].includes(session.intensity);
          if (!isRun || nc[session.date]) return;

          const sessionDate = new Date(session.date);
          let matchedAct = null;
          for (let offset=-2; offset<=2; offset++) {
            const check = new Date(sessionDate);
            check.setDate(check.getDate()+offset);
            const ds = check.toISOString().split("T")[0];
            if (runsByDate[ds]) { matchedAct = runsByDate[ds]; break; }
          }

          if (matchedAct) {
            nc[session.date] = true;
            nq[session.date] = {
              feel:null, pace:matchedAct.pace, mood:"", dist:matchedAct.dist,
              notes:`⚡ Synced from Strava: "${matchedAct.name}" (${matchedAct.dist})`,
              fromStrava:true,
            };
            matched++;
          }
        });
      });

      setCompleted(nc); setQuizzes(nq); saveLocal(null,nc,nq);
      if (matched>0) { setStravaSync("done"); setSyncMsg(`${matched} run${matched>1?"s":""} synced`); }
      else { setStravaSync("idle"); setSyncMsg("No new runs found"); }
    } catch(e) { console.error("Strava sync error:",e); setStravaSync("error"); }
  }

  function connectStrava() {
    const clientId    = import.meta.env.VITE_STRAVA_CLIENT_ID;
    const redirectUri = `${window.location.origin}/api/strava-auth`;
    window.location.href =
      `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=activity:read_all`;
  }

  function disconnectStrava() { localStorage.removeItem("strava"); setStrava(null); setStravaSync("idle"); setSyncMsg(""); }

  function exportICS() {
    const sessions = plan.weeks.flatMap(w=>w.sessions).filter(s=>s.intensity!=="rest");
    const icsDate = d => d.replace(/-/g,"");
    const nextDay = d => { const x=new Date(d); x.setDate(x.getDate()+1); return x.toISOString().split("T")[0].replace(/-/g,""); };
    let ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//The Big Half Training//EN",
      "CALSCALE:GREGORIAN","X-WR-CALNAME:The Big Half Training"].join("\r\n");
    sessions.forEach(s => {
      ics += "\r\nBEGIN:VEVENT\r\n" +
        `DTSTART;VALUE=DATE:${icsDate(s.date)}\r\nDTEND;VALUE=DATE:${nextDay(s.date)}\r\n` +
        `SUMMARY:${s.type}${s.distance!=="—"?" – "+s.distance:""}\r\n` +
        `DESCRIPTION:${s.description.replace(/[,;\\]/g,"").replace(/\n/g,"\\n")}\r\n` +
        "END:VEVENT";
    });
    ics += "\r\nEND:VCALENDAR";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));
    a.download = "big-half-training.ics"; document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }

  function resetPlan() {
    localStorage.removeItem(STORAGE_KEY);
    setPlan(null); setCompleted({}); setQuizzes({});
    setStravaSync("idle"); setSyncMsg(""); genPlan();
  }

  if (screen==="loading"||screen==="generating") return <Generating onRetry={genPlan} />;

  const periodWeeks = getPeriodWeeks(periods);

  return (
    <>
      <Dashboard
        plan={plan} sw={sw} setSw={setSw} cw={cw} dtr={dtr}
        completed={completed} quizzes={quizzes} onToggle={toggleComplete}
        strava={strava} stravaSync={stravaSync} syncMsg={syncMsg}
        periodWeeks={periodWeeks} periods={periods}
        onConnectStrava={connectStrava} onSyncStrava={syncStrava}
        onDisconnectStrava={disconnectStrava} onExportICS={exportICS}
        onReset={resetPlan} onOpenSettings={()=>setShowSettings(true)}
      />
      {quizSess && <QuizModal session={quizSess} onSubmit={submitQuiz} onClose={()=>setQuizSess(null)} />}
      {showSettings && <SettingsModal periods={periods} onSave={savePeriods} onClose={()=>setShowSettings(false)} />}
    </>
  );
}

// ── Generating ────────────────────────────────────────────────────────────────
function Generating({ onRetry }) {
  return (
    <div style={{minHeight:"100vh",background:"#F8FAFC",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:24}}>
      <div className="dn" style={{fontSize:44,color:"#2563EB",textAlign:"center",lineHeight:1.1}}>BUILDING YOUR<br/>TRAINING PLAN</div>
      <div style={{width:200,height:2,background:"rgba(15,23,42,.08)",borderRadius:2,overflow:"hidden",position:"relative"}}>
        <div style={{position:"absolute",height:"100%",width:"50%",background:"#2563EB",borderRadius:2,animation:"bar 1.9s ease-in-out infinite"}} />
      </div>
      <div style={{fontSize:12,color:"rgba(15,23,42,.35)",animation:"pulse 1.6s ease infinite"}}>Mapping your 15-week schedule…</div>
      {onRetry && <button className="btn" onClick={onRetry} style={{marginTop:8}}>Retry →</button>}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ plan, sw, setSw, cw, dtr, completed, quizzes, onToggle, strava, stravaSync, syncMsg,
  periodWeeks, periods, onConnectStrava, onSyncStrava, onDisconnectStrava, onExportICS, onReset, onOpenSettings }) {
  const chipRef = useRef(null);
  const wd = plan?.weeks?.find(w => w.weekNumber===sw);

  const allRuns  = plan?.weeks.flatMap(w=>w.sessions).filter(s=>["low","medium","high","race"].includes(s.intensity))??[];
  const doneRuns = allRuns.filter(s=>completed[s.date]);
  const pct      = allRuns.length>0 ? Math.round((doneRuns.length/allRuns.length)*100) : 0;

  const wkRuns  = wd?.sessions.filter(s=>["low","medium","high","race"].includes(s.intensity))??[];
  const wkGym   = wd?.sessions.filter(s=>s.intensity==="gym")??[];
  const wkRunDone = wkRuns.filter(s=>completed[s.date]).length;
  const wkGymDone = wkGym.filter(s=>completed[s.date]).length;

  const wkActualKm = wkRuns.filter(s=>completed[s.date]).reduce((sum,s)=>{
    const dist = quizzes[s.date]?.dist;
    if (dist) return sum+(parseFloat(dist)||0);
    return sum+(parseFloat(s.distance)||0);
  },0);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaySession = plan?.weeks.flatMap(w=>w.sessions).find(s=>s.date===todayStr);

  const paceData = allRuns
    .filter(s=>completed[s.date]&&quizzes[s.date]?.pace)
    .map(s=>({ date:s.date, pace:parsePaceToMin(quizzes[s.date].pace), label:s.type }))
    .filter(p=>p.pace!==null)
    .sort((a,b)=>a.date.localeCompare(b.date))
    .slice(-10);

  useEffect(() => {
    chipRef.current?.querySelector(".wchip.on")?.scrollIntoView({block:"nearest",inline:"center",behavior:"smooth"});
  }, [sw]);

  return (
    <div style={{background:"#F8FAFC",minHeight:"100vh",maxWidth:700,margin:"0 auto",paddingBottom:160}}>

      {/* ── Sticky header ── */}
      <div style={{position:"sticky",top:0,background:"#fff",zIndex:10,padding:"16px 16px 0",
        borderBottom:"1px solid rgba(15,23,42,.07)",boxShadow:"0 1px 12px rgba(15,23,42,.05)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div>
            <div className="dn" style={{fontSize:28,color:"#2563EB",lineHeight:1,letterSpacing:".08em"}}>THE BIG HALF</div>
            <div style={{fontSize:10,color:"rgba(15,23,42,.35)",marginTop:2,letterSpacing:".12em",textTransform:"uppercase"}}>London · 6 Sep 2026</div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{textAlign:"center",background:"#EFF6FF",border:"1px solid rgba(37,99,235,.2)",borderRadius:10,padding:"5px 13px"}}>
              <div className="dn" style={{fontSize:24,color:"#2563EB",lineHeight:1}}>{dtr}</div>
              <div style={{fontSize:8,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".1em"}}>days</div>
            </div>
            <button className="btn-ghost" style={{padding:"7px 9px",fontSize:13}} onClick={onOpenSettings} title="Settings">⚙</button>
          </div>
        </div>

        {/* Overall progress bar */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
            <span style={{fontSize:10,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".08em"}}>Run sessions</span>
            <span style={{fontSize:10,color:"rgba(15,23,42,.5)"}}>{doneRuns.length}/{allRuns.length} · {pct}%</span>
          </div>
          <div style={{height:3,background:"rgba(15,23,42,.07)",borderRadius:2}}>
            <div style={{height:"100%",width:`${pct}%`,background:"#2563EB",borderRadius:2,transition:"width .5s"}} />
          </div>
        </div>

        {/* Legend */}
        <div style={{display:"flex",gap:14,marginBottom:10}}>
          {[["#16A34A","Running"],["#7C3AED","Gym"],["#EC4899","Period"]].map(([c,l])=>(
            <div key={l} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:c}} />
              <span style={{fontSize:10,color:"rgba(15,23,42,.35)"}}>{l}</span>
            </div>
          ))}
        </div>

        {/* Week chips */}
        <div ref={chipRef} style={{display:"flex",gap:4,overflowX:"auto",paddingBottom:12,scrollbarWidth:"none"}}>
          {plan.weeks.map(w=>(
            <button key={w.weekNumber} className={`wchip ${sw===w.weekNumber?"on":""}`}
              onClick={()=>setSw(w.weekNumber)}
              style={{position:"relative",borderColor:sw===w.weekNumber?undefined:periodWeeks.has(w.weekNumber)?"rgba(236,72,153,.25)":undefined}}>
              W{w.weekNumber}
              {w.weekNumber===cw && <span style={{color:"#D97706",fontSize:7,marginLeft:2}}>●</span>}
              {periodWeeks.has(w.weekNumber)&&w.weekNumber!==cw && <span style={{color:"#EC4899",fontSize:7,marginLeft:2}}>●</span>}
              {w.weekNumber===7 && <span style={{position:"absolute",top:-7,right:-3,fontSize:7,color:"#7C3AED",fontWeight:700,background:"#fff",padding:"0 1px"}}>+3</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Today hero ── */}
      {todaySession && !completed[todayStr] && sw===cw && (
        <TodayCard session={todaySession} onToggle={()=>onToggle(todaySession)} />
      )}

      {wd && (
        <div style={{padding:"16px 16px 0"}}>

          {/* Week header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div>
              <div style={{fontSize:17,fontWeight:700,letterSpacing:"-.01em",color:"#0F172A"}}>
                Week {wd.weekNumber} <span style={{color:"rgba(15,23,42,.25)",fontWeight:400}}>—</span> <span style={{color:"#2563EB"}}>{wd.theme}</span>
              </div>
              <div style={{fontSize:11,color:"rgba(15,23,42,.35)",marginTop:2}}>{wd.dateRange}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="dn" style={{fontSize:30,color:"#0F172A",lineHeight:1}}>{wd.totalKm}km</div>
              <div style={{fontSize:9,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".08em"}}>planned</div>
            </div>
          </div>

          {/* Weekly stats row */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {[
              {l:"Runs",v:`${wkRunDone}/${wkRuns.length}`},
              {l:"Gym",v:`${wkGymDone}/${wkGym.length}`},
              {l:"Actual km",v:wkActualKm>0?`${wkActualKm.toFixed(1)}km`:"—"},
              {l:"Week",v:`${cw}/15`},
            ].map(({l,v})=>(
              <div key={l} style={{background:"#fff",border:"1px solid rgba(15,23,42,.08)",borderRadius:10,padding:"10px 11px",
                boxShadow:"0 1px 4px rgba(15,23,42,.04)"}}>
                <div style={{fontSize:9,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:3}}>{l}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>{v}</div>
              </div>
            ))}
          </div>

          {/* Weekly km progress bar */}
          {wkActualKm > 0 && (
            <div style={{marginBottom:14,padding:"12px 14px",background:"#fff",border:"1px solid rgba(15,23,42,.08)",
              borderRadius:10,boxShadow:"0 1px 4px rgba(15,23,42,.04)"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                <span style={{fontSize:10,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".07em"}}>Weekly km</span>
                <span style={{fontSize:11,fontWeight:600,color:"#16A34A"}}>{wkActualKm.toFixed(1)} / {wd.totalKm}km</span>
              </div>
              <div style={{height:4,background:"rgba(15,23,42,.06)",borderRadius:2}}>
                <div style={{height:"100%",width:`${Math.min(100,(wkActualKm/wd.totalKm)*100)}%`,
                  background:"linear-gradient(90deg,#16A34A,#22D3EE)",borderRadius:2,transition:"width .5s"}} />
              </div>
            </div>
          )}

          {/* Pace chart */}
          {paceData.length >= 2 && <PaceChart data={paceData} />}

          {/* Banners */}
          {sw===7 && (
            <div style={{marginBottom:12,padding:"11px 14px",background:"rgba(124,58,237,.05)",border:"1px solid rgba(124,58,237,.15)",borderRadius:10,display:"flex",gap:10}}>
              <span style={{fontSize:16}}>🎯</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#7C3AED",marginBottom:2}}>3 run days start here</div>
                <div style={{fontSize:11,color:"rgba(15,23,42,.45)",lineHeight:1.5}}>Wednesday is now your long run. Shift to Thursday anytime based on how you feel.</div>
              </div>
            </div>
          )}
          {periodWeeks.has(sw) && (
            <div style={{marginBottom:12,padding:"11px 14px",background:"rgba(236,72,153,.04)",border:"1px solid rgba(236,72,153,.14)",borderRadius:10,display:"flex",gap:10}}>
              <span style={{fontSize:16}}>🌸</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:"#EC4899",marginBottom:2}}>Period week</div>
                <div style={{fontSize:11,color:"rgba(15,23,42,.45)",lineHeight:1.5}}>Days 1–2: ease off 10–15%, prioritise iron and hydration. Strength returns from day 3.</div>
              </div>
            </div>
          )}

          {/* Milestone */}
          {MILESTONES[sw] && (
            <div style={{marginBottom:12,padding:"12px 14px",background:MILESTONES[sw].bg,border:`1px solid ${MILESTONES[sw].border}`,borderRadius:10,display:"flex",gap:11,alignItems:"flex-start"}}>
              <span style={{fontSize:20,flexShrink:0}}>{MILESTONES[sw].emoji}</span>
              <div>
                <div style={{fontSize:12,fontWeight:700,color:MILESTONES[sw].color,marginBottom:3}}>{MILESTONES[sw].title}</div>
                <div style={{fontSize:11,color:"rgba(15,23,42,.45)",lineHeight:1.55}}>{MILESTONES[sw].body}</div>
              </div>
            </div>
          )}

          {/* Pace reference */}
          <div style={{marginBottom:14,padding:"11px 14px",background:"#EFF6FF",border:"1px solid rgba(37,99,235,.15)",borderRadius:10}}>
            <div style={{fontSize:9,color:"rgba(37,99,235,.6)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:7}}>Pace targets · 2:13–2:21 goal</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"5px 20px"}}>
              {Object.entries(PACE_GUIDE)
                .filter(([k])=>wd.sessions.some(s=>s.type===k))
                .map(([k,v])=>(
                  <div key={k} style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:10,color:"rgba(15,23,42,.4)"}}>{k.replace(" Run","")}</span>
                    <span style={{fontSize:13,fontWeight:700,color:"#2563EB"}}>{v.range}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Sessions */}
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {wd.sessions.map((s,i)=>(
              <SCard key={i} s={s} periods={periods}
                past={new Date(s.date)<new Date()}
                completed={!!completed[s.date]}
                quiz={quizzes[s.date]}
                onToggle={()=>onToggle(s)} />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:700,
        padding:"10px 16px 22px",background:"linear-gradient(to top,#F8FAFC 65%,transparent)"}}>
        <div style={{marginBottom:8}}>
          {!strava ? (
            <button onClick={onConnectStrava}
              style={{width:"100%",padding:"12px 0",background:"rgba(252,76,2,.06)",
                border:"1px solid rgba(252,76,2,.22)",borderRadius:12,color:"#FC4C02",
                fontFamily:"DM Sans,sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FC4C02"><path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/></svg>
              Connect Strava — auto-complete your runs
            </button>
          ) : (
            <div style={{display:"flex",gap:8}}>
              <button onClick={onSyncStrava} disabled={stravaSync==="syncing"}
                style={{flex:1,padding:"11px 0",background:stravaSync==="done"?"rgba(22,163,74,.07)":"rgba(252,76,2,.06)",
                  border:`1px solid ${stravaSync==="done"?"rgba(22,163,74,.2)":"rgba(252,76,2,.22)"}`,borderRadius:12,
                  color:stravaSync==="done"?"#16A34A":"#FC4C02",fontFamily:"DM Sans,sans-serif",fontWeight:600,fontSize:13,cursor:"pointer",transition:"all .2s"}}>
                {stravaSync==="idle" && `⚡ Sync Strava · ${strava.athlete}${syncMsg?" · "+syncMsg:""}`}
                {stravaSync==="syncing" && "⏳ Syncing…"}
                {stravaSync==="done" && `✅ ${syncMsg||"Synced"}`}
                {stravaSync==="error" && "⚠️ Retry sync"}
              </button>
              <button className="btn-ghost" style={{padding:"11px 13px",fontSize:12}} onClick={onDisconnectStrava}>Disconnect</button>
            </div>
          )}
        </div>
        <button className="btn" style={{width:"100%",justifyContent:"center",padding:13,fontSize:13}} onClick={onExportICS}>
          📅 Download calendar (.ics)
        </button>
      </div>
    </div>
  );
}

// ── Today hero card ───────────────────────────────────────────────────────────
function TodayCard({ session, onToggle }) {
  const cfg  = INT[session.intensity]||INT.rest;
  const isRun = ["low","medium","high","race"].includes(session.intensity);
  const pg   = PACE_GUIDE[session.type];
  return (
    <div style={{margin:"14px 16px 0",padding:"18px 18px 16px",
      background:"linear-gradient(135deg,#EFF6FF 0%,#DBEAFE 100%)",
      border:"1px solid rgba(37,99,235,.2)",borderRadius:14,animation:"fadeIn .3s ease",
      boxShadow:"0 2px 12px rgba(37,99,235,.1)"}}>
      <div style={{fontSize:9,fontWeight:700,color:"#2563EB",textTransform:"uppercase",letterSpacing:".12em",marginBottom:8}}>Today · {shortDateStr(session.date)}</div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div>
          <div style={{fontSize:22,fontWeight:700,letterSpacing:"-.02em",marginBottom:3,color:"#0F172A"}}>{session.type}</div>
          <div style={{fontSize:11,color:"rgba(15,23,42,.45)"}}>{session.dayOfWeek}</div>
        </div>
        <div style={{textAlign:"right"}}>
          {session.distance!=="—" && <div className="dn" style={{fontSize:32,color:"#2563EB",lineHeight:1}}>{session.distance}</div>}
          <div style={{fontSize:9,fontWeight:700,color:cfg.c,background:cfg.bg,border:`1px solid ${cfg.b}`,
            padding:"2px 7px",borderRadius:4,textTransform:"uppercase",letterSpacing:".07em",display:"inline-block",marginTop:3}}>{cfg.l}</div>
        </div>
      </div>
      {pg && <div style={{fontSize:11,color:"rgba(15,23,42,.45)",marginBottom:12}}>Target pace: <span style={{color:"#2563EB",fontWeight:600}}>{pg.range}</span></div>}
      {isRun && (
        <button className="btn" style={{width:"100%",justifyContent:"center",padding:12,fontSize:13}} onClick={onToggle}>
          ✓ Mark run complete
        </button>
      )}
      {!isRun && session.intensity!=="rest" && (
        <button className="btn" style={{width:"100%",justifyContent:"center",padding:12,fontSize:13}} onClick={onToggle}>
          ✓ Mark complete
        </button>
      )}
    </div>
  );
}

// ── Pace chart ────────────────────────────────────────────────────────────────
function PaceChart({ data }) {
  const W=340, H=80, PAD={t:8,r:12,b:20,l:36};
  const paces = data.map(d=>d.pace);
  const minP  = Math.min(...paces)-0.2;
  const maxP  = Math.max(...paces)+0.2;
  const xStep = (W-PAD.l-PAD.r)/(data.length-1);
  const yScale = v => PAD.t + ((maxP-v)/(maxP-minP))*(H-PAD.t-PAD.b);
  const pts = data.map((d,i)=>({x:PAD.l+i*xStep, y:yScale(d.pace)}));
  const polyline = pts.map(p=>`${p.x},${p.y}`).join(" ");

  const fmtPace = v => { const m=Math.floor(v); return `${m}:${Math.round((v-m)*60).toString().padStart(2,"0")}`; };
  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const shortDate = s => { const d=new Date(s); return `${d.getDate()} ${MON[d.getMonth()]}`; };

  return (
    <div style={{marginBottom:14,padding:"14px 14px 10px",background:"#fff",border:"1px solid rgba(15,23,42,.08)",
      borderRadius:10,boxShadow:"0 1px 4px rgba(15,23,42,.04)"}}>
      <div style={{fontSize:9,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Pace trend · last {data.length} runs</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto",display:"block"}}>
        {[minP+(maxP-minP)*0.25, minP+(maxP-minP)*0.5, minP+(maxP-minP)*0.75].map((v,i)=>(
          <line key={i} x1={PAD.l} x2={W-PAD.r} y1={yScale(v)} y2={yScale(v)} stroke="rgba(15,23,42,.06)" strokeWidth="1" />
        ))}
        {[minP, minP+(maxP-minP)*0.5, maxP].map((v,i)=>(
          <text key={i} x={PAD.l-4} y={yScale(v)+3} textAnchor="end" fontSize="7" fill="rgba(15,23,42,.35)">{fmtPace(v)}</text>
        ))}
        <polygon points={`${pts[0].x},${H-PAD.b} ${polyline} ${pts[pts.length-1].x},${H-PAD.b}`}
          fill="url(#paceGrad)" opacity="0.3" />
        <defs>
          <linearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={polyline} fill="none" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p,i)=>(
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#2563EB" stroke="#fff" strokeWidth="1.5" />
        ))}
        <text x={pts[0].x} y={H} textAnchor="middle" fontSize="7" fill="rgba(15,23,42,.35)">{shortDate(data[0].date)}</text>
        <text x={pts[pts.length-1].x} y={H} textAnchor="middle" fontSize="7" fill="rgba(15,23,42,.35)">{shortDate(data[data.length-1].date)}</text>
      </svg>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────
function SCard({ s, past, completed, quiz, periods, onToggle }) {
  const [open, setOpen] = useState(false);
  const cfg    = INT[s.intensity]||INT.rest;
  const isRest = s.intensity==="rest";
  const isRun  = ["low","medium","high","race"].includes(s.intensity);
  const isGym  = s.intensity==="gym";
  const pg     = PACE_GUIDE[s.type];
  const pi     = getPeriodInfo(s.date, periods);
  const isToday = s.date===new Date().toISOString().split("T")[0];

  // Show actual Strava/manual distance if available, fall back to planned
  const displayDist = quiz?.dist || s.distance;
  const hasActualDist = !!quiz?.dist && quiz.dist !== s.distance;

  return (
    <div style={{
      borderRadius:12,padding:"12px 14px",
      opacity:(past&&!completed)?0.5:1,
      background:completed?"rgba(22,163,74,.04)":isToday?"#EFF6FF":"#fff",
      border:`1px solid ${completed?"rgba(22,163,74,.15)":isToday?"rgba(37,99,235,.2)":pi.onPeriod&&pi.heavy?"rgba(236,72,153,.15)":"rgba(15,23,42,.08)"}`,
      boxShadow:isToday?"0 2px 8px rgba(37,99,235,.08)":completed?"none":"0 1px 3px rgba(15,23,42,.04)",
      transition:"all .18s",
    }}>
      {isToday&&!completed && <div style={{fontSize:9,color:"#2563EB",fontWeight:700,textTransform:"uppercase",letterSpacing:".1em",marginBottom:5}}>TODAY</div>}
      {pi.onPeriod && <div style={{fontSize:9,color:"#EC4899",marginBottom:4}}>🌸 Period day {pi.day}{pi.heavy?" — ease off today":""}</div>}
      {quiz?.fromStrava && <div style={{fontSize:9,color:"rgba(252,76,2,.7)",marginBottom:4}}>⚡ Synced from Strava</div>}

      <div style={{display:"flex",alignItems:"center",gap:10}}>
        {!isRest && (
          <button onClick={e=>{e.stopPropagation();onToggle();}}
            style={{width:22,height:22,borderRadius:6,flexShrink:0,cursor:"pointer",
              border:`1.5px solid ${completed?"#16A34A":"rgba(15,23,42,.18)"}`,
              background:completed?"rgba(22,163,74,.1)":"transparent",
              display:"flex",alignItems:"center",justifyContent:"center",transition:"all .18s"}}>
            {completed&&<span style={{fontSize:11,color:"#16A34A"}}>✓</span>}
          </button>
        )}
        <div style={{fontSize:17,width:26,textAlign:"center",flexShrink:0}}>{ICON[s.type]||"📅"}</div>

        <div style={{flex:1,minWidth:0,cursor:isRest?"default":"pointer"}} onClick={()=>!isRest&&setOpen(o=>!o)}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:1}}>
            <span style={{fontSize:9,fontWeight:600,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".07em"}}>{s.dayOfWeek}</span>
            <span style={{fontSize:9,color:"rgba(15,23,42,.25)"}}>· {shortDateStr(s.date)}</span>
            {completed&&<span style={{fontSize:9,background:isGym?"rgba(124,58,237,.09)":"rgba(22,163,74,.08)",
              color:isGym?"#7C3AED":"#16A34A",padding:"1px 5px",borderRadius:3,fontWeight:700}}>DONE</span>}
            {s.type==="Long Run"&&<span style={{fontSize:9,color:"rgba(124,58,237,.6)",padding:"1px 5px",borderRadius:3,background:"rgba(124,58,237,.06)"}}>flex Wed/Thu</span>}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:isRest?"rgba(15,23,42,.3)":"#0F172A"}}>{s.type}</div>
        </div>

        {!isRest && (
          <div style={{textAlign:"right",flexShrink:0,cursor:"pointer"}} onClick={()=>!isRest&&setOpen(o=>!o)}>
            <div style={{fontSize:14,fontWeight:700,color:completed?(hasActualDist?"#2563EB":"#16A34A"):"#0F172A"}}>
              {displayDist}
              {hasActualDist && <span style={{fontSize:9,display:"block",color:"rgba(15,23,42,.3)",fontWeight:400}}>planned {s.distance}</span>}
            </div>
            <div style={{fontSize:10,color:"rgba(15,23,42,.35)"}}>{s.duration}</div>
            <div style={{fontSize:8,fontWeight:700,color:cfg.c,background:cfg.bg,border:`1px solid ${cfg.b}`,
              padding:"2px 6px",borderRadius:4,marginTop:3,letterSpacing:".07em",textTransform:"uppercase",display:"inline-block"}}>{cfg.l}</div>
          </div>
        )}
      </div>

      {open&&!isRest && (
        <div className="fi" style={{marginTop:10,paddingTop:10,borderTop:"1px solid rgba(15,23,42,.06)"}}>
          {pg && (
            <div style={{marginBottom:9,padding:"9px 11px",background:"#EFF6FF",border:"1px solid rgba(37,99,235,.15)",borderRadius:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <span style={{fontSize:9,color:"#2563EB",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em"}}>Target for 2:13–2:21</span>
                <span style={{fontSize:14,fontWeight:700,color:"#2563EB"}}>{pg.range}</span>
              </div>
              <div style={{fontSize:11,color:"rgba(15,23,42,.45)"}}>{pg.tip}</div>
            </div>
          )}
          {isRun && (
            <div style={{display:"flex",gap:16,marginBottom:8}}>
              <div><div style={{fontSize:9,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".07em"}}>Plan pace</div><div style={{fontSize:13,fontWeight:600,marginTop:1,color:"#0F172A"}}>{s.pace}</div></div>
              <div><div style={{fontSize:9,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".07em"}}>Duration</div><div style={{fontSize:13,fontWeight:600,marginTop:1,color:"#0F172A"}}>{s.duration}</div></div>
              {quiz?.pace&&<div><div style={{fontSize:9,color:"#16A34A",textTransform:"uppercase",letterSpacing:".07em"}}>Actual pace</div><div style={{fontSize:13,fontWeight:600,color:"#16A34A",marginTop:1}}>{quiz.pace}</div></div>}
              {quiz?.dist&&<div><div style={{fontSize:9,color:"#2563EB",textTransform:"uppercase",letterSpacing:".07em"}}>Distance</div><div style={{fontSize:13,fontWeight:600,color:"#2563EB",marginTop:1}}>{quiz.dist}</div></div>}
            </div>
          )}
          <div style={{fontSize:12,color:"rgba(15,23,42,.4)",lineHeight:1.6,background:"rgba(15,23,42,.03)",padding:"9px 11px",borderRadius:7,marginBottom:quiz?8:0}}>{s.description}</div>
          {quiz&&(
            <div style={{display:"flex",gap:10,padding:"8px 11px",background:"rgba(22,163,74,.04)",border:"1px solid rgba(22,163,74,.12)",borderRadius:7,marginTop:8,flexWrap:"wrap"}}>
              {quiz.feel&&<span style={{fontSize:18}}>{FEEL.find(f=>f.v===quiz.feel)?.e}</span>}
              <div style={{fontSize:11,color:"rgba(15,23,42,.45)"}}>
                {quiz.feel&&<span style={{color:"#16A34A",fontWeight:600}}>{FEEL.find(f=>f.v===quiz.feel)?.l}</span>}
                {quiz.mood&&<> · {quiz.mood}</>}
                {quiz.notes&&<div style={{marginTop:3,fontStyle:"italic",fontSize:10}}>"{quiz.notes}"</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Quiz modal ────────────────────────────────────────────────────────────────
function QuizModal({ session, onSubmit, onClose }) {
  const [feel,  setFeel]  = useState(null);
  const [pace,  setPace]  = useState("");
  const [mood,  setMood]  = useState("");
  const [notes, setNotes] = useState("");
  const [moved, setMoved] = useState(false);

  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(15,23,42,.5)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="su" style={{width:"100%",maxWidth:700,margin:"0 auto",background:"#fff",borderRadius:"18px 18px 0 0",
        padding:"20px 18px 32px",border:"1px solid rgba(15,23,42,.08)",boxShadow:"0 -4px 32px rgba(15,23,42,.1)"}}>
        <div style={{width:36,height:3,background:"rgba(15,23,42,.12)",borderRadius:2,margin:"0 auto 16px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>How was your run? 🏃</div>
            <div style={{fontSize:11,color:"rgba(15,23,42,.4)",marginTop:2}}>{session.type} · {session.distance} · {session.dayOfWeek}</div>
          </div>
          <button className="btn-ghost" style={{padding:"4px 8px",fontSize:12}} onClick={onClose}>✕</button>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:9}}>How did it feel?</div>
          <div style={{display:"flex",gap:7}}>
            {FEEL.map(f=>(
              <button key={f.v} onClick={()=>setFeel(f.v)}
                style={{flex:1,padding:"10px 4px",border:`1px solid ${feel===f.v?"#16A34A":"rgba(15,23,42,.1)"}`,
                  background:feel===f.v?"rgba(22,163,74,.06)":"transparent",borderRadius:9,cursor:"pointer",
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"all .15s"}}>
                <span style={{fontSize:20}}>{f.e}</span>
                <span style={{fontSize:9,color:feel===f.v?"#16A34A":"rgba(15,23,42,.35)",fontWeight:600,textTransform:"uppercase"}}>{f.l}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>
            Actual pace <span style={{color:"rgba(15,23,42,.25)",textTransform:"none",letterSpacing:0}}>(optional)</span>
          </div>
          <input value={pace} onChange={e=>setPace(e.target.value)} placeholder={`Plan: ${session.pace}`}
            style={{width:"100%",background:"rgba(15,23,42,.03)",border:"1px solid rgba(15,23,42,.1)",borderRadius:8,
              padding:"10px 12px",fontSize:14,color:"#0F172A",fontFamily:"DM Sans,sans-serif",outline:"none"}} />
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>Energy going in</div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
            {MOOD_OPTS.map(m=>(
              <button key={m} className={`opt ${mood===m?"sel":""}`} onClick={()=>setMood(m)}>{m}</button>
            ))}
          </div>
        </div>

        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,fontWeight:600,color:"rgba(15,23,42,.4)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:8}}>
            Notes <span style={{color:"rgba(15,23,42,.25)",textTransform:"none",letterSpacing:0}}>(optional)</span>
          </div>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Anything worth remembering…" rows={2}
            style={{width:"100%",background:"rgba(15,23,42,.03)",border:"1px solid rgba(15,23,42,.1)",borderRadius:8,
              padding:"9px 12px",fontSize:13,color:"#0F172A",fontFamily:"DM Sans,sans-serif",resize:"none",outline:"none"}} />
        </div>

        <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:9}}>
          <input type="checkbox" id="moved" checked={moved} onChange={e=>setMoved(e.target.checked)}
            style={{accentColor:"#2563EB",width:15,height:15,cursor:"pointer"}} />
          <label htmlFor="moved" style={{fontSize:12,color:"rgba(15,23,42,.45)",cursor:"pointer"}}>I did this on a different day</label>
        </div>

        <button className="btn" style={{width:"100%",justifyContent:"center",padding:14}} disabled={feel===null}
          onClick={()=>onSubmit({feel,pace,mood,notes:moved?"🔄 Different day — "+notes:notes})}>
          ✓ Mark as complete
        </button>
      </div>
    </div>
  );
}

// ── Settings modal (editable period dates) ────────────────────────────────────
function SettingsModal({ periods, onSave, onClose }) {
  const fmt = d => d instanceof Date ? d.toISOString().split("T")[0] : d;
  const [dates, setDates] = useState(periods.map(p=>({ start:fmt(p.start), end:fmt(p.end), num:p.num })));

  function update(i, field, val) {
    setDates(prev => prev.map((p,j) => j===i ? {...p,[field]:val} : p));
  }

  function handleSave() {
    try {
      const newPeriods = dates.map(d=>({ start:new Date(d.start), end:new Date(d.end), num:d.num }));
      onSave(newPeriods);
      onClose();
    } catch(e) { alert("Invalid dates — please check your entries."); }
  }

  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",background:"rgba(15,23,42,.5)"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="su" style={{width:"100%",maxWidth:700,margin:"0 auto",background:"#fff",borderRadius:"18px 18px 0 0",
        padding:"20px 18px 32px",border:"1px solid rgba(15,23,42,.08)",boxShadow:"0 -4px 32px rgba(15,23,42,.1)"}}>
        <div style={{width:36,height:3,background:"rgba(15,23,42,.12)",borderRadius:2,margin:"0 auto 16px"}} />
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:15,fontWeight:700,color:"#0F172A"}}>Period dates ⚙️</div>
          <button className="btn-ghost" style={{padding:"4px 8px",fontSize:12}} onClick={onClose}>✕</button>
        </div>
        <div style={{fontSize:12,color:"rgba(15,23,42,.4)",marginBottom:18,lineHeight:1.5}}>
          Update your cycle dates so the plan highlights the right weeks. Apple Health can't be read directly from the web, so update these manually when your cycle shifts.
        </div>
        {dates.map((d,i)=>(
          <div key={i} style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(15,23,42,.35)",textTransform:"uppercase",letterSpacing:".08em",marginBottom:7}}>Period {d.num}</div>
            <div style={{display:"flex",gap:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"rgba(15,23,42,.3)",marginBottom:4}}>Start</div>
                <input type="date" value={d.start} onChange={e=>update(i,"start",e.target.value)}
                  style={{width:"100%",background:"rgba(15,23,42,.03)",border:"1px solid rgba(15,23,42,.1)",borderRadius:8,
                    padding:"9px 10px",fontSize:13,color:"#0F172A",fontFamily:"DM Sans,sans-serif",outline:"none",colorScheme:"light"}} />
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"rgba(15,23,42,.3)",marginBottom:4}}>End</div>
                <input type="date" value={d.end} onChange={e=>update(i,"end",e.target.value)}
                  style={{width:"100%",background:"rgba(15,23,42,.03)",border:"1px solid rgba(15,23,42,.1)",borderRadius:8,
                    padding:"9px 10px",fontSize:13,color:"#0F172A",fontFamily:"DM Sans,sans-serif",outline:"none",colorScheme:"light"}} />
              </div>
            </div>
          </div>
        ))}
        <button className="btn" style={{width:"100%",justifyContent:"center",padding:14,marginTop:4}} onClick={handleSave}>
          Save period dates
        </button>
      </div>
    </div>
  );
}
