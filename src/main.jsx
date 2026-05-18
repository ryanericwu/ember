import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://xpqlyryfdqbrnddypiea.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwcWx5cnlmZHFicm5kZHlwaWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5NjQzNTQsImV4cCI6MjA5NDU0MDM1NH0.NRn_6QXe4inu5F6Wa7zWFLI8HZ3n0RoUt8PTnW24mAs";

async function sb(path, opts) {
  var options = opts || {};
  var res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    headers: Object.assign({ "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY, "Content-Type": "application/json" }, options.headers || {}),
    method: options.method || "GET",
    body: options.body
  });
  if (!res.ok) { console.error("SB error", await res.text()); return null; }
  var text = await res.text();
  return text ? JSON.parse(text) : null;
}

var DB = {
  getProfile: function() { return sb("profile?select=*&limit=1"); },
  upsertProfile: function(p) { return sb("profile", { method: "POST", body: JSON.stringify(p), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }); },
  getFoodLog: function(date) { return sb("food_log?date=eq." + date + "&order=created_at.desc"); },
  addFood: function(e) { return sb("food_log", { method: "POST", body: JSON.stringify(e), headers: { "Prefer": "return=representation" } }); },
  deleteFood: function(id) { return sb("food_log?id=eq." + id, { method: "DELETE" }); },
  patchFood: function(id, data) { return sb("food_log?id=eq." + id, { method: "PATCH", body: JSON.stringify(data) }); },
  getSteps: function(date) { return sb("steps_log?date=eq." + date + "&limit=1"); },
  upsertSteps: function(date, steps) { return sb("steps_log", { method: "POST", body: JSON.stringify({ date: date, steps: steps }), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }); },
  getSummaries: function() { return sb("daily_summary?order=date.desc&limit=90"); },
  upsertSummary: function(s) { return sb("daily_summary", { method: "POST", body: JSON.stringify(s), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }); },
  getSets: function() { return sb("workout_sets?order=date.asc,created_at.asc"); },
  addSet: function(s) { return sb("workout_sets", { method: "POST", body: JSON.stringify(s), headers: { "Prefer": "return=representation" } }); },
  getPRs: function() { return sb("personal_records?select=*"); },
  upsertPR: function(pr) { return sb("personal_records", { method: "POST", body: JSON.stringify(pr), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }); },
  getWeights: function() { return sb("weight_log?order=date.asc"); },
  upsertWeight: function(w) { return sb("weight_log", { method: "POST", body: JSON.stringify(w), headers: { "Prefer": "resolution=merge-duplicates,return=representation" } }); },
  getExercises: function() { return sb("exercise_library?order=equipment_type.asc,name.asc"); },
  addExercise: function(e) { return sb("exercise_library", { method: "POST", body: JSON.stringify(e), headers: { "Prefer": "return=representation" } }); },
  deleteExercise: function(id) { return sb("exercise_library?id=eq." + id, { method: "DELETE" }); },
  getCustomFoods: function() { return sb("custom_foods?order=name.asc"); },
  addCustomFood: function(f) { return sb("custom_foods", { method: "POST", body: JSON.stringify(f), headers: { "Prefer": "return=representation" } }); },
};

var C = {
  bg: "#0a0a0a", surface: "#111", card: "#161616", border: "#222",
  red: "#ff3d00", redGlow: "rgba(255,61,0,0.3)",
  green: "#00e676", yellow: "#ffd600",
  text: "#fff", muted: "#666", dim: "#999",
};

var STYLE = "@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;600&display=swap');" +
  "* { box-sizing: border-box; margin: 0; padding: 0; }" +
  "body { background: " + C.bg + "; color: " + C.text + "; font-family: 'DM Sans', sans-serif; }" +
  ".bebas { font-family: 'Bebas Neue', sans-serif; letter-spacing: 0.05em; }" +
  "input, select { background: #1a1a1a; border: 1px solid #2a2a2a; color: #fff; border-radius: 8px; padding: 10px 14px; font-family: 'DM Sans', sans-serif; font-size: 14px; outline: none; width: 100%; }" +
  "input:focus, select:focus { border-color: " + C.red + "; box-shadow: 0 0 0 2px " + C.redGlow + "; }" +
  "button { cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; border-radius: 8px; font-weight: 600; transition: all 0.15s; }" +
  "@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }" +
  "@keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }" +
  "@keyframes spin { to{transform:rotate(360deg)} }";

var NAV = [
  { id: "dashboard", icon: "⚡", label: "Energy" },
  { id: "log", icon: "🍗", label: "Log" },
  { id: "strength", icon: "💪", label: "Strength" },
  { id: "progress", icon: "📈", label: "Progress" },
];

var ACTIVITY = [
  { value: 1.2, label: "Sedentary", desc: "Desk job, little movement" },
  { value: 1.375, label: "Lightly Active", desc: "Light exercise 1-3x/week" },
  { value: 1.55, label: "Moderately Active", desc: "Exercise 3-5x/week" },
  { value: 1.725, label: "Very Active", desc: "Hard exercise 6-7x/week" },
];

