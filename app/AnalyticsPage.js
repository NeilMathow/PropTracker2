"use client";

import { useState, useEffect, useRef } from "react";

const FC = ["#f97316","#00d97e","#60a5fa","#c084fc","#fb923c","#34d399","#f87171","#fbbf24"];
const DOW = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtD(s) {
  if (!s) return "—";
  if (s < 60) return s + "s";
  if (s < 3600) return Math.round(s / 60) + "m";
  return (s / 3600).toFixed(1) + "h";
}
function parseDur(s) {
  if (!s) return 0;
  // HH:MM:SS format
  const hms = s.match(/(\d+):(\d+):(\d+)/);
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +hms[3];
  // "1min 2sec", "4min 42sec", "46sec", "2sec" format
  const ms = s.match(/(?:(\d+)\s*min\s*)?(?:(\d+)\s*sec)?/);
  if (ms && (ms[1] || ms[2])) return (+ms[1] || 0) * 60 + (+ms[2] || 0);
  return 0;
}
function parsePnlStr(s) {
  if (!s) return NaN;
  // handles: $90.00, $(405.00), "$1,155.00", "$(1,155.00)"
  const neg = s.includes("(");
  const clean = s.replace(/[$(),]/g, "").trim();
  const n = parseFloat(clean);
  return isNaN(n) ? NaN : (neg ? -n : n);
}
function parseCSV(txt, src) {
  // handle quoted fields (e.g. "$(1,155.00)")
  function splitLine(line) {
    const result = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { result.push(cur); cur = ""; }
      else cur += ch;
    }
    result.push(cur);
    return result;
  }
  const lines = txt.trim().split(/\r?\n/);
  const hdrs = splitLine(lines[0].replace(/^\uFEFF/, "")).map(h => h.trim());
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const v = splitLine(l);
    const t = {};
    hdrs.forEach((h, i) => (t[h] = (v[i] || "").trim()));

    // Support both Tradovate format (pnl col) and other formats (PnL col)
    const pnlRaw = t.pnl || t.PnL || "";
    t._pnl = pnlRaw.includes("$") ? parsePnlStr(pnlRaw) : parseFloat(pnlRaw);

    t._fees = parseFloat(t.Fees || 0) + parseFloat(t.Commissions || 0);

    // Support both timestamp formats
    const raw = t.boughtTimestamp || t.soldTimestamp || t.EnteredAt || t.TradeDay || "";
    const m = raw.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    t._date = m ? new Date(+m[3], +m[1] - 1, +m[2]) : null;

    // Support both duration formats
    t._dur = parseDur(t.duration || t.TradeDuration || "");
    t._src = src;

    // Normalize Tradovate fields to standard field names
    if (t.symbol && !t.ContractName) t.ContractName = t.symbol;
    if (t.buyPrice && !t.EntryPrice) {
      const buy = parseFloat(t.buyPrice);
      const sell = parseFloat(t.sellPrice);
      // If sell timestamp is before buy timestamp, the sell was the entry = Short
      const buyTs = new Date(t.boughtTimestamp || 0).getTime();
      const sellTs = new Date(t.soldTimestamp || 0).getTime();
      const isShort = sellTs < buyTs;
      t.Type = isShort ? "Short" : "Long";
      t.EntryPrice = isShort ? sell : buy;
      t.ExitPrice = isShort ? buy : sell;
      t.Size = t.qty || "1";
    }

    return t;
  }).filter(t => !isNaN(t._pnl));
}
function calcMaxDD(pnls) {
  let pk = 0, dd = 0, c = 0;
  for (const p of pnls) { c += p; if (c > pk) pk = c; const d = pk - c; if (d > dd) dd = d; }
  return dd;
}

function useChartJS() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.Chart) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);
  return loaded;
}

function ChartCanvas({ type, data, options, deps = [] }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const ready = useChartJS();
  useEffect(() => {
    if (!ready || !ref.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new window.Chart(ref.current, { type, data, options });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [ready, ...deps]);
  return <canvas ref={ref} style={{ width: "100%", height: "100%" }} />;
}

function DonutChart({ data, colors, size = 96 }) {
  const ref = useRef(null);
  const chartRef = useRef(null);
  const ready = useChartJS();
  useEffect(() => {
    if (!ready || !ref.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    const hasData = data.some(v => v > 0);
    chartRef.current = new window.Chart(ref.current, {
      type: "doughnut",
      data: { datasets: [{ data: hasData ? data : [1], backgroundColor: hasData ? colors : ["rgba(255,255,255,0.06)"], borderWidth: 0 }] },
      options: { responsive: false, cutout: "70%", plugins: { legend: { display: false } }, animation: { duration: 500 } },
    });
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [ready, JSON.stringify(data)]);
  return <canvas ref={ref} width={size} height={size} />;
}

const gridColor = "rgba(255,255,255,0.04)";
const tickStyle = { color: "#555", font: { size: 10 } };
const baseOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

function Section({ title, children, style = {} }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: "16px", transition: "border-color 0.2s, box-shadow 0.2s", ...style }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      {title && (
        <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        </div>
      )}
      <div style={{ padding: "1.25rem 1.5rem" }}>{children}</div>
    </div>
  );
}

function MetricCard({ label, value, cls, sub }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "2px solid #f97316", borderRadius: "10px", padding: "1rem 1.25rem", transition: "box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "10px", fontWeight: 600 }}>{label}</div>
      <div className={`metric-value ${cls || "mv-neutral"}`} style={{ fontSize: "22px" }}>{value || "—"}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "24px 0 16px" }}>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--orange)", letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap", background: "var(--orange-dim)", border: "1px solid rgba(249,115,22,0.3)", padding: "4px 12px", borderRadius: "20px" }}>{label}</span>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
    </div>
  );
}

function WinBar({ label, pct }) {
  const c = pct >= 55 ? "var(--green)" : pct >= 45 ? "#f97316" : "var(--red)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)", width: "90px", flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ flex: 1, height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: "3px", background: c, width: pct + "%" }} />
      </div>
      <div style={{ fontSize: "12px", fontFamily: "monospace", color: "var(--text)", width: "38px", textAlign: "right" }}>{pct.toFixed(0)}%</div>
    </div>
  );
}

// ── Fake data for the blurred background ─────────────────────────────────────
const FAKE = {
  tot: 12720, wr: 67.3, pf: 2.14, dd: 1840, exp: 89, aw: 312, al: 151, fees: 284,
  wins: 19, losses: 9, be: 0, gd: 8, rd: 2,
  eqLabels: Array.from({length:28},(_,i)=>i+1),
  eqData: [0,180,420,380,610,790,720,940,1180,1050,1320,1560,1480,1710,1950,2100,2340,2180,2490,2720,2600,2890,3120,3050,3380,3640,3510,3820].map(v=>v+Math.random()*40-20),
  dailySorted: [["05-12",420],["05-13",-180],["05-14",560],["05-15",310],["05-16",-90],["05-17",890],["05-18",230],["05-19",-140],["05-20",670]],
  contractSorted: [["NQM6",2840],["MNQM6",680],["ESM6",200]],
  dow: [0, 420, 680, 390, 520, 810, 0],
};

// ── Firm logos/colors ────────────────────────────────────────────────────────
const FIRMS_LIST = [
  { key: "topstep",    label: "Topstep",             color: "#f97316", logo: "/logos/topstep.png" },
  { key: "mff",        label: "My Funded Futures",   color: "#60a5fa", logo: "/logos/mff.jpg" },
  { key: "lucid",      label: "Lucid Trading",       color: "#c084fc", logo: "/logos/lucid.png" },
  { key: "apex",       label: "Apex Trader Funding", color: "#00d97e", logo: "/logos/apex.png" },
  { key: "alpha",      label: "Alpha Futures",       color: "#34d399", logo: "/logos/alpha.png" },
  { key: "tpt",        label: "Take Profit Trader",  color: "#fb923c", logo: "/logos/tpt.png" },
  { key: "tradeify",   label: "Tradeify",            color: "#f87171", logo: "/logos/tradeify.png" },
  { key: "fundednext", label: "Funded Next",         color: "#6366f1", logo: "fn-svg" },
];

// ── Firm Button with hover ───────────────────────────────────────────────────
function FirmButton({ f, selected, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const isActive = selected === f.key;
  return (
    <button
      onClick={() => onSelect(f.key)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "13px 16px",
        background: isActive ? "rgba(249,115,22,0.1)" : hovered ? "rgba(249,115,22,0.05)" : "var(--surface2)",
        border: isActive ? "1px solid #f97316" : hovered ? "1px solid rgba(249,115,22,0.6)" : "1px solid var(--border)",
        borderRadius: "10px",
        cursor: "pointer",
        fontFamily: "inherit",
        transition: "all .15s",
        textAlign: "left",
        width: "100%",
      }}
    >
      <div style={{ width: "28px", height: "28px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
        {f.logo === "fn-svg" ? (
          <svg width="28" height="28" viewBox="-25 -25 170 170" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="-25" y="-25" width="170" height="170" fill="#000"/>
            <path d="M8 18 L8 102 L24 102 L24 68 L46 68 L46 54 L24 54 L24 32 L50 32 L50 18 Z" fill="white"/>
            <path d="M58 18 L58 102 L73 102 L73 44 L95 102 L112 102 L112 18 L97 18 L97 76 L75 18 Z" fill="white"/>
            <polygon points="97,18 112,18 112,36" fill="#6366f1"/>
          </svg>
        ) : f.logo ? <img src={f.logo} alt={f.label} style={{ width: "28px", height: "28px", objectFit: "cover", borderRadius: "6px" }} /> : <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: f.color }} />}
      </div>
      <span style={{ fontSize: "13px", fontWeight: 600, color: isActive || hovered ? "var(--text)" : "var(--muted)", transition: "color .15s" }}>{f.label}</span>
      {isActive && !hovered && <span style={{ marginLeft: "auto", color: "#f97316", fontSize: "14px", fontWeight: 800 }}>✓</span>}
    </button>
  );
}

// ── Firm Select Modal ─────────────────────────────────────────────────────────
function FirmSelectModal({ fileName, onConfirm, onCancel }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{
      position: "fixed", top: 0, left: "220px", right: 0, bottom: 0, zIndex: 100,
      background: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "240px 20px 20px",
    }}>
      <div style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        padding: "44px 52px",
        maxWidth: "520px",
        width: "100%",
        boxShadow: "0 0 80px rgba(0,0,0,0.8)",
      }}>
        <div style={{ fontSize: "9px", color: "#f97316", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, marginBottom: "8px" }}>New File Detected</div>
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.3px", marginBottom: "6px" }}>Which Firm Is This From?</h2>
        <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "24px", lineHeight: 1.6 }}>
          <span style={{ color: "rgba(249,115,22,0.8)", fontWeight: 600 }}>{fileName}</span> — Selecting The Correct Firm Lets Us Label And Group Your Data Accurately.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "24px" }}>
          {FIRMS_LIST.map(f => <FirmButton key={f.key} f={f} selected={selected} onSelect={setSelected} />)}
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "12px", background: "transparent", border: "1px solid var(--border)", borderRadius: "10px", color: "var(--muted)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={() => selected && onConfirm(selected)} disabled={!selected} className="btn-primary" style={{ flex: 2, padding: "12px", fontSize: "14px", opacity: selected ? 1 : 0.4 }}>Confirm &amp; Load</button>
        </div>
      </div>
    </div>
  );
}