function calcTDEE(p) {
  if (!p || !p.weight_lbs || !p.height_in || !p.age) return 2000;
  var base = Math.round(10 * (p.weight_lbs * 0.453592) + 6.25 * (p.height_in * 2.54) - 5 * p.age + 5);
  return Math.round(base * (p.activity || 1.2));
}
function calcStepsBurn(steps, weight) { return Math.round(steps * 0.04 * (weight / 150)); }
function getPSTDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()); }
function msTillMidnight() {
  var parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(new Date());
  var h = +parts.find(function(p) { return p.type === "hour"; }).value;
  var m = +parts.find(function(p) { return p.type === "minute"; }).value;
  var s = +parts.find(function(p) { return p.type === "second"; }).value;
  return ((24 * 3600) - (h * 3600 + m * 60 + s)) * 1000;
}
function fmtDate(ds) { return new Date(ds + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function maxPerSession(sets, ex) {
  var m = {};
  sets.filter(function(s) { return s.exercise_name === ex; }).forEach(function(s) {
    if (!m[s.date] || s.weight_lbs > m[s.date]) m[s.date] = s.weight_lbs;
  });
  return Object.keys(m).sort().map(function(d) { return { date: d, value: m[d] }; });
}

function Spinner() {
  return <div style={{ width: 20, height: 20, border: "2px solid #222", borderTop: "2px solid " + C.red, borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto" }} />;
}

function Card(props) {
  return <div style={Object.assign({ background: C.card, border: "1px solid " + C.border, borderRadius: 16, padding: 20 }, props.style || {})}>{props.children}</div>;
}

function Btn(props) {
  return <button onClick={props.onClick} style={Object.assign({ background: C.red, color: "#fff", padding: "10px 20px", fontSize: 13, borderRadius: 8 }, props.style || {})}>{props.label}</button>;
}

function SectionTitle(props) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="bebas" style={{ fontSize: 28, letterSpacing: 2 }}>{props.title}</div>
      {props.sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{props.sub}</div>}
    </div>
  );
}

function MiniSpark(props) {
  var data = props.data;
  if (!data || data.length < 2) return null;
  var color = props.color || C.red;
  var W = 80, H = 30;
  var min = Math.min.apply(null, data), max = Math.max.apply(null, data), range = max - min || 1;
  var pts = data.map(function(v, i) { return ((i / (data.length - 1)) * W) + "," + (H - ((v - min) / range) * H); }).join(" ");
  var last = pts.split(" ").pop().split(",");
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill={color} />
    </svg>
  );
}

function LineChart(props) {
  var data = props.data;
  var color = props.color || C.red;
  var unit = props.unit || "lbs";
  if (!data || data.length === 0) return <div style={{ color: C.muted, textAlign: "center", padding: "40px 0" }}>No data yet</div>;
  var vals = data.map(function(d) { return d.value !== undefined ? d.value : (d.weight_lbs !== undefined ? d.weight_lbs : d); });
  var min = Math.min.apply(null, vals) - 5;
  var max = Math.max.apply(null, vals) + 5;
  var W = 320, H = 120;
  var pts = vals.map(function(v, i) {
    return { x: 20 + (i / Math.max(vals.length - 1, 1)) * (W - 40), y: H - 10 - ((v - min) / (max - min)) * (H - 20), v: v };
  });
  var pathD = pts.map(function(p, i) { return (i === 0 ? "M" : "L") + " " + p.x + " " + p.y; }).join(" ");
  var areaD = pathD + " L " + pts[pts.length - 1].x + " " + H + " L " + pts[0].x + " " + H + " Z";
  var gid = "g" + props.label;
  return (
    <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: H }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={"url(#" + gid + ")"} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map(function(p, i) {
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} />
            {i === pts.length - 1 && <text x={p.x} y={p.y - 10} fill={color} fontSize="11" textAnchor="middle" fontFamily="DM Sans">{p.v}{unit}</text>}
          </g>
        );
      })}
    </svg>
  );
}

function EnergyBar(props) {
  var balance = props.balance;
  var tdee = props.tdee;
  var isDeficit = balance <= 0;
  var pct = Math.min(1, Math.abs(balance) / tdee);
  var color = isDeficit
    ? (pct < 0.33 ? C.green : pct < 0.66 ? C.yellow : C.red)
    : (pct < 0.5 ? "#ff9500" : C.red);
  var segs = 40;
  var mid = segs / 2;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2, marginBottom: 4 }}>{isDeficit ? "DEFICIT" : "SURPLUS"}</div>
        <div className="bebas" style={{ fontSize: 52, color: color, lineHeight: 1, textShadow: "0 0 20px " + color }}>{isDeficit ? "-" : "+"}{Math.abs(Math.round(balance))}</div>
        <div style={{ fontSize: 11, color: C.muted, letterSpacing: 2 }}>KCAL</div>
      </div>
      <div style={{ width: "100%", position: "relative" }}>
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          {Array.from({ length: segs }).map(function(_, i) {
            var isLeft = i < mid;
            var distFromMid = isLeft ? (mid - 1 - i) : (i - mid);
            var filled = isDeficit ? (isLeft && distFromMid < pct * mid) : (!isLeft && distFromMid < pct * mid);
            var isMid = i === mid - 1 || i === mid;
            return (
              <div key={i} style={{
                flex: 1, height: isMid ? 18 : 10, borderRadius: 3,
                background: filled ? color : (isLeft ? "#071a07" : "#1a0a00"),
                boxShadow: filled ? ("0 0 6px " + color) : "none",
                transition: "all 0.4s ease"
              }} />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: C.muted }}>
          <span>-{tdee} deficit</span>
          <span style={{ color: "#444", fontWeight: 700 }}>0</span>
          <span>+surplus</span>
        </div>
      </div>
    </div>
  );
}