function FakeBackground() {
  return (
    <div style={{ pointerEvents: "none", userSelect: "none" }}>
      {/* Stat rows */}
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
        {[["Net P&L","+$12,720","mv-pos","28 trades"],["Win Rate","67.3%","mv-pos"],["Profit Factor","2.14","mv-pos"],["Max Drawdown","-$1,840","mv-neg"],["Expectancy","$89","mv-pos","per trade"]].map(([l,v,c,s])=>(
          <div key={l} className="metric-card"><div className="metric-label">{l}</div><div className={`metric-value ${c}`} style={{fontSize:"22px"}}>{v}</div>{s&&<div className="metric-sub">{s}</div>}</div>
        ))}
      </div>
      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(5,1fr)", marginBottom: "4px" }}>
        {[["Avg Win","$312","mv-pos"],["Avg Loss","-$151","mv-neg"],["Total Fees","-$284","mv-orange"],["Net After Fees","+$12,436","mv-pos"],["W/L Ratio","2.07x","mv-neutral"]].map(([l,v,c])=>(
          <div key={l} className="metric-card"><div className="metric-label">{l}</div><div className={`metric-value ${c}`} style={{fontSize:"22px"}}>{v}</div></div>
        ))}
      </div>

      <Divider label="Performance Overview" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
        <Section title="Win % by Trades">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ position: "relative", width: "96px", height: "96px", flexShrink: 0 }}>
              <DonutChart data={[19,9,0]} colors={["#00d97e","#ef4444","#f97316"]} size={96} />
              <div style={{ position: "absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                <div style={{ fontSize:"20px", fontWeight:800, color:"#00d97e" }}>67%</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:".05em" }}>WINRATE</div>
              </div>
            </div>
            <div>
              {[["#00d97e","Winners",19],["#ef4444","Losers",9],["#f97316","Breakeven",0]].map(([c,l,v])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
                  <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:c, flexShrink:0 }} />
                  <span style={{ color:"var(--muted)", fontSize:"12px", flex:1 }}>{l}</span>
                  <span style={{ color:"var(--text)", fontFamily:"monospace", fontWeight:700, fontSize:"13px" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Win % by Days">
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div style={{ position: "relative", width: "96px", height: "96px", flexShrink: 0 }}>
              <DonutChart data={[8,2]} colors={["#00d97e","#ef4444"]} size={96} />
              <div style={{ position: "absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center" }}>
                <div style={{ fontSize:"20px", fontWeight:800, color:"#00d97e" }}>80%</div>
                <div style={{ fontSize:"9px", color:"var(--muted)", letterSpacing:".05em" }}>WINRATE</div>
              </div>
            </div>
            <div>
              {[["#00d97e","Green days",8],["#ef4444","Red days",2]].map(([c,l,v])=>(
                <div key={l} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px" }}>
                  <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:c, flexShrink:0 }} />
                  <span style={{ color:"var(--muted)", fontSize:"12px", flex:1 }}>{l}</span>
                  <span style={{ color:"var(--text)", fontFamily:"monospace", fontWeight:700, fontSize:"13px" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
        <Section title="Performance Radar">
          <div style={{ position: "relative", height: "160px", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <DonutChart data={[67,33]} colors={["#00d97e44","#ef444422"]} size={130} />
          </div>
        </Section>
      </div>

      <Divider label="P&L Analysis" />
      <Section title="Equity Curve">
        <div style={{ position:"relative", height:"180px" }}>
          <ChartCanvas type="line" deps={[]}
            data={{ labels: FAKE.eqLabels, datasets: [{ data: FAKE.eqData, borderColor:"#00d97e", borderWidth:2.5, pointRadius:0, fill:true, backgroundColor:"#00d97e18", tension:0.4 }] }}
            options={{ ...baseOpts, scales:{ x:{ display:false }, y:{ grid:{ color:gridColor }, ticks:{ ...tickStyle, callback: v=>"$"+v } } } }}
          />
        </div>
      </Section>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"16px" }}>
        <Section title="Daily P&L">
          <div style={{ position:"relative", height:"140px" }}>
            <ChartCanvas type="bar" deps={[]}
              data={{ labels: FAKE.dailySorted.map(([k])=>k), datasets:[{ data: FAKE.dailySorted.map(([,v])=>v), backgroundColor: FAKE.dailySorted.map(([,v])=>v>=0?"#00d97e":"#ef4444"), borderRadius:3 }] }}
              options={{ ...baseOpts, scales:{ x:{ ticks:{ ...tickStyle }, grid:{ display:false } }, y:{ grid:{ color:gridColor }, ticks:{ ...tickStyle, callback: v=>fmt(v) } } } }}
            />
          </div>
        </Section>
        <Section title="P&L Distribution">
          <div style={{ position:"relative", height:"140px" }}>
            <ChartCanvas type="bar" deps={[]}
              data={{ labels:["-$600","-$400","-$200","$0","$200","$400","$600","$800"], datasets:[{ data:[1,2,3,5,7,5,3,2], backgroundColor:["#ef444435","#ef444435","#ef444435","#ef444435","#00d97e35","#00d97e35","#00d97e35","#00d97e35"], borderColor:["#ef4444","#ef4444","#ef4444","#ef4444","#00d97e","#00d97e","#00d97e","#00d97e"], borderWidth:1, borderRadius:2 }] }}
              options={{ ...baseOpts, scales:{ x:{ ticks:{ ...tickStyle }, grid:{ display:false } }, y:{ grid:{ color:gridColor }, ticks:tickStyle } } }}
            />
          </div>
        </Section>
        <Section title="Avg Win vs Avg Loss">
          <div style={{ position:"relative", height:"140px" }}>
            <ChartCanvas type="bar" deps={[]}
              data={{ labels:["Avg Win","Avg Loss"], datasets:[{ data:[312,-151], backgroundColor:["#00d97e","#ef4444"], borderRadius:6 }] }}
              options={{ ...baseOpts, scales:{ x:{ ticks:{ color:"#888", font:{size:12} }, grid:{ display:false } }, y:{ grid:{ color:gridColor }, ticks:{ ...tickStyle, callback: v=>fmt(v) } } } }}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

// ── Upload Gate Modal ─────────────────────────────────────────────────────────
function UploadGate({ onFiles, dragActive, setDragActive }) {
  const inputRef = useRef(null);
  return (
    <div style={{
      position: "fixed", top: 0, left: "220px", right: 0, bottom: 0, zIndex: 10,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "240px 20px 20px",
    }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={e => { e.preventDefault(); setDragActive(false); onFiles(e.dataTransfer.files); }}
        style={{
          background: "var(--surface)",
          border: `1px solid ${dragActive ? "#f97316" : "rgba(249,115,22,0.35)"}`,
          borderRadius: "20px",
          padding: "44px 52px",
          maxWidth: "520px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 0 80px rgba(0,0,0,0.8)",
          transition: "border-color .2s",
          position: "relative",
        }}
      >
        <div style={{ fontSize: "9px", color: "#f97316", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, marginBottom: "12px" }}>
          Trade Analytics
        </div>
        <h2 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "10px", lineHeight: 1.2 }}>
          Upload Your Trades<br />To Unlock Analytics
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "32px", maxWidth: "360px", margin: "0 auto 32px" }}>
          Import your CSV files and instantly see your full performance breakdown — win rate, equity curve, AI coaching, and more.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? "#f97316" : "rgba(249,115,22,0.3)"}`,
            borderRadius: "12px",
            padding: "28px 20px",
            cursor: "pointer",
            background: dragActive ? "rgba(249,115,22,0.05)" : "rgba(255,255,255,0.02)",
            marginBottom: "20px",
            transition: "all .2s",
          }}
        >
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
            Drop Your CSV Here
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)" }}>or click to browse files</div>
        </div>

        <button
          className="btn-primary"
          onClick={() => inputRef.current?.click()}
          style={{ width: "100%", padding: "14px", fontSize: "15px", letterSpacing: "0.02em" }}
        >
          Browse Files
        </button>

        <div style={{ fontSize: "11px", color: "var(--muted2)", marginTop: "16px" }}>
        </div>

        <input ref={inputRef} type="file" accept=".csv" multiple style={{ display: "none" }} onChange={e => onFiles(e.target.files)} />
      </div>
    </div>
  );
}

// ── AI Insights ───────────────────────────────────────────────────────────────
function generateInsights(s) {
  const sections = [];
  const wlRatio = s.al > 0 ? s.aw / s.al : 0;
  const dayWR = (s.gd / (s.gd + s.rd || 1)) * 100;
  const feeImpact = s.tot !== 0 ? (s.fees / Math.abs(s.tot)) * 100 : 0;

  // ── Strengths ──────────────────────────────────────────────────────────────
  const strengths = [];
  if (s.wr >= 60) strengths.push(`Strong win rate of ${s.wr.toFixed(1)}% — you are right on direction more often than not. This is a real edge.`);
  else if (s.wr >= 50) strengths.push(`Win rate of ${s.wr.toFixed(1)}% is above breakeven. Marginal edge that needs protecting.`);
  if (s.pf >= 2) strengths.push(`Profit factor of ${s.pf.toFixed(2)} is excellent — your winners are significantly outpacing your losers in dollar terms.`);
  else if (s.pf >= 1.5) strengths.push(`Profit factor of ${s.pf.toFixed(2)} is solid. Your winners are meaningfully larger than your losers on aggregate.`);
  if (wlRatio >= 1.5) strengths.push(`Avg win ($${s.aw.toFixed(0)}) is ${wlRatio.toFixed(2)}x your avg loss ($${s.al.toFixed(0)}). You are letting winners run and cutting losers — textbook risk management.`);
  if (dayWR >= 70) strengths.push(`${dayWR.toFixed(0)}% of your trading days are green. You recover well and avoid turning bad trades into bad days.`);
  if (s.exp > 50) strengths.push(`Positive expectancy of $${s.exp.toFixed(0)} per trade means every trade you take has a positive expected value. Stay consistent.`);
  if (s.lng > 0 && s.sht > 0) {
    const lngPct = (s.lng / s.n * 100).toFixed(0);
    if (lngPct >= 40 && lngPct <= 60) strengths.push(`Balanced directional approach — ${lngPct}% long, ${(100 - lngPct)}% short. You are not biased to one direction.`);
  }
  if (strengths.length === 0) strengths.push(`You are actively trading and collecting data — that alone puts you ahead of most. Focus on execution consistency.`);
  sections.push({ emoji: "✅", title: "STRENGTHS", color: "#00d97e", items: strengths.slice(0, 3) });

  // ── Weaknesses ─────────────────────────────────────────────────────────────
  const weaknesses = [];
  if (s.wr < 45) weaknesses.push(`Win rate of ${s.wr.toFixed(1)}% is below 45% — you are losing on more than half your trades. Revisit your entry criteria and wait for higher-conviction setups.`);
  if (wlRatio < 1 && s.wr < 60) weaknesses.push(`Avg loss ($${s.al.toFixed(0)}) is larger than avg win ($${s.aw.toFixed(0)}). With a ${s.wr.toFixed(1)}% win rate this is a losing combination long-term.`);
  if (s.pf < 1.2 && s.pf > 0) weaknesses.push(`Profit factor of ${s.pf.toFixed(2)} is dangerously close to breakeven. After fees you may be net negative. Raise your standards for trade entries.`);
  if (s.dd > Math.abs(s.tot) * 0.5 && s.tot > 0) weaknesses.push(`Max drawdown of $${s.dd.toFixed(0)} is ${((s.dd / Math.abs(s.tot)) * 100).toFixed(0)}% of your gross profit. You are giving back too much before recovering.`);
  else if (s.dd > 2000) weaknesses.push(`Max drawdown of $${s.dd.toFixed(0)} is significant. Define a daily loss limit and stick to it to protect your account.`);
  if (feeImpact > 15) weaknesses.push(`Fees ($${s.fees.toFixed(0)}) represent ${feeImpact.toFixed(1)}% of your gross P&L — you are overtrading. Be more selective and reduce trade frequency.`);
  if (s.rd >= s.gd && s.gd > 0) weaknesses.push(`${s.rd} red days vs ${s.gd} green days. You are not managing losing days — cut your size or stop trading once you hit a daily loss threshold.`);
  if (s.n > 100 && s.exp < 20) weaknesses.push(`With ${s.n} trades your expectancy is only $${s.exp.toFixed(0)} per trade. High volume with low edge is a sign of overtrading — quality over quantity.`);
  if (weaknesses.length === 0) weaknesses.push(`No critical weaknesses detected in the data. Focus on consistency and scaling what is working.`);
  sections.push({ emoji: "⚠️", title: "⚠️ WEAKNESSES", color: "#f97316", items: weaknesses.slice(0, 3) });

  // ── Key Actions ────────────────────────────────────────────────────────────
  const actions = [];
  if (s.wr < 50) actions.push(`Review your last 20 losing trades. Identify if there is a pattern — same time of day, same setup, same direction. Cut that pattern.`);
  if (wlRatio < 1) actions.push(`Set a hard rule: never exit a winner before it hits 1.5x your stop distance. Your avg loss is bigger than your avg win — this must change.`);
  if (feeImpact > 10) actions.push(`Cut your trade count by 30% this week. Only take A+ setups. Track whether your P&L improves — it almost certainly will.`);
  if (s.rd > 2) actions.push(`Implement a daily stop loss of $${(s.al * 2).toFixed(0)}. When you hit it, close the platform. Revenge trading after red days is destroying your equity curve.`);
  if (s.pf < 1.5) actions.push(`Paper trade for one week focusing only on entries where your target is at least 2x your stop. Do not take trades that do not meet this ratio.`);
  if (s.exp > 0 && s.tot > 0) actions.push(`You have a working strategy — now focus on execution consistency. Journal every trade with a screenshot and grade your entry quality A/B/C.`);
  actions.push(`Review your ${s.gd} green days in detail. Find the common setup, time, and conditions. Replicate those conditions and avoid trading outside them.`);
  sections.push({ emoji: "🎯", title: "🎯 KEY ACTIONS", color: "#60a5fa", items: actions.slice(0, 3) });

  // ── Mindset ────────────────────────────────────────────────────────────────
  let mindset = "";
  if (s.wr >= 60 && wlRatio < 1) mindset = `You have a psychological bias toward taking profits too early and letting losses run. Your high win rate masks the real problem — you celebrate being right instead of being profitable. Train yourself to sit in winners longer.`;
  else if (s.wr < 45 && wlRatio >= 1.5) mindset = `Your risk management is actually good — you cut losses and let winners run. The problem is entry quality. You are taking too many low-probability setups. Slow down, be more patient, and wait for the trade to come to you.`;
  else if (s.rd > s.gd) mindset = `The frequency of red days suggests emotional trading after losses. You likely increase size or frequency after a loss trying to recover. This compounds drawdowns. Accept that some days are not for trading and walk away early.`;
  else if (s.pf >= 1.5 && s.wr >= 55) mindset = `Your data shows a solid, disciplined trader. The risk now is complacency — do not start taking lower-quality setups because you feel confident. Your edge is real but fragile. Protect it.`;
  else mindset = `Your stats suggest inconsistency in execution — some days you trade your system, others you do not. Build a pre-trade checklist and only enter trades that check every box. Consistency in process leads to consistency in results.`;
  sections.push({ emoji: "💡", title: "💡 MINDSET NOTE", color: "#c084fc", items: [mindset] });

  // ── Overall ────────────────────────────────────────────────────────────────
  let verdict = "";
  if (s.pf >= 1.5 && s.wr >= 55 && s.exp > 50) verdict = `Strong performance — ${s.pf.toFixed(2)} profit factor and ${s.wr.toFixed(1)}% win rate with positive expectancy puts you in the top tier. Focus on scaling size gradually.`;
  else if (s.pf >= 1.2 && s.wr >= 48) verdict = `Developing trader with a real but fragile edge — ${s.pf.toFixed(2)} profit factor is profitable but not yet robust enough to scale. Work on trade selection quality before increasing size.`;
  else if (s.tot > 0 && s.pf < 1.2) verdict = `Barely profitable — fees and poor risk/reward are eating your gains. You need to either raise your win rate above 55% or get your avg win above 1.5x your avg loss before this is a viable strategy.`;
  else verdict = `Currently unprofitable with a ${s.pf.toFixed(2)} profit factor — do not increase size. Go back to basics: define your exact setup, max loss per trade, and daily stop. Paper trade until your win rate exceeds 50% consistently.`;
  sections.push({ emoji: "📊", title: "📊 OVERALL ASSESSMENT", color: "#fbbf24", items: [verdict], wide: true });

  return sections;
}

function ScoreBar({ label, value, max = 100, color }) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span style={{ fontSize: "11px", color: "var(--muted)" }}>{label}</span>
        <span style={{ fontSize: "11px", fontWeight: 700, color, fontFamily: "monospace" }}>{value.toFixed(1)}{max === 100 ? "%" : "x"}</span>
      </div>
      <div style={{ height: "5px", background: "rgba(255,255,255,0.06)", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: pct + "%", background: color, borderRadius: "3px", transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

function StatRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span style={{ fontSize: "12px", color: "var(--muted)" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: 700, color: color || "var(--text)", fontFamily: "monospace" }}>{value}</span>
    </div>
  );
}

function RatingDot({ filled, color }) {
  return <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: filled ? color : "rgba(255,255,255,0.08)", flexShrink: 0 }} />;
}

function RatingRow({ label, rating, max = 5, color, tip }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ fontSize: "12px", color: "var(--muted)", width: "110px", flexShrink: 0 }}>{label}</div>
      <div style={{ display: "flex", gap: "4px", flex: 1 }}>
        {Array.from({ length: max }).map((_, i) => <RatingDot key={i} filled={i < rating} color={color} />)}
      </div>
      <div style={{ fontSize: "11px", color, fontWeight: 700, width: "90px", textAlign: "right" }}>{tip}</div>
    </div>
  );
}

function CoachingInsights({ stats: s }) {
  if (!s || s.n === 0) return (
    <div className="section" style={{ marginBottom: "12px" }}>
      <div style={{ cursor: "default", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Insights</span>
      </div>
      <div style={{ padding: "1.25rem", color: "var(--muted)", fontSize: "13px" }}>Upload a CSV to generate your personalized coaching report.</div>
    </div>
  );

  const wlRatio = s.al > 0 ? s.aw / s.al : 0;
  const dayWR = (s.gd / (s.gd + s.rd || 1)) * 100;
  const feeImpact = s.tot !== 0 ? (s.fees / Math.abs(s.tot)) * 100 : 0;

  // Scores calibrated so: 69.5% WR, 3.0 PF, 1.3 W/L, 100% dayWR, $51 exp → ~85
  const wrScore  = Math.min(Math.max((s.wr - 40) / (70 - 40) * 100, 0), 100);
  const pfScore  = Math.min(Math.max((s.pf - 1) / (3 - 1) * 100, 0), 100);
  const wlScore  = Math.min(Math.max((wlRatio - 0.5) / (2.5 - 0.5) * 100, 0), 100);
  const dayScore = Math.min(Math.max((dayWR - 30) / (80 - 30) * 100, 0), 100);
  const expScore = Math.min(Math.max(s.exp / 150 * 100, 0), 100);
  const overallScore = Math.min(Math.round((wrScore*0.25 + pfScore*0.25 + wlScore*0.2 + dayScore*0.15 + expScore*0.15) * 1.1), 99);
  const scoreColor = overallScore >= 60 ? "#00d97e" : overallScore >= 38 ? "#f97316" : "#ef4444";
  const scoreLabel = overallScore >= 60 ? "Strong Trader" : overallScore >= 38 ? "Developing" : "Keep Grinding";

  // 5-dot ratings
  const toRating = (score) => Math.max(1, Math.round((score / 100) * 5));
  const wrRating  = toRating(wrScore);
  const pfRating  = toRating(pfScore);
  const wlRating  = toRating(wlScore);
  const dayRating = toRating(dayScore);

  const rc = (r) => r >= 4 ? "#00d97e" : r >= 3 ? "#f97316" : "#ef4444";
  const tip = (r, good, med, bad) => r >= 4 ? good : r >= 3 ? med : bad;

  // Strengths — top items
  const strengths = [];
  if (s.wr >= 55) strengths.push({ label: "Win Rate", desc: `${s.wr.toFixed(1)}% is a genuine directional edge. Stay selective — only take setups that fully match your criteria and don't let overtrading erode what you've built.` });
  if (s.pf >= 1.5) strengths.push({ label: "Profit Factor", desc: `${s.pf.toFixed(2)} means your winners are significantly outpacing your losers. Keep it above 1.5 by cutting losers quickly and letting winners breathe.` });
  if (wlRatio >= 1.3) strengths.push({ label: "Risk/Reward Ratio", desc: `Avg win ($${s.aw.toFixed(0)}) is ${wlRatio.toFixed(2)}x your avg loss ($${s.al.toFixed(0)}) — textbook trade management. Review any trade where you exited early to see what you left on the table.` });
  if (dayWR >= 65) strengths.push({ label: "Day Discipline", desc: `${dayWR.toFixed(0)}% green days means you're not letting bad trades snowball into bad sessions. Keep a hard daily stop to protect this consistency.` });
  if (s.exp > 40) strengths.push({ label: "Positive Expectancy", desc: `$${s.exp.toFixed(0)} per trade means every qualified setup is mathematically in your favor. Focus on execution consistency and let the edge do the work.` });
  if (s.n > 30 && s.wr >= 50 && s.pf >= 1.2) strengths.push({ label: "Proven Sample Size", desc: `${s.n} trades is a meaningful sample — your results aren't luck. Same setups, same risk, same execution every session is the job now.` });
  if (s.gd > s.rd * 2) strengths.push({ label: "Green Day Dominance", desc: `${s.gd} green days vs ${s.rd} red — winning at the session level is what separates funded traders. Keep your daily loss limit tight so one bad day never wipes a week.` });
  if (strengths.length === 0) strengths.push({ label: "Building Your Record", desc: `You're in the data-collection phase. Focus on consistency of process over results — trade the same setups, same size, same rules until patterns emerge.` });

  // Always-on suggestions to guarantee at least 4 strengths
  const alwaysOnStrengths = [
    { label: "Tracking Your Data", desc: `Most traders fly blind — you're not. Analyzing your performance puts you ahead of the majority. You can't fix what you can't see.` },
    { label: "Showing Up Consistently", desc: `Traders who review their data and execute the same process day after day are the ones who compound gains. You're doing the work — that matters.` },
    { label: "Risk Awareness", desc: `Monitoring your stats means you understand that risk management is the real game. Keep sizing appropriately and protect your downside first.` },
    { label: "Process Over Outcome", desc: `Focusing on stats instead of just P&L shows maturity as a trader. The traders who last are the ones who trust their process and let results follow.` },
  ];
  let si = 0;
  while (strengths.length < 4 && si < alwaysOnStrengths.length) {
    if (!strengths.find(s => s.label === alwaysOnStrengths[si].label)) strengths.push(alwaysOnStrengths[si]);
    si++;
  }
  // Hard cap at 4
  strengths.splice(4);

  // Focus areas — data-driven, with firm recommendations when multiple firms exist
  const firmKeys2 = s.firmStats ? Object.keys(s.firmStats) : [];
  const multiFirm = firmKeys2.length > 1;
  const bestWRFirm = multiFirm ? firmKeys2.reduce((a, b) => s.firmStats[a].wr >= s.firmStats[b].wr ? a : b) : null;
  const bestPFFirm = multiFirm ? firmKeys2.reduce((a, b) => s.firmStats[a].pf >= s.firmStats[b].pf ? a : b) : null;
  const bestWLFirm = multiFirm ? firmKeys2.reduce((a, b) => s.firmStats[a].wl >= s.firmStats[b].wl ? a : b) : null;
  const bestPnLFirm = multiFirm ? firmKeys2.reduce((a, b) => s.firmStats[a].pnl >= s.firmStats[b].pnl ? a : b) : null;

  const focusAreas = [];
  if (wlRatio < 1.2) focusAreas.push({ label: "Let Winners Run", desc: `Avg win is only ${wlRatio.toFixed(2)}x avg loss — target 1.5x minimum by widening targets or cutting exits early${bestWLFirm ? `. Your best W/L ratio is on ${bestWLFirm} (${s.firmStats[bestWLFirm].wl.toFixed(2)}x) — study what you do differently there` : ""}` });
  if (s.wr < 50) focusAreas.push({ label: "Entry Quality", desc: `Win rate ${s.wr.toFixed(1)}% — review your last 20 losers for a pattern and only take A+ setups${bestWRFirm ? `. You win most on ${bestWRFirm} (${s.firmStats[bestWRFirm].wr.toFixed(1)}%) — focus your energy there` : ""}` });
  if (feeImpact > 10) focusAreas.push({ label: "Reduce Overtrading", desc: `Fees are eating ${feeImpact.toFixed(1)}% of gross P&L — cut trade count by 30% and only take high-conviction entries${bestPnLFirm ? `. Prioritize ${bestPnLFirm} where your net P&L is strongest` : ""}` });
  if (dayWR < 60) focusAreas.push({ label: "Daily Risk Control", desc: `${s.rd} red day${s.rd !== 1 ? "s" : ""} hurting your equity curve — set a hard daily stop loss and walk away when hit${bestPnLFirm ? `. Your most consistent results come from ${bestPnLFirm}` : ""}` });
  if (s.pf < 1.3 && s.pf > 0) focusAreas.push({ label: "Profit Factor", desc: `${s.pf.toFixed(2)} is dangerously close to breakeven after fees — raise your target-to-stop ratio on every trade${bestPFFirm ? `. Best profit factor is on ${bestPFFirm} (${s.firmStats[bestPFFirm].pf > 99 ? "∞" : s.firmStats[bestPFFirm].pf.toFixed(2)}) — model your other accounts after that approach` : ""}` });
  if (s.dd > Math.abs(s.tot) * 0.4 && s.tot > 0) focusAreas.push({ label: "Max Drawdown", desc: `Drawdown of $${s.dd.toFixed(0)} is ${((s.dd / Math.abs(s.tot)) * 100).toFixed(0)}% of gross profit — define a max daily loss and honor it${bestPnLFirm ? `. Protect your gains on ${bestPnLFirm} especially` : ""}` });
  if (s.exp < 20 && s.n > 30) focusAreas.push({ label: "Low Expectancy", desc: `Only $${s.exp.toFixed(0)} per trade over ${s.n} trades — quality over quantity, fewer but better setups${bestPFFirm ? `. Concentrate on ${bestPFFirm} where your edge is clearest` : ""}` });
  if (s.wr >= 50 && wlRatio < 1.0) focusAreas.push({ label: "Protect Your Winners", desc: `You win ${s.wr.toFixed(1)}% of the time but your avg win ($${s.aw.toFixed(0)}) is smaller than your avg loss ($${s.al.toFixed(0)}) — one bad trade is erasing multiple winners. Add a rule: never let a winner turn into a loss over a certain threshold.` });
  if (s.n > 20 && s.fees > 0 && (s.fees / s.n) > 15) focusAreas.push({ label: "Fee Per Trade Too High", desc: `You're paying ~$${(s.fees / s.n).toFixed(0)} in fees per trade — consider trading fewer but larger conviction setups, or review your commission structure. At ${s.n} trades that's $${s.fees.toFixed(0)} gone before you count P&L.` });
  if (s.n > 50 && dayWR > 60 && wlRatio < 1.1) focusAreas.push({ label: "Size Up on Your Best Days", desc: `You're winning ${dayWR.toFixed(0)}% of days but your W/L ratio is holding back your total P&L. On your green days, consider adding one extra contract on your highest-conviction setup to amplify returns without taking more risk days.` });
  if (s.rd > 5 && s.tot > 0) focusAreas.push({ label: "Revenge Trading Pattern", desc: `${s.rd} red days detected — traders with this pattern often overtrade after losses. After any losing trade, wait 15 minutes before re-entering. Log your emotional state before each trade for one week and look for the pattern.` });
  if (s.pf >= 1.3 && s.pf < 1.6 && s.n > 40) focusAreas.push({ label: "Marginal Profit Factor", desc: `A profit factor of ${s.pf.toFixed(2)} works until it doesn't — one bad week can flip you negative. Raise your minimum R:R requirement to 1.5:1 on every trade to build a larger buffer between you and breakeven.` });
  if (s.n > 30 && s.aw > 0 && s.al > 0 && (s.al / s.aw) > 0.6) focusAreas.push({ label: "Tighten Your Stop Losses", desc: `Your avg loss ($${s.al.toFixed(0)}) is ${((s.al / s.aw) * 100).toFixed(0)}% of your avg win — stops may be too wide or you're holding losers too long. Define your max loss before entering and stick to it. Smaller losses make your edge compound faster.` });
  if (s.n > 20 && s.gd < s.rd * 1.5) focusAreas.push({ label: "Inconsistent Day Results", desc: `Only ${s.gd} green days vs ${s.rd} red days — your trading frequency may be too high on bad days. Implement a 2-loss daily stop rule: after 2 losing trades in a day, close the platform and come back tomorrow fresh.` });
  if (s.exp > 0 && s.exp < 50 && s.n > 40) focusAreas.push({ label: "Scale Your Edge", desc: `Your expectancy of $${s.exp.toFixed(0)} per trade is positive but thin — even a small improvement in execution (better entries, wider targets) could double your per-trade value. Focus on adding 10% to your avg winner before increasing trade frequency.` });
  if (s.tot > 0 && s.dd > 500) focusAreas.push({ label: "Drawdown Management", desc: `A max drawdown of $${s.dd.toFixed(0)} is significant relative to your gains. Define a weekly drawdown limit — if you hit it, step down to sim for the rest of the week. Protecting capital during rough patches is what keeps you in the game long-term.` });
  if (multiFirm && bestPnLFirm) focusAreas.push({ label: "Concentrate Your Capital", desc: `You're trading across multiple firms but ${bestPnLFirm} is your strongest performer. Consider reducing activity on underperforming accounts and redirecting that mental energy and capital to where your edge is proven.` });
  if (s.n > 60 && s.wr > 55 && s.pf < 1.5) focusAreas.push({ label: "High Frequency, Thin Edge", desc: `${s.n} trades with a ${s.wr.toFixed(1)}% win rate sounds good — but your profit factor of ${s.pf.toFixed(2)} means you're working hard for thin margins. Try cutting your trade count by 20% and only taking the clearest setups. Less noise, more signal.` });
  if (focusAreas.length === 0) focusAreas.push({ label: "Maintain Consistency", desc: `No critical weaknesses detected — journal every trade and protect your edge as you scale size${bestPnLFirm && multiFirm ? `. Consider allocating more capital to ${bestPnLFirm} where your P&L is strongest` : ""}` });

  // Always-on suggestions to guarantee at least 3 focus areas
  const alwaysOn = [
    { label: "Journal Every Trade", desc: `Write down your reason for entering before you click the button — not after. Traders who journal consistently improve their win rate by identifying repeated mistakes that only become visible in writing over weeks, not days.` },
    { label: "Pre-Trade Checklist", desc: `Before every entry, ask: Does this match my setup criteria? Is my stop defined? What's my target? If you can't answer all three in under 10 seconds, don't take the trade. Discipline at the entry is where edge is built or lost.` },
    { label: "Review Your Losers Weekly", desc: `Set aside 20 minutes every Sunday to review only your losing trades from the past week. Look for one pattern — same time of day, same setup, same emotional state. One insight from this routine is worth more than any indicator.` },
    { label: "Define Your Best Setup", desc: `Out of all your trade types, identify the single setup with the highest win rate and best R:R. Write it down in one sentence. Only take that setup for one full week and nothing else. Specialization compounds faster than diversification in trading.` },
    { label: "Track Your Emotional State", desc: `Before each session, rate your focus and emotional state 1–10. After 30 sessions, correlate that score with your P&L. Most traders discover they should only trade above a 7 — that insight alone can eliminate your worst days.` },
    { label: "Set a Weekly Trade Limit", desc: `Capping your weekly trade count forces you to be selective. If your limit is 15 trades, you'll naturally skip marginal setups and wait for A+ entries. Scarcity creates discipline that no amount of rules can manufacture.` },
  ];
  let i = 0;
  while (focusAreas.length < 3 && i < alwaysOn.length) {
    if (!focusAreas.find(f => f.label === alwaysOn[i].label)) focusAreas.push(alwaysOn[i]);
    i++;
  }
  // Hard cap at 3
  focusAreas.splice(3);

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", overflow: "hidden", marginBottom: "12px", transition: "border-color 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Insights</span>
      </div>
      <div style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* ── Row 1: Score + Ratings side by side ── */}
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderBottom: "2px solid #f97316", borderRadius: "12px", padding: "18px", display: "flex", alignItems: "center", gap: "32px" }}>
          {/* Score circle */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
              <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 32}`}
                strokeDashoffset={`${2 * Math.PI * 32 * (1 - overallScore / 100)}`}
                strokeLinecap="round" transform="rotate(-90 40 40)"
              />
              <text x="40" y="37" textAnchor="middle" fill={scoreColor} fontSize="17" fontWeight="800" fontFamily="monospace">{overallScore}</text>
              <text x="40" y="51" textAnchor="middle" fill="#444" fontSize="9" fontFamily="sans-serif">/100</text>
            </svg>
            <div style={{ fontSize: "11px", fontWeight: 700, color: scoreColor, marginTop: "6px" }}>{scoreLabel}</div>
          </div>
          {/* Divider */}
          <div style={{ width: "1px", height: "80px", background: "var(--border)", flexShrink: 0 }} />
          {/* Ratings grid */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px" }}>
            <RatingRow label="Win Rate" rating={wrRating} color={rc(wrRating)} tip={tip(wrRating,"Excellent","Good","Improve")} />
            <RatingRow label="Profit Factor" rating={pfRating} color={rc(pfRating)} tip={tip(pfRating,"Excellent","Good","Improve")} />
            <RatingRow label="Risk/Reward" rating={wlRating} color={rc(wlRating)} tip={tip(wlRating,"Excellent","Good","Work On")} />
            <RatingRow label="Day Discipline" rating={dayRating} color={rc(dayRating)} tip={tip(dayRating,"Consistent","Improving","Build On")} />
          </div>
        </div>

        {/* ── Row 2: Strengths + Focus Areas ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>

          {/* Strengths */}
          <div style={{ background: "var(--surface2)", border: "1px solid rgba(0,217,126,0.2)", borderLeft: "3px solid #00d97e", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#00d97e", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "14px" }}>STRENGTHS</div>
            {strengths.slice(0, 4).map((item, i) => (
              <div key={i} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: i < Math.min(strengths.length, 4) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#00d97e", marginBottom: "4px" }}>{item.label}</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* Focus Areas */}
          <div style={{ background: "var(--surface2)", border: "1px solid rgba(239,68,68,0.2)", borderLeft: "3px solid #ef4444", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: "14px" }}>FOCUS AREAS</div>
            {focusAreas.slice(0, 3).map((item, i) => (
              <div key={i} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: i < Math.min(focusAreas.length, 3) - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#ef4444", marginBottom: "4px" }}>{item.label}</div>
                <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard (real data) ────────────────────────────────────────────────
const GC = "rgba(255,255,255,0.04)";
const TX = { color: "#555", font: { size: 10 } };
const BO = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } };

function fmtDur(s) {
  if (!s) return "—";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m} min ${sec} sec`;
  return `${sec} sec`;
}

// ── Compact stat card (orange glow, like .metric-card) ──────────────────────
function StatCard({ label, value, cls, right }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "2px solid #f97316", borderRadius: "10px", padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "box-shadow 0.2s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.1)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      <div>
        <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "8px", fontWeight: 600 }}>{label}</div>
        <div className={`metric-value ${cls || "mv-neutral"}`} style={{ fontSize: "22px" }}>{value}</div>
      </div>
      {right}
    </div>
  );
}