function FoodSearch(props) {
  var customFoods = props.customFoods;
  var onAdd = props.onAdd;
  var onSave = props.onSave;
  var [q, setQ] = useState("");
  var [results, setResults] = useState([]);
  var [searching, setSearching] = useState(false);
  var [err, setErr] = useState("");
  var [sel, setSel] = useState(null);
  var [showManual, setShowManual] = useState(false);
  var [manualName, setManualName] = useState("");
  var [manualCal, setManualCal] = useState("");
  var PRESETS = [0.5, 1, 1.5, 2, 3];

  function doSearch() {
    if (!q.trim()) return;
    var cf = (customFoods || []).filter(function(f) { return f.name.toLowerCase().includes(q.toLowerCase()); })
      .map(function(f) { return { name: f.name, calories: f.calories_per_serving, serving: "1 serving", src: "custom" }; });
    setSearching(true); setResults([]); setErr("");
    fetch("https://world.openfoodfacts.org/cgi/search.pl?search_terms=" + encodeURIComponent(q) + "&search_simple=1&action=process&json=1&page_size=6&fields=product_name,nutriments,serving_size")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var db = (data.products || []).filter(function(p) { return p.product_name && p.nutriments && p.nutriments["energy-kcal_serving"]; })
          .slice(0, 5).map(function(p) { return { name: p.product_name, calories: Math.round(p.nutriments["energy-kcal_serving"]), serving: p.serving_size || "1 serving", src: "db" }; });
        var all = cf.concat(db);
        setSearching(false); setResults(all); setErr(all.length === 0 ? "No results — add manually." : "");
      })
      .catch(function() {
        setSearching(false); setResults(cf); setErr(cf.length === 0 ? "Search failed — add manually." : "");
      });
  }

  function logEntry(name, cal) {
    if (!name || !cal) return;
    onAdd(name, cal);
    setResults([]); setQ(""); setSel(null); setShowManual(false); setManualName(""); setManualCal("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={q} onChange={function(e) { setQ(e.target.value); }} placeholder="Search any food..." onKeyDown={function(e) { if (e.key === "Enter") doSearch(); }} />
        <button onClick={doSearch} style={{ background: C.red, color: "#fff", padding: "10px 14px", borderRadius: 8, fontSize: 13, whiteSpace: "nowrap" }}>GO</button>
      </div>
      {searching && <div style={{ color: C.green, fontSize: 12, animation: "pulse 1.5s infinite" }}>Searching...</div>}
      {results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 11, color: C.muted }}>TAP TO ADJUST & ADD</div>
          {results.map(function(r, i) {
            var isExp = sel && sel.r === r;
            var mult = isExp ? sel.mult : 1;
            var adj = Math.round(r.calories * mult);
            return (
              <div key={i} style={{ background: C.surface, border: "1px solid " + (isExp ? C.red : C.border), borderRadius: 10, overflow: "hidden" }}>
                <button onClick={function() { setSel(isExp ? null : { r: r, mult: 1 }); }}
                  style={{ width: "100%", background: "none", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, textAlign: "left" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name.length > 28 ? r.name.slice(0, 28) + "…" : r.name}</div>
                    <div style={{ fontSize: 10, color: r.src === "custom" ? C.yellow : C.muted }}>{r.src === "custom" ? "⭐ My foods" : "per " + r.serving}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: C.green, fontWeight: 700, fontSize: 14 }}>+{adj}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{isExp ? "▲" : "▼"}</span>
                  </div>
                </button>
                {isExp && (
                  <div style={{ padding: "0 14px 14px", animation: "fadeIn 0.15s ease" }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>SERVINGS</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                      {PRESETS.map(function(p) {
                        return <button key={p} onClick={function() { setSel({ r: r, mult: p }); }}
                          style={{ flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12, fontWeight: 600, background: mult === p ? C.red : C.card, color: mult === p ? "#fff" : C.muted, border: "1px solid " + (mult === p ? C.red : C.border) }}>{p}x</button>;
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                      <input type="number" step="0.25" min="0.25" value={mult} onChange={function(e) { setSel({ r: r, mult: parseFloat(e.target.value) || 1 }); }} style={{ flex: 1 }} />
                      <span style={{ color: C.muted, fontSize: 12, whiteSpace: "nowrap" }}>= {adj} kcal</span>
                    </div>
                    <button onClick={function() { logEntry(r.name, adj); }}
                      style={{ width: "100%", background: C.red, color: "#fff", padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>+ LOG {adj} KCAL</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {err && <div style={{ fontSize: 12, color: C.muted }}>{err}</div>}
      <button onClick={function() { setShowManual(function(p) { return !p; }); }}
        style={{ background: "none", border: "1px dashed " + C.border, color: C.muted, padding: "8px 14px", borderRadius: 8, fontSize: 12, width: "100%" }}>
        {showManual ? "✕ Cancel" : "+ Add manually / save custom food"}
      </button>
      {showManual && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "fadeIn 0.2s ease" }}>
          <input value={manualName} onChange={function(e) { setManualName(e.target.value); }} placeholder="Food name" />
          <input type="number" value={manualCal} onChange={function(e) { setManualCal(e.target.value); }} placeholder="Calories (look up in Lose It)" />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={function() { if (!manualName || !manualCal) return; onSave(manualName, parseInt(manualCal)); logEntry(manualName, parseInt(manualCal)); }}
              style={{ flex: 1, background: C.red, color: "#fff", padding: 10, borderRadius: 8, fontSize: 12 }}>Log + Save</button>
            <button onClick={function() { if (!manualName || !manualCal) return; logEntry(manualName, parseInt(manualCal)); }}
              style={{ flex: 1, background: C.surface, border: "1px solid " + C.border, color: C.dim, padding: 10, borderRadius: 8, fontSize: 12 }}>Log only</button>
          </div>
          <div style={{ fontSize: 11, color: C.muted }}>"Log + Save" stores it for future searches.</div>
        </div>
      )}
    </div>
  );
}

function AIBox(props) {
  if (!props.text && !props.loading) return null;
  return (
    <div style={{ background: "#0d1a14", border: "1px solid rgba(0,230,118,0.2)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>
      {props.loading
        ? <div style={{ color: C.green, fontSize: 13, animation: "pulse 1.5s infinite" }}>⚡ AI thinking...</div>
        : <div style={{ color: C.dim, fontSize: 13, lineHeight: 1.6 }}>{props.text}</div>}
    </div>
  );
}


function ProgressTab(props) {
  var summaries = props.summaries || [];
  var weights = props.weights || [];
  var tdee = props.tdee || 2000;
  var [range, setRange] = useState(7);
  var RANGES = [
    { label: "7D", days: 7 },
    { label: "30D", days: 30 },
    { label: "90D", days: 90 },
    { label: "1Y", days: 365 },
  ];

  // Filter summaries by selected range
  var cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - range);
  var cutoffStr = cutoff.toISOString().split("T")[0];

  var filtered = summaries.filter(function(d) { return d.date >= cutoffStr; }).slice().reverse();
  var filteredWeights = weights.filter(function(d) { return d.date >= cutoffStr; });

  function RangeSelector() {
    return (
      <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
        {RANGES.map(function(r) {
          return (
            <button key={r.days} onClick={function() { setRange(r.days); }}
              style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, background: range === r.days ? C.red : C.surface, color: range === r.days ? "#fff" : C.muted, border: "1px solid " + (range === r.days ? C.red : C.border) }}>
              {r.label}
            </button>
          );
        })}
      </div>
    );
  }

  function SimpleChart(props) {
    var data = props.data;
    var color = props.color || C.red;
    var label = props.label;
    var unit = props.unit || "";
    var showZeroLine = props.showZeroLine;
    if (!data || data.length < 2) {
      return (
        <div style={{ padding: "20px 0", textAlign: "center", color: C.muted, fontSize: 12 }}>
          Not enough data yet — check back after a few days.
        </div>
      );
    }
    var vals = data.map(function(d) { return d.value; });
    var min = Math.min.apply(null, vals);
    var max = Math.max.apply(null, vals);
    var padding = Math.max(Math.abs(max - min) * 0.1, 20);
    var yMin = min - padding, yMax = max + padding;
    var W = 320, H = 100;
    var pts = data.map(function(d, i) {
      return {
        x: 20 + (i / Math.max(data.length - 1, 1)) * (W - 40),
        y: H - 10 - ((d.value - yMin) / (yMax - yMin)) * (H - 20),
        v: d.value,
        date: d.date
      };
    });
    var pathD = pts.map(function(p, i) { return (i === 0 ? "M" : "L") + " " + p.x + " " + p.y; }).join(" ");
    var areaD = pathD + " L " + pts[pts.length-1].x + " " + H + " L " + pts[0].x + " " + H + " Z";
    var zeroY = showZeroLine ? (H - 10 - ((0 - yMin) / (yMax - yMin)) * (H - 20)) : null;
    var gid = "pg" + label;
    return (
      <svg viewBox={"0 0 " + W + " " + H} style={{ width: "100%", height: H }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {showZeroLine && zeroY !== null && zeroY > 0 && zeroY < H && (
          <line x1="20" y1={zeroY} x2={W - 20} y2={zeroY} stroke="#333" strokeWidth="1" strokeDasharray="4 4" />
        )}
        <path d={areaD} fill={"url(#" + gid + ")"} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={pts[pts.length-1].x} cy={pts[pts.length-1].y} r="4" fill={color} />
        <text x={pts[pts.length-1].x} y={pts[pts.length-1].y - 10} fill={color} fontSize="11" textAnchor="middle" fontFamily="DM Sans">{pts[pts.length-1].v}{unit}</text>
        <text x="20" y={H} fill={C.muted} fontSize="9" fontFamily="DM Sans">{data[0] && data[0].date ? data[0].date.slice(5) : ""}</text>
        <text x={W - 20} y={H} fill={C.muted} fontSize="9" fontFamily="DM Sans" textAnchor="end">{data[data.length-1] && data[data.length-1].date ? data[data.length-1].date.slice(5) : ""}</text>
      </svg>
    );
  }

  var netData = filtered.map(function(d) { return { date: d.date, value: Math.round(d.final_balance) }; });
  var eatenData = filtered.map(function(d) { return { date: d.date, value: d.total_eaten }; });
  var burnedData = filtered.map(function(d) { return { date: d.date, value: Math.round(d.total_eaten - d.final_balance) }; });
  var weightData = filteredWeights.map(function(d) { return { date: d.date, value: d.weight_lbs }; });

  var avgNet = netData.length ? Math.round(netData.reduce(function(a, d) { return a + d.value; }, 0) / netData.length) : 0;
  var avgEaten = eatenData.length ? Math.round(eatenData.reduce(function(a, d) { return a + d.value; }, 0) / eatenData.length) : 0;
  var deficitDays = netData.filter(function(d) { return d.value < 0; }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <RangeSelector />

      {/* Summary stats */}
      {filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[
            { lbl: "Avg Deficit", val: (avgNet <= 0 ? "-" : "+") + Math.abs(avgNet), color: avgNet <= 0 ? C.green : C.red },
            { lbl: "Avg Eaten", val: avgEaten, color: C.muted },
            { lbl: "Deficit Days", val: deficitDays + "/" + netData.length, color: C.green },
          ].map(function(s) {
            return (
              <div key={s.lbl} style={{ background: C.surface, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                <div className="bebas" style={{ fontSize: 20, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{s.lbl}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Net Calorie Balance */}
      <Card>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, letterSpacing: 1 }}>NET CALORIE BALANCE</div>
        <div style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>Below 0 = deficit (good for fat loss) · Above 0 = surplus</div>
        <SimpleChart data={netData} color={C.green} label="net" unit=" kcal" showZeroLine={true} />
      </Card>

      {/* Calories Eaten */}
      <Card>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, letterSpacing: 1 }}>CALORIES EATEN</div>
        <SimpleChart data={eatenData} color={C.yellow} label="eaten" unit=" kcal" />
      </Card>

      {/* Calories Burned */}
      <Card>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, letterSpacing: 1 }}>CALORIES BURNED</div>
        <SimpleChart data={burnedData} color={C.red} label="burned" unit=" kcal" />
      </Card>

      {/* Body Weight */}
      <Card>
        <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, letterSpacing: 1 }}>BODY WEIGHT</div>
        {weightData.length > 1 ? (
          <div>
            <SimpleChart data={weightData} color={C.green} label="bw" unit="lbs" />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontSize: 12 }}>
              <span style={{ color: C.muted }}>Start: {weightData[0].value} lbs</span>
              <span style={{ color: C.green, fontWeight: 700 }}>Now: {weightData[weightData.length-1].value} lbs</span>
              <span style={{ color: parseFloat(weightData[weightData.length-1].value - weightData[0].value) < 0 ? C.green : C.red, fontWeight: 700 }}>
                {(weightData[weightData.length-1].value - weightData[0].value).toFixed(1)} lbs
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px 0", textAlign: "center", color: C.muted, fontSize: 12 }}>Log your weight daily under the Log tab to see trends here.</div>
        )}
      </Card>
    </div>
  );
}


function SwipeToDelete(props) {
  var onDelete = props.onDelete;
  var children = props.children;
  var [offsetX, setOffsetX] = useState(0);
  var [startX, setStartX] = useState(null);
  var THRESHOLD = 80;
  var DELETE_WIDTH = 80;

  function onTouchStart(e) {
    setStartX(e.touches[0].clientX);
  }

  function onTouchMove(e) {
    if (startX === null) return;
    var diff = e.touches[0].clientX - startX;
    if (diff < 0) {
      setOffsetX(Math.max(diff, -DELETE_WIDTH));
    }
  }

  function onTouchEnd() {
    if (offsetX < -THRESHOLD) {
      setOffsetX(-DELETE_WIDTH);
    } else {
      setOffsetX(0);
    }
    setStartX(null);
  }

  function reset() {
    setOffsetX(0);
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 16 }}>
      {/* Delete button revealed behind */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: DELETE_WIDTH, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 16px 16px 0" }}>
        <button onClick={function() { reset(); onDelete(); }}
          style={{ background: "none", color: "#fff", fontSize: 13, fontWeight: 700, padding: "0 16px", height: "100%" }}>
          Delete
        </button>
      </div>
      {/* Swipeable content */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: "translateX(" + offsetX + "px)", transition: startX === null ? "transform 0.3s ease" : "none", position: "relative", zIndex: 1 }}
      >
        {children}
      </div>
    </div>
  );
}

export default function EmberApp() {
  var [loading, setLoading] = useState(true);
  var [loadErr, setLoadErr] = useState("");
  var [tab, setTab] = useState("dashboard");
  var [profile, setProfile] = useState({ weight_lbs: 185, height_in: 70, age: 28, activity: 1.2 });
  var [showProfile, setShowProfile] = useState(false);
  var [energy, setEnergy] = useState(null);
  var [foodLog, setFoodLog] = useState([]);
  var [steps, setSteps] = useState(0);
  var [stepsInput, setStepsInput] = useState("");
  var [summaries, setSummaries] = useState([]);
  var [histLogs, setHistLogs] = useState({});
  var [editDay, setEditDay] = useState(null);
  var [exercises, setExercises] = useState([]);
  var [sets, setSets] = useState([]);
  var [selEx, setSelEx] = useState("");
  var [newSet, setNewSet] = useState({ reps: "", weight: "" });
  var [aiSug, setAiSug] = useState({ loading: false, text: "" });
  var [prs, setPrs] = useState({});
  var [newEx, setNewEx] = useState({ name: "" });
  var [showAddEx, setShowAddEx] = useState(false);
  var [showChart, setShowChart] = useState(false);
  var [weights, setWeights] = useState([]);
  var [newW, setNewW] = useState("");
  var [customFoods, setCustomFoods] = useState([]);
  var [editingFood, setEditingFood] = useState(null);

  var timerRef = useRef(null);
  var midRef = useRef(null);
  var startRef = useRef(Date.now());
  var baseRef = useRef(null);
  var energyRef = useRef(null);
  var foodRef = useRef([]);
  var stepsRef = useRef(0);

  useEffect(function() { foodRef.current = foodLog; }, [foodLog]);
  useEffect(function() { stepsRef.current = steps; }, [steps]);
  useEffect(function() { energyRef.current = energy; }, [energy]);

  var tdee = calcTDEE(profile);
  var currentDate = getPSTDate();

  async function load() {
    setLoading(true);
    var today = getPSTDate();
    try {
      var results = await Promise.all([
        DB.getProfile(), DB.getFoodLog(today), DB.getSteps(today),
        DB.getSets(), DB.getPRs(), DB.getWeights(),
        DB.getExercises(), DB.getCustomFoods(), DB.getSummaries()
      ]);
      var prof = results[0], fl = results[1], st = results[2], ws = results[3],
          pr = results[4], wl = results[5], ex = results[6], cf = results[7], sum = results[8];
      if (prof && prof.length) { var p = prof[0]; setProfile({ weight_lbs: p.weight_lbs, height_in: p.height_in, age: p.age, activity: p.activity || 1.2 }); }
      if (fl) setFoodLog(fl);
      if (st && st.length) setSteps(st[0].steps);
      if (ws) setSets(ws);
      if (pr) { var m = {}; pr.forEach(function(p) { m[p.exercise_name] = { weight: p.weight_lbs, date: p.date }; }); setPrs(m); }
      if (wl) setWeights(wl);
      if (ex && ex.length) { setExercises(ex); setSelEx(ex[0].name); }
      if (cf) setCustomFoods(cf);
      if (sum) setSummaries(sum);
    } catch(e) { setLoadErr(e.message || "Unknown error"); }
    setLoading(false);
  }

  useEffect(function() { load(); }, []);

  useEffect(function() {
    if (loading) return;
    var pstStr = new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
    var pstNow = new Date(pstStr);
    var midnight = new Date(pstNow); midnight.setHours(0, 0, 0, 0);
    var elapsed = (pstNow - midnight) / 1000;
    var burned = (tdee / 86400) * elapsed;
    var eaten = foodLog.reduce(function(a, f) { return a + f.calories; }, 0);
    var stepsBurned = calcStepsBurn(steps, profile.weight_lbs);
    var balance = eaten - burned - stepsBurned;
    baseRef.current = balance; startRef.current = Date.now();
    setEnergy(balance);
  }, [loading, tdee]);

  useEffect(function() {
    if (energy === null) return;
    var drain = tdee / 86400;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(function() {
      var elapsed = (Date.now() - startRef.current) / 1000;
      setEnergy(baseRef.current - drain * elapsed);
    }, 1000);
    return function() { clearInterval(timerRef.current); };
  }, [tdee, energy === null]);

  useEffect(function() {
    function schedule() {
      clearTimeout(midRef.current);
      midRef.current = setTimeout(async function() {
        var today = getPSTDate();
        var log = foodRef.current;
        var sum = { date: today, total_eaten: log.reduce(function(a, f) { return a + f.calories; }, 0), steps: stepsRef.current, final_balance: Math.round(energyRef.current || 0) };
        await DB.upsertSummary(sum);
        setSummaries(function(p) { return [sum].concat(p.filter(function(d) { return d.date !== today; })).slice(0, 90); });
        setFoodLog([]); setSteps(0);
        baseRef.current = 0; startRef.current = Date.now(); setEnergy(0);
        schedule();
      }, msTillMidnight());
    }
    schedule();
    return function() { clearTimeout(midRef.current); };
  }, [tdee]);

  async function addFood(name, cal) {
    var today = getPSTDate();
    var time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    var temp = { id: "temp-" + Date.now(), date: today, food_name: name, calories: cal, logged_time: time };
    setFoodLog(function(p) { return [temp].concat(p); });
    baseRef.current += cal; startRef.current = Date.now();
    setEnergy(function(p) { return (p || 0) + cal; });
    var r = await DB.addFood({ date: today, food_name: name, calories: cal, logged_time: time });
    if (r) setFoodLog(function(p) { return p.map(function(f) { return f.id === temp.id ? r[0] : f; }); });
  }

  async function delFood(id, cal) {
    setFoodLog(function(p) { return p.filter(function(f) { return f.id !== id; }); });
    baseRef.current -= cal; startRef.current = Date.now();
    setEnergy(function(p) { return (p || 0) - cal; });
    if (!String(id).startsWith("temp-")) await DB.deleteFood(id);
  }

  async function editFood(f, newName, newCal) {
    var diff = newCal - f.calories;
    setFoodLog(function(p) { return p.map(function(x) { return x.id === f.id ? Object.assign({}, x, { food_name: newName, calories: newCal }) : x; }); });
    baseRef.current += diff; startRef.current = Date.now();
    setEnergy(function(p) { return (p || 0) + diff; });
    setEditingFood(null);
    if (!String(f.id).startsWith("temp-")) await DB.patchFood(f.id, { food_name: newName, calories: newCal });
  }

  async function saveFood(name, cal) {
    var r = await DB.addCustomFood({ name: name, calories_per_serving: cal });
    if (r) setCustomFoods(function(p) { return p.concat(r); });
  }

  async function saveSteps() {
    var s = parseInt(stepsInput); if (!s) return;
    var prevBurn = calcStepsBurn(steps, profile.weight_lbs);
    var newBurn = calcStepsBurn(s, profile.weight_lbs);
    var delta = newBurn - prevBurn;
    setSteps(s);
    baseRef.current -= delta; startRef.current = Date.now();
    setEnergy(function(p) { return (p || 0) - delta; });
    setStepsInput("");
    await DB.upsertSteps(getPSTDate(), s);
  }

  async function loadHist(date) {
    if (histLogs[date]) return;
    var d = await DB.getFoodLog(date);
    setHistLogs(function(p) { return Object.assign({}, p, { [date]: d || [] }); });
  }

  async function addHist(date, name, cal) {
    var r = await DB.addFood({ date: date, food_name: name, calories: cal, logged_time: "added later" });
    if (r) {
      var newLog = [r[0]].concat(histLogs[date] || []);
      setHistLogs(function(p) { return Object.assign({}, p, { [date]: newLog }); });
      setSummaries(function(p) { return p.map(function(d) { return d.date === date ? Object.assign({}, d, { total_eaten: newLog.reduce(function(a, f) { return a + f.calories; }, 0) }) : d; }); });
    }
  }

  async function delHist(date, id) {
    await DB.deleteFood(id);
    var newLog = (histLogs[date] || []).filter(function(f) { return f.id !== id; });
    setHistLogs(function(p) { return Object.assign({}, p, { [date]: newLog }); });
    setSummaries(function(p) { return p.map(function(d) { return d.date === date ? Object.assign({}, d, { total_eaten: newLog.reduce(function(a, f) { return a + f.calories; }, 0) }) : d; }); });
  }

  async function logSet() {
    if (!newSet.reps || !newSet.weight) return;
    var w = parseFloat(newSet.weight);
    var r = await DB.addSet({ date: currentDate, exercise_name: selEx, reps: parseInt(newSet.reps), weight_lbs: w });
    if (r) setSets(function(p) { return p.concat(r); });
    var prev = Math.max.apply(null, [0].concat(maxPerSession(sets, selEx).map(function(d) { return d.value; })));
    if (w > prev) { await DB.upsertPR({ exercise_name: selEx, weight_lbs: w, date: currentDate }); setPrs(function(p) { return Object.assign({}, p, { [selEx]: { weight: w, date: currentDate } }); }); }
    setNewSet({ reps: "", weight: "" });
  }

  async function getAI() {
    setAiSug({ loading: true, text: "" });
    var hist = maxPerSession(sets, selEx).slice(-4);
    var recent = sets.filter(function(s) { return s.exercise_name === selEx; }).slice(-12);
    var txt = hist.map(function(d) {
      return d.date + ": " + recent.filter(function(s) { return s.date === d.date; }).map(function(s) { return s.reps + "x" + s.weight_lbs + "lbs"; }).join(", ");
    }).join("\n");
    try {
      var res = await fetch("/api/ai", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000, messages: [{ role: "user", content: "You are a friendly coach helping a beginner at the gym. Exercise: " + selEx + ". Recent history:\n" + (txt || "No history yet.") + "\n\nGive a simple recommendation in plain English — no jargon. Tell them exactly how many sets, how many reps, and what weight to use. If they have no history, suggest a safe beginner starting weight. End with one short encouraging tip. Keep it to 3 sentences max and write like you're texting a friend." }] })
      });
      var data = await res.json();
      setAiSug({ loading: false, text: data.content[0].text });
    } catch(e) { setAiSug({ loading: false, text: "Could not load suggestion." }); }
  }

  async function logWeight() {
    if (!newW) return;
    var w = parseFloat(newW);
    var entry = { date: currentDate, weight_lbs: w };
    // Update UI immediately
    setWeights(function(p) { return p.filter(function(x) { return x.date !== currentDate; }).concat([entry]).sort(function(a, b) { return a.date.localeCompare(b.date); }); });
    var updated = Object.assign({}, profile, { weight_lbs: w });
    setProfile(updated);
    setNewW("");
    // Save to DB in background
    await DB.upsertWeight(entry);
    await DB.upsertProfile(updated);
  }

  async function deleteExercise(id) {
    setExercises(function(p) { return p.filter(function(e) { return e.id !== id; }); });
    if (!String(id).startsWith("temp-ex-")) await DB.deleteExercise(id);
    if (selEx === exercises.find(function(e) { return e.id === id; })?.name) setSelEx("");
  }

  async function addExercise() {
    if (!newEx.name) return;
    // Update UI immediately
    var temp = { id: "temp-ex-" + Date.now(), name: newEx.name, muscle_group: "", equipment_type: "" };
    setExercises(function(p) { return p.concat([temp]); });
    setNewEx({ name: "" });
    setShowAddEx(false);
    // Save to DB in background
    var r = await DB.addExercise({ name: temp.name, muscle_group: "", equipment_type: "" });
    if (r) setExercises(function(p) { return p.map(function(e) { return e.id === temp.id ? r[0] : e; }); });
  }

  var eaten = foodLog.reduce(function(a, f) { return a + f.calories; }, 0);
  var stepsCal = calcStepsBurn(steps, profile.weight_lbs);
  var totalBurn = Math.round(eaten - (energy || 0));
  var todaySets = sets.filter(function(s) { return s.date === currentDate && s.exercise_name === selEx; });
  var chartData = maxPerSession(sets, selEx);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 20 }}>
        <style>{STYLE}</style>
        <div className="bebas" style={{ fontSize: 48, color: C.red }}>EMBER</div>
        {loadErr ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>⚠️ {loadErr}</div>
            <button onClick={function() { setLoadErr(""); load(); }} style={{ background: C.red, color: "#fff", padding: "10px 24px", borderRadius: 8, fontSize: 13 }}>Retry</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <Spinner />
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: 3 }}>LOADING YOUR DATA...</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, maxWidth: 420, margin: "0 auto", paddingBottom: 80 }}>
      <style>{STYLE}</style>

      <div style={{ padding: "20px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="bebas" style={{ fontSize: 32, color: C.red }}>EMBER</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 3 }}>BURN. FUEL. FORGE.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <button onClick={function() { setShowProfile(function(p) { return !p; }); }}
            style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "6px 12px", color: C.dim, fontSize: 11 }}>⚙️ Profile</button>
          <div style={{ fontSize: 10, color: C.muted }}>{currentDate}</div>
        </div>
      </div>

      {showProfile && (
        <div style={{ margin: "0 16px 16px", animation: "fadeIn 0.2s ease" }}>
          <Card>
            <div className="bebas" style={{ fontSize: 20, marginBottom: 12, color: C.red }}>YOUR PROFILE</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              {[["Weight (lbs)", "weight_lbs"], ["Height (in)", "height_in"], ["Age", "age"]].map(function(pair) {
                return (
                  <div key={pair[1]}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{pair[0]}</div>
                    <input type="number" value={profile[pair[1]]} onChange={function(e) { setProfile(function(p) { return Object.assign({}, p, { [pair[1]]: parseFloat(e.target.value) }); }); }} />
                  </div>
                );
              })}
              <div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>DAILY BURN (TDEE)</div>
                <div style={{ color: C.green, fontSize: 18, fontWeight: 700, padding: "10px 0" }}>{tdee} kcal</div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>ACTIVITY LEVEL</div>
              {ACTIVITY.map(function(a) {
                return (
                  <button key={a.value} onClick={function() { setProfile(function(p) { return Object.assign({}, p, { activity: a.value }); }); }}
                    style={{ width: "100%", background: profile.activity === a.value ? "rgba(255,61,0,0.15)" : C.surface, border: "1px solid " + (profile.activity === a.value ? C.red : C.border), borderRadius: 8, padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, textAlign: "left", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: profile.activity === a.value ? C.red : C.text }}>{a.label}</div>
                      <div style={{ fontSize: 10, color: C.muted }}>{a.desc}</div>
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>x{a.value}</div>
                  </button>
                );
              })}
            </div>
            <Btn label="SAVE PROFILE" onClick={function() { DB.upsertProfile(profile); setShowProfile(false); }} style={{ width: "100%", padding: 10 }} />
          </Card>
        </div>
      )}



      <div style={{ padding: "0 16px", animation: "fadeIn 0.2s ease" }}>

        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionTitle title="ENERGY METER" sub={"TDEE " + tdee + " + " + stepsCal + " steps = " + (tdee + stepsCal) + " kcal total burn"} />
            <Card>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <EnergyBar balance={energy || 0} tdee={tdee} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, width: "100%" }}>
                  {[
                    { lbl: "Burned", val: totalBurn, color: C.red },
                    { lbl: "Eaten", val: eaten, color: C.green },
                    { lbl: (energy || 0) <= 0 ? "Deficit" : "Surplus", val: Math.abs(Math.round(energy || 0)), color: (energy || 0) <= 0 ? C.green : C.red }
                  ].map(function(s) {
                    return (
                      <div key={s.lbl} style={{ textAlign: "center", background: C.surface, borderRadius: 10, padding: "10px 8px" }}>
                        <div className="bebas" style={{ fontSize: 22, color: s.color }}>{Math.round(s.val)}</div>
                        <div style={{ fontSize: 10, color: C.muted }}>{s.lbl}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 12, letterSpacing: 1 }}>HOW IT'S CALCULATED</div>
              {[
                { label: "Base burn so far (TDEE)", val: "-" + (totalBurn - stepsCal), color: C.red, note: "Body burning calories since midnight" },
                { label: "Steps burned", val: "-" + stepsCal, color: C.red, note: steps.toLocaleString() + " steps · extra movement" },
                { label: "Food eaten", val: "+" + eaten, color: C.green, note: foodLog.length + " item" + (foodLog.length !== 1 ? "s" : "") + " logged today" },
                { label: "Net balance", val: (energy || 0) >= 0 ? ("+" + Math.round(energy || 0)) : ("" + Math.round(energy || 0)), color: (energy || 0) <= 0 ? C.green : C.red, note: (energy || 0) <= 0 ? "Calorie deficit — burning fat" : "Calorie surplus — ate more than burned", bold: true },
              ].map(function(row) {
                return (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: "1px solid " + C.border }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: row.bold ? 700 : 400, color: row.bold ? C.text : C.dim }}>{row.label}</div>
                      <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{row.note}</div>
                    </div>
                    <div className="bebas" style={{ fontSize: 20, color: row.color }}>{row.val}</div>
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {tab === "log" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionTitle title="LOG" sub="Food and steps for today" />
            <Card>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontWeight: 600 }}>🍗 FOOD</div>
              <FoodSearch customFoods={customFoods} onAdd={addFood} onSave={saveFood} />
              {foodLog.length > 0 && (
                <div style={{ marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>TODAY — {eaten} kcal</div>
                  {foodLog.slice(0, 10).map(function(f) {
                    return (
                      <div key={f.id} style={{ marginTop: 8 }}>
                        {editingFood && editingFood.id === f.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input value={editingFood.name} onChange={function(e) { setEditingFood(function(p) { return Object.assign({}, p, { name: e.target.value }); }); }} style={{ flex: 2, fontSize: 12, padding: "6px 10px" }} />
                            <input type="number" value={editingFood.calories} onChange={function(e) { setEditingFood(function(p) { return Object.assign({}, p, { calories: parseInt(e.target.value) || 0 }); }); }} style={{ flex: 1, fontSize: 12, padding: "6px 10px" }} />
                            <button onClick={function() { editFood(f, editingFood.name, editingFood.calories); }} style={{ background: C.green, color: "#000", padding: "6px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>✓</button>
                            <button onClick={function() { setEditingFood(null); }} style={{ background: C.surface, border: "1px solid " + C.border, color: C.muted, padding: "6px 10px", borderRadius: 6, fontSize: 11 }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                            <div>
                              <span style={{ color: C.dim }}>{f.food_name && f.food_name.length > 18 ? f.food_name.slice(0, 18) + "…" : f.food_name}</span>
                              <span style={{ fontSize: 10, color: C.muted, marginLeft: 6 }}>{f.logged_time}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color: C.green }}>+{f.calories}</span>
                              <button onClick={function() { setEditingFood({ id: f.id, name: f.food_name, calories: f.calories }); }} style={{ background: "#0d1a14", border: "1px solid rgba(0,230,118,0.3)", color: C.green, padding: "3px 8px", borderRadius: 5, fontSize: 10 }}>✎</button>
                              <button onClick={function() { delFood(f.id, f.calories); }} style={{ background: "#2a1010", border: "1px solid rgba(255,61,0,0.3)", color: C.red, padding: "3px 7px", borderRadius: 5, fontSize: 10 }}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontWeight: 600 }}>👟 STEPS</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={stepsInput} onChange={function(e) { setStepsInput(e.target.value); }}
                  placeholder={steps > 0 ? "Current: " + steps.toLocaleString() + " steps" : "Enter total steps from your phone..."}
                  onKeyDown={function(e) { if (e.key === "Enter") saveSteps(); }} />
                <Btn label="SAVE" onClick={saveSteps} style={{ padding: "10px 14px" }} />
              </div>
              {stepsInput && (
                <div style={{ fontSize: 12, color: C.red, marginTop: 6 }}>
                  {parseInt(stepsInput) > steps
                    ? "+" + (parseInt(stepsInput) - steps) + " new steps · -" + calcStepsBurn(parseInt(stepsInput) - steps, profile.weight_lbs) + " kcal"
                    : "Total: " + parseInt(stepsInput).toLocaleString() + " steps · -" + calcStepsBurn(parseInt(stepsInput) || 0, profile.weight_lbs) + " kcal"}
                </div>
              )}
              {steps > 0 && !stepsInput && (
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Today: {steps.toLocaleString()} steps · -{stepsCal} kcal burned</div>
              )}
            </Card>
            <Card>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 10, fontWeight: 600 }}>⚖️ LOG WEIGHT</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" value={newW} onChange={function(e) { setNewW(e.target.value); }}
                  placeholder={weights.length > 0 ? "Last: " + weights[weights.length-1].weight_lbs + " lbs" : "e.g. 191.5"}
                  onKeyDown={function(e) { if (e.key === "Enter") logWeight(); }} />
                <Btn label="LOG" onClick={function() { logWeight(); }} style={{ padding: "10px 16px" }} />
              </div>
              {weights.length > 0 && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Last logged: {weights[weights.length-1].weight_lbs} lbs on {fmtDate(weights[weights.length-1].date)}</div>}
            </Card>
          </div>
        )}

        {tab === "strength" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionTitle title="STRENGTH" sub="Tap an exercise to log or view progress" />
            {exercises.map(function(ex) {
              var isSelected = selEx === ex.name;
              var data = maxPerSession(sets, ex.name);
              var todayEx = sets.filter(function(s) { return s.date === currentDate && s.exercise_name === ex.name; });
              var pr = prs[ex.name];
              return (
                <div key={ex.id} style={{ background: C.card, border: "1px solid " + (isSelected ? C.red : C.border), borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
                  <button onClick={function() { setSelEx(isSelected ? "" : ex.name); setAiSug({ loading: false, text: "" }); setShowChart(false); }}
                    style={{ width: "100%", background: "none", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", color: C.text, textAlign: "left" }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{ex.name}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                        {pr ? "🏆 PR: " + pr.weight + "lbs" : "No sets logged yet"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {data.length > 0 && <MiniSpark data={data.map(function(d) { return d.value; })} color={isSelected ? C.red : C.muted} />}
                      {todayEx.length > 0 && <div style={{ background: C.green, color: "#000", borderRadius: 10, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{todayEx.length} sets</div>}
                      <span style={{ color: C.muted, fontSize: 12 }}>{isSelected ? "▲" : "▼"}</span>
                    </div>
                  </button>
                  {isSelected && (
                    <div style={{ padding: "0 16px 16px", borderTop: "1px solid " + C.border, animation: "fadeIn 0.15s ease" }}>
                      <button onClick={getAI} style={{ background: "#0d1a14", border: "1px solid rgba(0,230,118,0.3)", color: C.green, padding: "8px 14px", borderRadius: 8, fontSize: 12, width: "100%", marginTop: 12, marginBottom: 4 }}>⚡ Get AI Recommendation</button>
                      <AIBox loading={aiSug.loading} text={aiSug.text} />
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12, marginBottom: 10 }}>
                        <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>REPS</div><input type="number" value={newSet.reps} onChange={function(e) { setNewSet(function(p) { return Object.assign({}, p, { reps: e.target.value }); }); }} placeholder="8" /></div>
                        <div><div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>WEIGHT (lbs)</div><input type="number" value={newSet.weight} onChange={function(e) { setNewSet(function(p) { return Object.assign({}, p, { weight: e.target.value }); }); }} placeholder="185" /></div>
                      </div>
                      <Btn label="LOG SET" onClick={logSet} style={{ width: "100%", padding: 10, marginBottom: todayEx.length ? 12 : 0 }} />
                      {todayEx.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>TODAY'S SETS</div>
                          {todayEx.map(function(s, i) {
                            return (
                              <div key={s.id || i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border, fontSize: 13 }}>
                                <span style={{ color: C.muted }}>Set {i + 1}</span>
                                <span>{s.reps} reps</span>
                                <span style={{ color: C.red, fontWeight: 700 }}>{s.weight_lbs} lbs</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {data.length > 0 && (
                        <button onClick={function() { setShowChart(function(p) { return !p; }); }}
                          style={{ background: "none", border: "1px solid " + C.border, color: C.muted, padding: "7px 14px", borderRadius: 8, fontSize: 11, width: "100%", marginTop: 12 }}>
                          {showChart ? "Hide Chart" : "📈 View Progress Chart"}
                        </button>
                      )}
                      {showChart && data.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          <LineChart data={data} label={ex.name} color={C.red} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                </SwipeToDelete>
              );
            })}
            {Object.keys(prs).length > 0 && (
              <Card>
                <div style={{ fontSize: 13, color: C.yellow, marginBottom: 12, fontWeight: 600 }}>🏆 PR WALL</div>
                {Object.entries(prs).map(function(entry) {
                  var ex = entry[0], pr = entry[1];
                  return (
                    <div key={ex} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + C.border }}>
                      <span style={{ fontSize: 13 }}>{ex}</span>
                      <span style={{ color: C.yellow, fontWeight: 700 }}>{pr.weight} lbs — {pr.date}</span>
                    </div>
                  );
                })}
              </Card>
            )}
            <button onClick={function() { setShowAddEx(function(p) { return !p; }); }}
              style={{ background: "none", border: "1px dashed " + C.border, color: C.muted, padding: "10px 14px", borderRadius: 12, fontSize: 12, width: "100%" }}>
              {showAddEx ? "✕ Cancel" : "+ Add Exercise / Machine"}
            </button>
            {showAddEx && (
              <Card>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12, fontWeight: 600 }}>NEW EXERCISE</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={newEx.name} onChange={function(e) { setNewEx({ name: e.target.value }); }} placeholder="e.g. Hammer Chest Press" onKeyDown={function(e) { if (e.key === "Enter") addExercise(); }} />
                  <Btn label="ADD" onClick={addExercise} style={{ padding: "10px 14px", whiteSpace: "nowrap" }} />
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "progress" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionTitle title="PROGRESS" sub="Your trends over time" />
            <ProgressTab summaries={summaries} weights={weights} tdee={tdee} />
          </div>
        )}


      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.surface, borderTop: "1px solid " + C.border, padding: "8px 16px", display: "flex", justifyContent: "space-around" }}>
        {NAV.map(function(n) {
          return (
            <button key={n.id} onClick={function() { setTab(n.id); }}
              style={{ background: "none", color: tab === n.id ? C.red : C.muted, padding: "6px 8px", borderRadius: 8, fontSize: 9, fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 16 }}>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import ReactDOM from 'react-dom/client'
ReactDOM.createRoot(document.getElementById('root')).render(<EmberApp />)