// ── Info card (same .section style, compact padding) ────────────────────────
function InfoCard({ label, value, cls, right }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "border-color 0.2s, box-shadow 0.2s", minHeight: "72px" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.4)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.1)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div>
        <div style={{ fontSize: "10px", color: "var(--muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "6px", fontWeight: 600 }}>{label}</div>
        <div className={`metric-value ${cls || "mv-neutral"}`} style={{ fontSize: "20px", letterSpacing: "-0.5px" }}>{value}</div>
      </div>
      {right && <div style={{ flexShrink: 0, marginLeft: "12px" }}>{right}</div>}
    </div>
  );
}

// ── Chart panel ──────────────────────────────────────────────────────────────
function ChartPanel({ title, height = 200, children }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", marginBottom: 0, transition: "border-color 0.2s, box-shadow 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.08)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
      </div>
      <div style={{ padding: "1rem 1.25rem 1.25rem" }}>
        <div style={{ position: "relative", height }}>{children}</div>
      </div>
    </div>
  );
}

// ── Section divider ──────────────────────────────────────────────────────────
function Div({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0 12px" }}>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--orange)", letterSpacing: ".1em", textTransform: "uppercase", whiteSpace: "nowrap", background: "var(--orange-dim)", border: "1px solid rgba(249,115,22,0.3)", padding: "4px 12px", borderRadius: "20px" }}>{label}</span>
      <div style={{ flex: 1, height: "1px", background: "var(--border)" }} />
    </div>
  );
}

function Dashboard({ allTrades, onReset }) {
  const [tradeTab, setTradeTab] = useState("top");

  const pnls = allTrades.map(t => t._pnl);
  const win = allTrades.filter(t => t._pnl > 0);
  const los = allTrades.filter(t => t._pnl < 0);
  const tot = pnls.reduce((a, b) => a + b, 0);
  const wr = win.length / allTrades.length * 100;
  const aw = win.length ? win.reduce((a, t) => a + t._pnl, 0) / win.length : 0;
  const al = los.length ? Math.abs(los.reduce((a, t) => a + t._pnl, 0) / los.length) : 0;
  const gw = win.reduce((a, t) => a + t._pnl, 0);
  const gl = Math.abs(los.reduce((a, t) => a + t._pnl, 0));
  const pf = gl > 0 ? gw / gl : 999;
  const exp = (wr / 100 * aw) - ((1 - wr / 100) * al);
  const fees = allTrades.reduce((a, t) => a + t._fees, 0);
  const dd = calcMaxDD(pnls);
  const lng = allTrades.filter(t => t.Type === "Long");
  const sht = allTrades.filter(t => t.Type === "Short");

  const byDay = {};
  allTrades.forEach(t => {
    if (!t._date) return;
    const k = t._date.toISOString().slice(0, 10);
    if (!byDay[k]) byDay[k] = { pnl: 0 };
    byDay[k].pnl += t._pnl;
  });
  const dayEntries = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const dayVals = dayEntries.map(([, v]) => v.pnl);
  const gd = dayVals.filter(v => v > 0).length, rd = dayVals.filter(v => v <= 0).length;
  const dayWR = dayVals.length ? gd / dayVals.length * 100 : 0;

  const bestDayPnl = dayVals.length ? Math.max(...dayVals) : 0;
  const bestDayPct = tot > 0 ? bestDayPnl / tot * 100 : 0;

  const dowStats = {};
  allTrades.forEach(t => {
    if (!t._date) return;
    const d = DOW[t._date.getDay()];
    if (!dowStats[d]) dowStats[d] = { pnl: 0, count: 0 };
    dowStats[d].pnl += t._pnl; dowStats[d].count++;
  });
  const dowEntries = Object.entries(dowStats);
  const mostActive = dowEntries.length ? dowEntries.reduce((a, b) => b[1].count > a[1].count ? b : a) : null;
  const mostProfit = dowEntries.length ? dowEntries.reduce((a, b) => b[1].pnl > a[1].pnl ? b : a) : null;
  const leastProfit = dowEntries.length ? dowEntries.reduce((a, b) => b[1].pnl < a[1].pnl ? b : a) : null;

  const avgDur = allTrades.length ? allTrades.reduce((a, t) => a + t._dur, 0) / allTrades.length : 0;
  const avgWinDur = win.length ? win.reduce((a, t) => a + t._dur, 0) / win.length : 0;
  const avgLosDur = los.length ? los.reduce((a, t) => a + t._dur, 0) / los.length : 0;

  const sortedByPnl = [...allTrades].sort((a, b) => b._pnl - a._pnl);
  const bestTrade = sortedByPnl[0], worstTrade = sortedByPnl[sortedByPnl.length - 1];

  let cumSum = 0;
  const cumLabels = [], cumData = [];
  dayEntries.forEach(([k, v]) => { cumSum += v.pnl; cumLabels.push(k.slice(5)); cumData.push(+cumSum.toFixed(2)); });
  const eqColor = cumData[cumData.length - 1] >= 0 ? "#00d97e" : "#ef4444";

  const durBuckets = [
    { label: "< 15 sec", min: 0, max: 15 }, { label: "15-45 sec", min: 15, max: 45 },
    { label: "45s - 1m", min: 45, max: 60 }, { label: "1-2 min", min: 60, max: 120 },
    { label: "2-5 min", min: 120, max: 300 }, { label: "5-10 min", min: 300, max: 600 },
    { label: "10-30 min", min: 600, max: 1800 }, { label: "30m - 1h", min: 1800, max: 3600 },
    { label: "1-2 hrs", min: 3600, max: 7200 }, { label: "2-4 hrs", min: 7200, max: 14400 },
  ];
  const durCounts = durBuckets.map(b => allTrades.filter(t => t._dur >= b.min && t._dur < b.max).length);
  const durWinRates = durBuckets.map(b => {
    const bkt = allTrades.filter(t => t._dur >= b.min && t._dur < b.max);
    return bkt.length ? bkt.filter(t => t._pnl > 0).length / bkt.length * 100 : 0;
  });

  const firms = {};
  allTrades.forEach(t => {
    if (!firms[t._src]) firms[t._src] = { pnl: 0, count: 0, wins: 0 };
    firms[t._src].pnl += t._pnl; firms[t._src].count++; if (t._pnl > 0) firms[t._src].wins++;
  });
  const firmKeys = Object.keys(firms);
  const ORANGE_SHADES = ["#ef4444","#f25c38","#f4722c","#f47f22","#f97316","#fb8f2a","#fba94a","#fbbf6a"];
  const firmColors = firmKeys.map((_, i) => ORANGE_SHADES[i % ORANGE_SHADES.length]);

  const dowPnl = new Array(7).fill(0);
  allTrades.forEach(t => { if (t._date) dowPnl[t._date.getDay()] += t._pnl; });

  const rn = (v, a, b) => Math.max(0, Math.min(100, (v - a) / (b - a) * 100));
  const radarScores = [
    rn(wr, 30, 100),                         // Win %: 30–100% → 0–100 (below 30% = 0)
    rn(Math.min(pf, 4), 0.5, 4),             // Profit Factor: 0.5–4 → 0–100
    rn(exp, -200, 400),                      // Expectancy: -$200–$400 → 0–100
    al > 0 ? rn(aw / al, 0, 2) : 50,        // Avg W/L ratio: 0–2x → 0–100
    rn(dayWR, 30, 100),                      // Consistency: day win rate 30–100% → 0–100
  ];
  // Build per-firm stats for firm recommendations
  const firmStats = {};
  Object.entries(firms).forEach(([k, v]) => {
    const firmTrades = allTrades.filter(t => t._src === k);
    const firmWins = firmTrades.filter(t => t._pnl > 0);
    const firmLos = firmTrades.filter(t => t._pnl < 0);
    const firmAW = firmWins.length ? firmWins.reduce((a,t) => a+t._pnl,0)/firmWins.length : 0;
    const firmAL = firmLos.length ? Math.abs(firmLos.reduce((a,t) => a+t._pnl,0)/firmLos.length) : 0;
    const firmGW = firmWins.reduce((a,t) => a+t._pnl,0);
    const firmGL = Math.abs(firmLos.reduce((a,t) => a+t._pnl,0));
    firmStats[k] = {
      pnl: v.pnl, count: v.count,
      wr: v.count ? (v.wins/v.count*100) : 0,
      pf: firmGL > 0 ? firmGW/firmGL : 999,
      wl: firmAL > 0 ? firmAW/firmAL : 0,
    };
  });
  const aiStats = { tot, wr, aw, al, pf, exp, dd, n: allTrades.length, gd, rd, fees, lng: lng.length, sht: sht.length, firmStats };

  const G4 = { display: "grid", gap: "10px", marginBottom: "10px" };

  return (
    <div>
      {/* ── Top stat cards ── */}
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <StatCard label="Total P&L" value={fmt(tot)} cls={tot >= 0 ? "mv-pos" : "mv-neg"} />
        <StatCard label="Trade Win %" value={wr.toFixed(2) + "%"} cls={wr >= 50 ? "mv-pos" : "mv-orange"}
          right={
            <div style={{ position: "relative", width: "60px", height: "60px" }}>
              <DonutChart data={[win.length, los.length]} colors={["#00d97e","#ef4444"]} size={60} />
            </div>
          }
        />
        <StatCard label="Avg Win / Avg Loss" value={(al > 0 ? (aw/al).toFixed(2) : "—") + "x"}
          right={
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#00d97e", marginBottom: "4px" }}>{fmt(aw)}</div>
              <div style={{ width: "100px", height: "4px", background: "#00d97e", borderRadius: "2px", marginBottom: "4px" }} />
              <div style={{ width: "100px", height: "4px", background: "#ef4444", borderRadius: "2px", marginBottom: "4px" }} />
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#ef4444" }}>{fmt(-al)}</div>
            </div>
          }
        />
      </div>
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <StatCard label="Day Win %" value={dayWR.toFixed(2) + "%"} cls={dayWR >= 50 ? "mv-pos" : "mv-orange"} />
        <StatCard label="Profit Factor" value={pf > 99 ? "∞" : pf.toFixed(2)} cls={pf >= 1.5 ? "mv-pos" : pf >= 1 ? "mv-orange" : "mv-neg"}
          right={
            <div style={{ position: "relative", width: "60px", height: "60px" }}>
              <DonutChart data={[gw, gl]} colors={["#00d97e","#ef4444"]} size={60} />
            </div>
          }
        />
        <StatCard label="Best Day % of Profit" value={tot > 0 ? bestDayPct.toFixed(2) + "%" : "—"} cls="mv-pos" />
      </div>

      {/* ── Charts ── */}
      <Div label="P&L Charts" />
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr" }}>
        <ChartPanel title="Daily Net Cumulative P&L" height={210}>
          <ChartCanvas type="line" deps={[cumData.length]}
            data={{ labels: cumLabels, datasets: [{ data: cumData, borderColor: eqColor, borderWidth: 2, pointRadius: 2, pointBackgroundColor: eqColor, fill: true, backgroundColor: eqColor + "15", tension: 0.4 }] }}
            options={{ ...BO, scales: { x: { ticks: { ...TX, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { color: GC } }, y: { grid: { color: GC }, ticks: { ...TX, callback: v => fmt(v) } } } }}
          />
        </ChartPanel>
        <ChartPanel title="Performance Radar" height={210}>
          <ChartCanvas type="radar" deps={[JSON.stringify(radarScores)]}
            data={{ labels: ["Win %","Prof. Factor","Expectancy","Avg W/L","Consistency"], datasets: [{ data: radarScores, borderColor: "#00d97e", backgroundColor: "rgba(0,217,126,0.12)", borderWidth: 2, pointBackgroundColor: "#00d97e", pointBorderColor: "#0a0a0b", pointRadius: 4, pointHoverRadius: 5 }] }}
            options={{ responsive: true, maintainAspectRatio: false, layout: { padding: { top: 4, bottom: 4, left: 4, right: 4 } }, plugins: { legend: { display: false } }, scales: { r: { min: 0, max: 100, ticks: { display: false, stepSize: 20 }, grid: { color: "rgba(255,255,255,0.07)" }, angleLines: { color: "rgba(255,255,255,0.07)" }, pointLabels: { color: "#888", font: { size: 10 }, padding: 4 } } } }}
          />
        </ChartPanel>
      </div>

      {/* ── Day stats ── */}
      <Div label="Day Statistics" />
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <InfoCard label="Most Active Day" value={mostActive ? mostActive[0] : "—"} />
        <InfoCard label="Most Profitable Day" value={mostProfit ? mostProfit[0] : "—"}
          right={mostProfit ? <span style={{ fontSize: "15px", fontWeight: 700, color: "#00d97e" }}>{fmt(mostProfit[1].pnl)}</span> : null} />
        <InfoCard label="Least Profitable Day" value={leastProfit ? leastProfit[0] : "—"}
          right={leastProfit ? <span style={{ fontSize: "15px", fontWeight: 700, color: leastProfit[1].pnl >= 0 ? "#00d97e" : "#ef4444" }}>{fmt(leastProfit[1].pnl)}</span> : null} />
      </div>

      {/* ── Trade stats ── */}
      <Div label="Trade Statistics" />
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr" }}>
        <InfoCard label="Total Number of Trades" value={allTrades.length} />
        <InfoCard label="Trade Direction %"
          value={(lng.length / allTrades.length * 100).toFixed(2) + "%"}
          right={
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>{sht.length}</span>
              <div style={{ position: "relative", width: "48px", height: "48px" }}>
                <DonutChart data={[lng.length, sht.length]} colors={["#00d97e","#ef4444"]} size={48} />
              </div>
              <span style={{ fontSize: "11px", color: "#00d97e", fontWeight: 700 }}>{lng.length}</span>
            </div>
          }
        />
      </div>
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <InfoCard label="Avg Trade Duration" value={fmtDur(Math.round(avgDur))} />
        <InfoCard label="Avg Win Duration" value={fmtDur(Math.round(avgWinDur))} cls="mv-pos" />
        <InfoCard label="Avg Loss Duration" value={fmtDur(Math.round(avgLosDur))} cls="mv-neg" />
      </div>
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr" }}>
        <InfoCard label="Best Trade" value={bestTrade ? fmt(bestTrade._pnl) : "—"} cls="mv-pos"
          right={bestTrade ? (
            <div style={{ textAlign: "right", fontSize: "11px", color: "var(--muted)", lineHeight: 1.8 }}>
              <div>{bestTrade.Type} {bestTrade.Size} {bestTrade.ContractName} @ {(+bestTrade.EntryPrice).toFixed(1)}</div>
              <div>Exited @ {(+bestTrade.ExitPrice).toFixed(1)}</div>
              <div>{bestTrade._date ? bestTrade._date.toLocaleDateString("en-US") : ""}</div>
            </div>
          ) : null}
        />
        <InfoCard label="Worst Trade" value={worstTrade ? fmt(worstTrade._pnl) : "—"} cls="mv-neg"
          right={worstTrade ? (
            <div style={{ textAlign: "right", fontSize: "11px", color: "var(--muted)", lineHeight: 1.8 }}>
              <div>{worstTrade.Type} {worstTrade.Size} {worstTrade.ContractName} @ {(+worstTrade.EntryPrice).toFixed(1)}</div>
              <div>Exited @ {(+worstTrade.ExitPrice).toFixed(1)}</div>
              <div>{worstTrade._date ? worstTrade._date.toLocaleDateString("en-US") : ""}</div>
            </div>
          ) : null}
        />
      </div>

      {/* ── Duration analysis ── */}
      <Div label="Duration Analysis" />
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr" }}>
        <ChartPanel title="Trade Duration Analysis" height={260}>
          <ChartCanvas type="bar" deps={[allTrades.length]}
            data={{ labels: durBuckets.map(b => b.label), datasets: [{ data: durCounts, backgroundColor: "rgba(249,115,22,0.5)", borderColor: "#f97316", borderWidth: 1, borderRadius: 3 }] }}
            options={{ ...BO, indexAxis: "y", scales: { x: { grid: { color: GC }, ticks: TX }, y: { ticks: { color: "#777", font: { size: 10 } }, grid: { display: false } } } }}
          />
        </ChartPanel>
        <ChartPanel title="Win Rate by Duration" height={260}>
          <ChartCanvas type="bar" deps={[allTrades.length]}
            data={{ labels: durBuckets.map(b => b.label), datasets: [{ data: durWinRates.map(v => +v.toFixed(1)), backgroundColor: durWinRates.map(v => v >= 50 ? "#00d97e" : "#ef4444"), borderRadius: 3 }] }}
            options={{ ...BO, indexAxis: "y", scales: { x: { min: 0, max: 100, grid: { color: GC }, ticks: { ...TX, callback: v => v + "%" } }, y: { ticks: { color: "#777", font: { size: 10 } }, grid: { display: false } } } }}
          />
        </ChartPanel>
      </div>

      {/* ── Account & DoW ── */}
      <Div label="Accounts & Performance" />
      <div style={{ ...G4, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="section" style={{ marginBottom: 0 }}>
          <div style={{ cursor: "default", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px" }}><div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>P&L By Account</span>
          </div>
          <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative", width: "150px", height: "150px", flexShrink: 0 }}>
              <DonutChart data={firmKeys.map(k => Math.abs(+firms[k].pnl.toFixed(2)))} colors={firmColors} size={150} />
            </div>
            <div style={{ width: "100%" }}>
              {firmKeys.map((k, i) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: firmColors[i], flexShrink: 0 }} />
                  <span style={{ color: "var(--muted)", fontSize: "12px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k}</span>
                  <span style={{ color: firms[k].pnl >= 0 ? "#00d97e" : "#ef4444", fontFamily: "monospace", fontWeight: 700, fontSize: "12px" }}>{fmt(firms[k].pnl)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ChartPanel title="P&L By Day Of Week" height={150}>
          <ChartCanvas type="bar" deps={[JSON.stringify(dowPnl)]}
            data={{ labels: DOW, datasets: [{ data: dowPnl.map(v => +v.toFixed(2)), backgroundColor: dowPnl.map(v => v >= 0 ? "#00d97e" : "#ef4444"), borderRadius: 4 }] }}
            options={{ ...BO, scales: { x: { ticks: { color: "#888", font: { size: 10 } }, grid: { display: false } }, y: { grid: { color: GC }, ticks: { ...TX, callback: v => fmt(v) } } } }}
          />
        </ChartPanel>
        <ChartPanel title="Net Daily P&L" height={150}>
          <ChartCanvas type="bar" deps={[dayEntries.length]}
            data={{ labels: dayEntries.map(([k]) => k.slice(5)), datasets: [{ data: dayEntries.map(([,v]) => +v.pnl.toFixed(2)), backgroundColor: dayEntries.map(([,v]) => v.pnl >= 0 ? "#00d97e" : "#ef4444"), borderRadius: 3 }] }}
            options={{ ...BO, scales: { x: { ticks: { ...TX, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, grid: { display: false } }, y: { grid: { color: GC }, ticks: { ...TX, callback: v => fmt(v) } } } }}
          />
        </ChartPanel>
      </div>

      {/* ── Trades table ── */}
      <Div label="Trade Log" />
      <div className="section" style={{ marginBottom: "12px" }}>
        <div style={{ cursor: "default", padding: "0.85rem 1.25rem", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "3px", height: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", borderRadius: "2px", flexShrink: 0 }} />
            <div style={{ display: "flex", gap: "8px" }}>
            {["top","worst"].map(t => (
              <button key={t} onClick={() => setTradeTab(t)} style={{ background: tradeTab===t?"linear-gradient(135deg,#ef4444,#f97316)":"transparent", color: tradeTab===t?"#fff":"var(--muted)", border: tradeTab===t?"none":"1px solid var(--border)", borderRadius: "7px", padding: "5px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}>
                {t==="top"?"Top 10":"Worst 10"}
              </button>
            ))}
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr>{["Date","Contract","Type","Entry","Exit","Size","Duration","P&L"].map(h=><th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {[...allTrades].sort((a,b)=>tradeTab==="top"?b._pnl-a._pnl:a._pnl-b._pnl).slice(0,10).map((t,i)=>(
                <tr key={i}>
                  <td className="date">{t._date?t._date.toLocaleDateString("en-US",{month:"short",day:"numeric"}):"—"}</td>
                  <td style={{fontFamily:"monospace",fontSize:"12px",color:"var(--muted)"}}>{t.ContractName||"—"}</td>
                  <td><span className={t.Type==="Long"?"tag-purchase":"tag-reset"}>{t.Type||"—"}</span></td>
                  <td style={{fontFamily:"monospace",fontSize:"12px",color:"var(--muted)"}}>{(+t.EntryPrice||0).toFixed(1)}</td>
                  <td style={{fontFamily:"monospace",fontSize:"12px",color:"var(--muted)"}}>{(+t.ExitPrice||0).toFixed(1)}</td>
                  <td style={{fontFamily:"monospace",fontSize:"12px",color:"var(--muted)"}}>{t.Size||"—"}</td>
                  <td className="date">{fmtDur(t._dur)}</td>
                  <td className={t._pnl>=0?"amount":"amount-neg"}>{fmt(t._pnl)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI ── */}
      <CoachingInsights stats={aiStats} />
    </div>
  );
}


// ── Root export ───────────────────────────────────────────────────────────────
export default function AnalyticsPage({ uploadRef }) {
  const [loadedFiles, setLoadedFiles] = useState([]);
  const [allTrades, setAllTrades] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [pendingQueue, setPendingQueue] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Load persisted data on mount
  useEffect(() => {
    try {
      const savedFiles = localStorage.getItem("analytics_files");
      const savedTrades = localStorage.getItem("analytics_trades");
      if (savedFiles && savedTrades) {
        const files = JSON.parse(savedFiles);
        const trades = JSON.parse(savedTrades);
        // Restore _date as Date objects
        trades.forEach(t => { if (t._date) t._date = new Date(t._date); });
        setLoadedFiles(files);
        setAllTrades(trades);
      }
    } catch(e) {}
    setHydrated(true);
  }, []);

  // Persist whenever trades change
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem("analytics_files", JSON.stringify(loadedFiles));
      localStorage.setItem("analytics_trades", JSON.stringify(allTrades));
    } catch(e) {}
  }, [allTrades, loadedFiles, hydrated]);

  // Read files into rawText then queue them for firm selection one by one
  const handleFiles = (files) => {
    Array.from(files).forEach(f => {
      if (!f.name.toLowerCase().endsWith(".csv")) return;
      if (loadedFiles.find(x => x.name === f.name)) return;
      const reader = new FileReader();
      reader.onload = e => {
        const rawText = e.target.result;
        setPendingQueue(prev => [...prev, { file: f, rawText }]);
      };
      reader.readAsText(f);
    });
  };

  // Called when user confirms firm for the first pending file
  const handleFirmConfirm = (firmKey) => {
    const { file, rawText } = pendingQueue[0];
    const firm = FIRMS_LIST.find(f => f.key === firmKey);
    const label = firm ? firm.label : firmKey;
    const color = firm ? firm.color : FC[loadedFiles.length % FC.length];
    const trades = parseCSV(rawText, label);
    // Tag each trade with the firm key for grouping
    trades.forEach(t => { t._firmKey = firmKey; t._firmLabel = label; t._src = label; });
    setLoadedFiles(prev => [...prev, { name: file.name, label, count: trades.length, color }]);
    setAllTrades(prev => [...prev, ...trades]);
    setPendingQueue(prev => prev.slice(1));
  };

  const handleFirmCancel = () => {
    setPendingQueue(prev => prev.slice(1));
  };

  // Wire external upload button and reset callback from page.js header
  useEffect(() => {
    if (!uploadRef?.current) return;
    const el = uploadRef.current;
    const handler = (e) => { if (e.target.files?.length) handleFiles(e.target.files); el.value = ""; };
    el.addEventListener("change", handler);
    el._resetCb = reset;
    return () => { el.removeEventListener("change", handler); };
  }, [pendingQueue, loadedFiles]);

  const removeFile = (i) => {
    const label = loadedFiles[i].label;
    setLoadedFiles(prev => prev.filter((_, j) => j !== i).map((f, j) => ({ ...f, color: FIRMS_LIST.find(x=>x.label===f.label)?.color || FC[j % FC.length] })));
    setAllTrades(prev => prev.filter(t => t._src !== label));
  };

  const reset = () => { setLoadedFiles([]); setAllTrades([]); setPendingQueue([]); try { localStorage.removeItem('analytics_files'); localStorage.removeItem('analytics_trades'); } catch(e) {} };
  const hasData = allTrades.length > 0;

  return (
    <div style={{ position: "relative", minHeight: "600px" }}>
      {/* Firm select modal — shown for each pending file */}
      {pendingQueue.length > 0 && (
        <FirmSelectModal
          fileName={pendingQueue[0].file.name}
          onConfirm={handleFirmConfirm}
          onCancel={handleFirmCancel}
        />
      )}

      {/* Blurred fake background — always rendered, hidden once data loaded */}
      {!hasData && (
        <div style={{ filter: "blur(6px)", opacity: 0.45, pointerEvents: "none", userSelect: "none" }}>
          <FakeBackground />
        </div>
      )}

      {/* Upload gate — shown over blur when no data */}
      {!hasData && (
        <UploadGate onFiles={handleFiles} dragActive={dragActive} setDragActive={setDragActive} />
      )}

      {/* Real dashboard — shown once data is loaded */}
      {hasData && (
        <Dashboard
          allTrades={allTrades}
          loadedFiles={loadedFiles}
          onRemoveFile={removeFile}
          onReset={reset}
          uploadRef={uploadRef}
        />
      )}
    </div>
  );
}
