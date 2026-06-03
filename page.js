"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import AnalyticsPage from "./AnalyticsPage";
import IntelligencePage from "./IntelligencePage";

function PNLChart({ payouts, spending }) {
  const [tooltip, setTooltip] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const events = [
    ...payouts.filter(p => p.amount).map(p => ({ date: new Date(p.date), amount: p.amount })),
    ...spending.filter(s => s.amount).map(s => ({ date: new Date(s.date), amount: -s.amount })),
  ].sort((a, b) => a.date - b.date);

  if (events.length < 2) return (
    <div className="section" style={{ marginBottom: "12px" }}>
      <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cumulative PNL {isCollapsed ? "▶" : "▼"}</span>
      </div>
    </div>
  );

  let running = 0;
  const points = events.map(e => { running += e.amount; return { date: e.date, pnl: running }; });
  const minPnl = Math.min(0, ...points.map(p => p.pnl));
  const maxPnl = Math.max(...points.map(p => p.pnl));
  const range = maxPnl - minPnl || 1;
  const W = 900, H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 70 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const xS = (i) => PAD.left + (i / (points.length - 1)) * cW;
  const yS = (v) => PAD.top + cH - ((v - minPnl) / range) * cH;
  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(p.pnl).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L${xS(points.length-1).toFixed(1)},${yS(minPnl).toFixed(1)} L${xS(0).toFixed(1)},${yS(minPnl).toFixed(1)} Z`;
  const finalPnl = points[points.length - 1].pnl;
  const color = finalPnl >= 0 ? "#00d97e" : "#ef4444";
  const yTicks = [0, 1, 2, 3, 4].map(i => minPnl + (range / 4) * i);
  const xIdxs = [0, Math.floor(points.length / 2), points.length - 1];

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const idx = Math.round((mouseX - PAD.left) / cW * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, idx));
    const p = points[clamped];
    setTooltip({ x: xS(clamped), y: yS(p.pnl), pnl: p.pnl, date: p.date });
  };

  return (
    <div className="section" style={{ marginBottom: "12px" }}>
      <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setIsCollapsed(!isCollapsed)}>
        <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cumulative PNL {isCollapsed ? "▶" : "▼"}</span>
        <span className="badge" style={{ color, background: finalPnl >= 0 ? "var(--green-dim)" : "var(--red-dim)" }}>
          {finalPnl >= 0 ? "+" : ""}${finalPnl.toFixed(0)}
        </span>
      </div>
      {!isCollapsed && (
        <div style={{ padding: "1rem 0.5rem 0.5rem" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", cursor: "crosshair" }}
          onMouseMove={handleMouseMove} onMouseLeave={() => setTooltip(null)}>
          <defs>
            <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {yTicks.map((v, i) => (
            <g key={i}>
              <line x1={PAD.left} y1={yS(v)} x2={W - PAD.right} y2={yS(v)} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <text x={PAD.left - 8} y={yS(v)} textAnchor="end" dominantBaseline="middle" fill="#666" fontSize="10">
                {Math.abs(v) >= 1000 ? `${v < 0 ? "-" : ""}$${(Math.abs(v)/1000).toFixed(1)}k` : `$${v.toFixed(0)}`}
              </text>
            </g>
          ))}
          {minPnl < 0 && <line x1={PAD.left} y1={yS(0)} x2={W - PAD.right} y2={yS(0)} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="4,4" />}
          <path d={areaD} fill="url(#pnlGrad)" />
          <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          {xIdxs.map((idx, i) => (
            <text key={i} x={xS(idx)} y={H - 4} textAnchor="middle" fill="#666" fontSize="10">
              {points[idx].date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          ))}
          <circle cx={xS(points.length - 1)} cy={yS(finalPnl)} r="4" fill={color} />
          {tooltip && (
            <g>
              <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top + cH} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
              <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={tooltip.pnl >= 0 ? "#00d97e" : "#ef4444"} stroke="#0a0a0b" strokeWidth="2" />
              <rect x={Math.min(tooltip.x + 8, W - 130)} y={Math.max(tooltip.y - 28, PAD.top)} width="120" height="42" rx="6" fill="#18181b" stroke="rgba(249,115,22,0.3)" strokeWidth="1" />
              <text x={Math.min(tooltip.x + 68, W - 70)} y={Math.max(tooltip.y - 12, PAD.top + 14)} textAnchor="middle" fill={tooltip.pnl >= 0 ? "#00d97e" : "#ef4444"} fontSize="12" fontWeight="700">
                {tooltip.pnl >= 0 ? "+" : ""}${tooltip.pnl.toFixed(2)}
              </text>
              <text x={Math.min(tooltip.x + 68, W - 70)} y={Math.max(tooltip.y + 6, PAD.top + 32)} textAnchor="middle" fill="#666" fontSize="10">
                {tooltip.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </text>
            </g>
          )}
        </svg>
      </div>
      )}
    </div>
  );
}

const FIRMS = [
  { name: "Topstep", firmKey: "topstep", connected: "dynamic", color: "#f97316", logo: (
    <img src="/logos/topstep.png" alt="Topstep" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "My Funded Futures", firmKey: "mff", connected: "dynamic", color: "#c9a84c", logo: (
    <img src="/logos/mff.jpg" alt="My Funded Futures" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "Lucid Trading", firmKey: "lucid", connected: "dynamic", color: "#8b5cf6", logo: (
    <img src="/logos/lucid.png" alt="Lucid Trading" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "Apex Trader Funding", firmKey: "apex", connected: "dynamic", color: "#f59e0b", logo: (
    <img src="/logos/apex.png" alt="Apex Trader Funding" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "Alpha Futures", connected: false, comingSoon: true, color: "#10b981", logo: (
    <img src="/logos/alpha.png" alt="Alpha Futures" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "Take Profit Trader", connected: false, comingSoon: true, color: "#6366f1", logo: (
    <img src="/logos/tpt.png" alt="Take Profit Trader" style={{ width: "42px", height: "42px", borderRadius: "10px", objectFit: "cover", display: "block" }} />
  )},
  { name: "Tradeify", connected: false, comingSoon: true, color: "#10b981", logo: (
    <img src="/logos/tradeify.png" alt="Tradeify" style={{ width: "38px", height: "38px", borderRadius: "10px", objectFit: "cover", display: "block", margin: "2px" }} />
  )},
  { name: "FundedNext", connected: false, comingSoon: true, color: "#6366f1", logo: (
    <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <svg width="42" height="42" viewBox="-25 -25 170 170" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="120" height="120" fill="#000"/>
        {/* F */}
        <path d="M8 18 L8 102 L24 102 L24 68 L46 68 L46 54 L24 54 L24 32 L50 32 L50 18 Z" fill="white"/>
        {/* N */}
        <path d="M58 18 L58 102 L73 102 L73 44 L95 102 L112 102 L112 18 L97 18 L97 76 L75 18 Z" fill="white"/>
        {/* Purple triangle top-right of N */}
        <polygon points="97,18 112,18 112,36" fill="#6366f1"/>
      </svg>
    </div>
  )},
];

function FirmsGrid({ onSyncFirm, onSyncAll, onClearFirm, onViewFirm, loading, firmLoading, firmData }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
      {FIRMS.map((firm) => {
        const hasData = firm.connected === "dynamic" ? (firmData[firm.firmKey] || false) : firm.connected;
        const isFirmLoading = firmLoading?.[firm.firmKey] || false;
        return (
        <div key={firm.name}
          onClick={() => hasData && firm.firmKey && onViewFirm(firm.firmKey)}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "14px", transition: "border-color 0.2s, box-shadow 0.2s", cursor: hasData && firm.firmKey ? "pointer" : "default" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(249,115,22,0.6)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(249,115,22,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px", color: "#fff" }}>{firm.name}</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", background: hasData ? "rgba(0,217,126,0.12)" : "rgba(255,255,255,0.05)", color: hasData ? "var(--green)" : "var(--muted)" }}>
                <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: hasData ? "var(--green)" : "var(--muted)", display: "inline-block" }}></span>
                {hasData ? "Connected" : "Not connected"}
              </div>
            </div>
            <div style={{ flexShrink: 0, width: "42px", height: "42px", borderRadius: "10px", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>{firm.logo}</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }} onClick={e => e.stopPropagation()}>
            {firm.comingSoon ? (
              <div style={{ fontSize: "11px", fontWeight: 700, padding: "6px 14px", borderRadius: "7px", background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)", letterSpacing: "0.05em" }}>
                Coming Soon
              </div>
            ) : hasData ? (
              <>
                <button onClick={() => onSyncFirm(firm.firmKey)} disabled={isFirmLoading || loading} style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: isFirmLoading || loading ? 0.6 : 1 }}>
                  {isFirmLoading ? "Syncing..." : "Re-sync"}
                </button>
                <button onClick={() => onClearFirm(firm.firmKey)} style={{ background: "transparent", color: "var(--muted)", border: "1px solid var(--border)", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Clear</button>
              </>
            ) : (
              <button
                onClick={firm.connected === "dynamic" ? () => onSyncFirm(firm.firmKey) : undefined}
                disabled={isFirmLoading}
                style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "7px", padding: "8px 16px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: isFirmLoading ? 0.6 : 1 }}
              >
                {isFirmLoading ? "Connecting..." : "Connect"}
              </button>            )}
          </div>
        </div>
        );
      })}
    </div>
  );
}


function CalendarPage({ payouts, spending, savedJournals, setSavedJournals, session }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("monthly");
  const [selectedDay, setSelectedDay] = useState(null);
  const [payoutsCollapsed, setPayoutsCollapsed] = useState(false);
  const [spendingCollapsed, setSpendingCollapsed] = useState(false);
  const [journalCollapsed, setJournalCollapsed] = useState(false);
  const [journalData, setJournalData] = useState({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
  const [entryIndex, setEntryIndex] = useState(null);
  const [isNewEntry, setIsNewEntry] = useState(true);

  // Load journal data when selectedDay changes
  useEffect(() => {
    if (selectedDay) {
      const dateKey = selectedDay.toLocaleDateString();
      setIsNewEntry(true);
      setEntryIndex(null);
      setJournalData({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
      const previewContainer = document.querySelector('[data-preview]');
      if (previewContainer) previewContainer.innerHTML = '';
    }
  }, [selectedDay]);
  const today = new Date();

  // If a day is selected, show day view instead
  if (selectedDay) {
    const year = selectedDay.getFullYear();
    const month = selectedDay.getMonth();
    const day = selectedDay.getDate();

    const dayPayouts = payouts.filter(p => {
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

    const daySpending = spending.filter(s => {
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", marginBottom: "20px", position: "relative" }}>
          <button onClick={() => setSelectedDay(null)} style={{ position: "absolute", right: 0, background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", padding: "10px 24px", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "13px", fontFamily: "inherit" }}>← Back</button>
          <h1 style={{ fontSize: "24px", fontWeight: 700 }}>
            {selectedDay.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </h1>
        </div>

        {/* Daily Stats Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px", marginBottom: "20px" }}>
          <div className="metric-card">
            <div className="metric-label">Total Payouts</div>
            <div className="metric-value mv-pos">${dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Spending</div>
            <div className="metric-value mv-neg">${daySpending.reduce((sum, s) => sum + (s.amount || 0), 0).toFixed(2)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Net P&L</div>
            <div className={`metric-value ${dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) - daySpending.reduce((sum, s) => sum + (s.amount || 0), 0) === 0 ? "mv-neutral" : dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) - daySpending.reduce((sum, s) => sum + (s.amount || 0), 0) > 0 ? "mv-pos" : "mv-neg"}`}>
              {dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) - daySpending.reduce((sum, s) => sum + (s.amount || 0), 0) > 0 ? "+" : ""}${(dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) - daySpending.reduce((sum, s) => sum + (s.amount || 0), 0)).toFixed(2)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Profit Factor</div>
            <div className={`metric-value ${daySpending.reduce((sum, s) => sum + (s.amount || 0), 0) === 0 ? "mv-neutral" : (dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) / daySpending.reduce((sum, s) => sum + (s.amount || 0), 0)) >= 1 ? "mv-pos" : "mv-neg"}`}>
              {daySpending.reduce((sum, s) => sum + (s.amount || 0), 0) === 0 ? "—" : (dayPayouts.reduce((sum, p) => sum + (p.amount || 0), 0) / daySpending.reduce((sum, s) => sum + (s.amount || 0), 0)).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Payouts Section */}
        {dayPayouts.length > 0 && (
          <div className="section" style={{ marginBottom: "20px", borderRadius: "12px", padding: "16px" }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "12px", marginBottom: payoutsCollapsed ? "0" : "12px" }} onClick={() => setPayoutsCollapsed(!payoutsCollapsed)}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Payouts {payoutsCollapsed ? "▶" : "▼"}</span>
            </div>
            {!payoutsCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dayPayouts.map((p, i) => (
                <div key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</div>
                    <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: 600 }}>{new Date(p.date).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payout</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#4ade80" }}>+${(p.amount || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* Spending Section */}
        {daySpending.length > 0 && (
          <div className="section" style={{ marginBottom: "20px", borderRadius: "12px", padding: "16px" }}>
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "12px", marginBottom: spendingCollapsed ? "0" : "12px" }} onClick={() => setSpendingCollapsed(!spendingCollapsed)}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Spending {spendingCollapsed ? "▶" : "▼"}</span>
            </div>
            {!spendingCollapsed && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {daySpending.map((s, i) => (
                <div key={i} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "center" }}>
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</div>
                    <div style={{ fontSize: "13px", color: "var(--text)", fontWeight: 600 }}>{new Date(s.date).toLocaleDateString()}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spending</div>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: "#ef4444" }}>-${(s.amount || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}

        {/* Journal Section */}
        <div className="section" style={{ marginTop: "20px", borderRadius: "12px", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: journalCollapsed ? "0" : "20px", cursor: "pointer" }} onClick={() => setJournalCollapsed(!journalCollapsed)}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.08em" }}>Journal {journalCollapsed ? "▶" : "▼"}</div>
          </div>
          {!journalCollapsed && (() => {
            const dateKey = selectedDay.toLocaleDateString();
            const entries = savedJournals[dateKey] || [];
            const emotionTags = ["Calm","Focused","Confident","Patient","Disciplined"];
            const negativeTags = ["Revenge","FOMO","Overconfident","Anxious","Frustrated","Impulsive"];
            if (entries.length === 0) {
              return <div style={{ textAlign: "center", color: "var(--muted)", padding: "2rem", fontSize: "13px" }}>No journal entries for this day.</div>;
            }
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {entries.map((entry, entryIdx) => {
                  const pnl = parseFloat(entry.pnl) || 0;
                  const isWin = pnl > 0;
                  const isLoss = pnl < 0;
                  const isBE = pnl === 0 && entry.pnl !== "";
                  const borderColor = isWin ? "rgba(0,217,126,0.25)" : isLoss ? "rgba(239,68,68,0.25)" : "var(--border)";
                  const outcomeColor = isWin ? "var(--green)" : isLoss ? "var(--red)" : "var(--orange)";
                  const outcomeBg = isWin ? "var(--green-dim)" : isLoss ? "var(--red-dim)" : "var(--orange-dim)";
                  const outcomeLabel = isWin ? "Win" : isLoss ? "Loss" : isBE ? "BE" : null;
                  return (
                    <div key={entryIdx} style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "18px 20px", background: "var(--surface2)", position: "relative" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap", paddingRight: "140px" }}>
                        <span style={{ fontSize: "16px", fontWeight: 800 }}>
                          {[entry.instrument, entry.direction].filter(Boolean).join(" ")}
                          {pnl !== 0 && <span style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}> · {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}</span>}
                        </span>
                        {outcomeLabel && <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: outcomeBg, color: outcomeColor }}>{outcomeLabel}</span>}
                      </div>
                      {/* Meta */}
                      {(entry.time || entry.firm || entry.setupType) && (
                        <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                          {[entry.time, entry.firm, entry.setupType].filter(Boolean).join(" · ")}
                        </div>
                      )}
                      {/* Discipline */}
                      {entry.discipline && (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                          <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Discipline</span>
                          <span style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1, color: Number(entry.discipline) >= 8 ? "var(--green)" : Number(entry.discipline) >= 5 ? "var(--orange)" : "var(--red)" }}>{entry.discipline}</span>
                        </div>
                      )}
                      {/* Notes + image */}
                      <div style={{ display: "grid", gridTemplateColumns: entry.image ? "1fr auto" : "1fr", gap: "16px", alignItems: "start" }}>
                        <div>
                          {entry.notes && <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "12px", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>{entry.notes}</div>}
                          {entry.tags && entry.tags.length > 0 && (
                            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                              {entry.tags.map(tag => {
                                const isPos = emotionTags.includes(tag);
                                const isNeg = negativeTags.includes(tag);
                                return <span key={tag} style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: isPos ? "rgba(249,115,22,0.15)" : isNeg ? "var(--red-dim)" : "rgba(255,255,255,0.06)", color: isPos ? "var(--orange)" : isNeg ? "var(--red)" : "var(--muted)", border: `1px solid ${isPos ? "rgba(249,115,22,0.2)" : isNeg ? "rgba(239,68,68,0.2)" : "var(--border)"}` }}>{tag}</span>;
                              })}
                            </div>
                          )}
                        </div>
                        {entry.image && <img src={entry.image} style={{ width: "120px", height: "90px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build day data from payouts and spending
  const dayData = {};

  for (const p of payouts) {
    const d = new Date(p.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      if (!dayData[key]) dayData[key] = { pnl: 0, count: 0 };
      dayData[key].pnl += p.amount || 0;
      dayData[key].count++;
    }
  }

  for (const s of spending) {
    const d = new Date(s.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      if (!dayData[key]) dayData[key] = { pnl: 0, count: 0 };
      dayData[key].pnl -= s.amount || 0;
      dayData[key].count++;
    }
  }

  // Build day data for all 12 months
  const allMonthsDayData = Array(12).fill(null).map(() => ({}));
  for (let m = 0; m < 12; m++) {
    for (const p of payouts) {
      const d = new Date(p.date);
      if (d.getFullYear() === year && d.getMonth() === m) {
        const key = d.getDate();
        if (!allMonthsDayData[m][key]) allMonthsDayData[m][key] = { pnl: 0, count: 0 };
        allMonthsDayData[m][key].pnl += p.amount || 0;
        allMonthsDayData[m][key].count++;
      }
    }
    for (const s of spending) {
      const d = new Date(s.date);
      if (d.getFullYear() === year && d.getMonth() === m) {
        const key = d.getDate();
        if (!allMonthsDayData[m][key]) allMonthsDayData[m][key] = { pnl: 0, count: 0 };
        allMonthsDayData[m][key].pnl -= s.amount || 0;
        allMonthsDayData[m][key].count++;
      }
    }
  }

  // Build calendar grid
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Weekly stats
  const weekStats = weeks.map((week, wi) => {
    let pnl = 0, days = 0;
    for (const d of week) {
      if (d && dayData[d]) { pnl += dayData[d].pnl; days++; }
    }
    return { pnl, days };
  });

  // Monthly stats
  const monthlyPnl = Object.values(dayData).reduce((s, d) => s + d.pnl, 0);
  const monthlyDays = Object.values(dayData).filter(d => d.count > 0).length;

  // Yearly stats
  const monthlyStats = Array(12).fill(null).map((_, m) => {
    let pnl = 0, days = 0;
    for (const p of payouts) {
      const d = new Date(p.date);
      if (d.getFullYear() === year && d.getMonth() === m) { pnl += p.amount || 0; days++; }
    }
    for (const s of spending) {
      const d = new Date(s.date);
      if (d.getFullYear() === year && d.getMonth() === m) { pnl -= s.amount || 0; days++; }
    }
    return { pnl, days, name: new Date(year, m, 1).toLocaleDateString("en-US", { month: "short" }) };
  });
  const yearlyPnl = monthlyStats.reduce((sum, m) => sum + m.pnl, 0);
  const yearlyDays = monthlyStats.filter(m => m.days > 0).length;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const prevYear = () => setCurrentDate(new Date(year - 1, 0, 1));
  const nextYear = () => setCurrentDate(new Date(year + 1, 0, 1));
  const goToday = () => setCurrentDate(new Date());

  const cellStyle = (day) => {
    const data = day ? dayData[day] : null;
    const isToday = day && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
    let bg = "var(--surface)";
    if (data) bg = data.pnl >= 0 ? "rgba(0,100,50,0.5)" : "rgba(100,0,0,0.5)";
    return {
      background: bg,
      border: isToday ? "2px solid #f97316" : "1px solid var(--border)",
      borderRadius: "8px",
      padding: "8px",
      height: "110px", width: "100%",
      position: "relative",
      verticalAlign: "top",
    };
  };

  return (
    <div>
      {/* Header with toggle - above cards */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button onClick={viewMode === "monthly" ? prevMonth : prevYear} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "16px" }}>◀</button>
          <button onClick={goToday} style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "#fff", cursor: "pointer", padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, fontFamily: "inherit" }}>TODAY</button>
          <button onClick={viewMode === "monthly" ? nextMonth : nextYear} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: "16px" }}>▶</button>
          <span style={{ fontSize: "18px", fontWeight: 700, marginLeft: "8px" }}>{viewMode === "monthly" ? monthName : year}</span>
        </div>
        <div style={{ display: "flex", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "6px", padding: "4px" }}>
          <button onClick={() => setViewMode("monthly")} style={{ background: viewMode === "monthly" ? "rgba(249,115,22,0.3)" : "transparent", border: "none", color: "#fff", cursor: "pointer", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, fontFamily: "inherit" }}>Monthly</button>
          <button onClick={() => setViewMode("yearly")} style={{ background: viewMode === "yearly" ? "rgba(249,115,22,0.3)" : "transparent", border: "none", color: "#fff", cursor: "pointer", padding: "4px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, fontFamily: "inherit" }}>Yearly</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        {/* Calendar or Yearly */}
        <div style={{ flex: 1 }}>
          {viewMode === "monthly" ? (
            <div>
              {/* Monthly stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <div className="metric-card">
                  <div className="metric-label">Total Payouts</div>
                  <div className="metric-value mv-pos">${Object.values(dayData).reduce((sum, d) => sum + (d.pnl >= 0 ? d.pnl : 0), 0).toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total Spending</div>
                  <div className="metric-value mv-neg">${Object.values(dayData).reduce((sum, d) => sum + (d.pnl < 0 ? Math.abs(d.pnl) : 0), 0).toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Profit Factor</div>
                  <div className={`metric-value ${Object.values(dayData).reduce((sum, d) => sum + (d.pnl < 0 ? Math.abs(d.pnl) : 0), 0) === 0 ? "mv-neutral" : Object.values(dayData).reduce((sum, d) => sum + (d.pnl >= 0 ? d.pnl : 0), 0) / Object.values(dayData).reduce((sum, d) => sum + (d.pnl < 0 ? Math.abs(d.pnl) : 0), 0) >= 1 ? "mv-pos" : "mv-neg"}`}>
                    {Object.values(dayData).reduce((sum, d) => sum + (d.pnl < 0 ? Math.abs(d.pnl) : 0), 0) === 0 ? "—" : (Object.values(dayData).reduce((sum, d) => sum + (d.pnl >= 0 ? d.pnl : 0), 0) / Object.values(dayData).reduce((sum, d) => sum + (d.pnl < 0 ? Math.abs(d.pnl) : 0), 0)).toFixed(2)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Days Traded</div>
                  <div className="metric-value mv-neutral">{monthlyDays}</div>
                </div>
              </div>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} style={{ padding: "8px", fontSize: "12px", fontWeight: 600, color: "var(--muted)", textAlign: "center", background: "var(--surface)", borderRadius: "6px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center" }}>{d}</div>
                ))}
              </div>
              {/* Calendar rows */}
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
                  {week.map((day, di) => {
                    const data = day ? dayData[day] : null;
                    const isToday = day && today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
                    let bg = "var(--surface)";
                    if (data) bg = data.pnl >= 0 ? "rgba(0,100,50,0.5)" : "rgba(100,0,0,0.5)";
                    return (
                      <div key={di} onClick={() => day && setSelectedDay(new Date(year, month, day))} style={{ background: bg, border: isToday ? "2px solid #f97316" : "1px solid var(--border)", borderRadius: "8px", padding: "8px", height: "130px", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: day ? "pointer" : "default", transition: "all 0.2s ease" }} onMouseEnter={e => day && (e.currentTarget.style.borderColor = "rgba(249,115,22,0.6)", e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)")} onMouseLeave={e => day && (e.currentTarget.style.borderColor = isToday ? "2px solid #f97316" : "var(--border)", e.currentTarget.style.boxShadow = "none")}>
                        {day && (
                          <>
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <span style={{ fontSize: "13px", fontWeight: 600, color: isToday ? "#f97316" : "var(--muted)", background: isToday ? "rgba(249,115,22,0.2)" : "transparent", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>{day}</span>
                            </div>
                            {data && (
                              <div style={{ fontSize: "12px", fontWeight: 700, color: data.pnl >= 0 ? "#4ade80" : "#f87171" }}>
                                ${Math.abs(data.pnl).toFixed(1)}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <div>
              {/* Yearly stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                <div className="metric-card">
                  <div className="metric-label">Total Payouts</div>
                  <div className="metric-value mv-pos">${spending.length > 0 ? monthlyStats.reduce((sum, m) => { let p = 0; for (const pay of payouts) { const d = new Date(pay.date); if (d.getFullYear() === year && d.getMonth() === monthlyStats.indexOf(m)) p += pay.amount || 0; } return sum + p; }, 0).toFixed(2) : monthlyStats.reduce((sum, m) => sum + (m.pnl >= 0 ? m.pnl : 0), 0).toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total Spending</div>
                  <div className="metric-value mv-neg">${spending.reduce((sum, s) => { const d = new Date(s.date); return d.getFullYear() === year ? sum + (s.amount || 0) : sum; }, 0).toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Profit Factor</div>
                  <div className={`metric-value ${spending.reduce((sum, s) => { const d = new Date(s.date); return d.getFullYear() === year ? sum + (s.amount || 0) : sum; }, 0) === 0 ? "mv-neutral" : payouts.reduce((sum, p) => { const d = new Date(p.date); return d.getFullYear() === year ? sum + (p.amount || 0) : sum; }, 0) / spending.reduce((sum, s) => { const d = new Date(s.date); return d.getFullYear() === year ? sum + (s.amount || 0) : sum; }, 0) >= 1 ? "mv-pos" : "mv-neg"}`}>
                    {spending.reduce((sum, s) => { const d = new Date(s.date); return d.getFullYear() === year ? sum + (s.amount || 0) : sum; }, 0) === 0 ? "—" : (payouts.reduce((sum, p) => { const d = new Date(p.date); return d.getFullYear() === year ? sum + (p.amount || 0) : sum; }, 0) / spending.reduce((sum, s) => { const d = new Date(s.date); return d.getFullYear() === year ? sum + (s.amount || 0) : sum; }, 0)).toFixed(2)}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Days Traded</div>
                  <div className="metric-value mv-neutral">{payouts.filter(p => new Date(p.date).getFullYear() === year).length + spending.filter(s => new Date(s.date).getFullYear() === year).length > 0 ? new Set([...payouts.filter(p => new Date(p.date).getFullYear() === year).map(p => new Date(p.date).toDateString()), ...spending.filter(s => new Date(s.date).getFullYear() === year).map(s => new Date(s.date).toDateString())]).size : 0}</div>
                </div>
              </div>
              {/* Yearly month grids */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              {monthlyStats.map((m, mi) => {
                const monthDayData = allMonthsDayData[mi];
                const monthFirstDay = new Date(year, mi, 1).getDay();
                const monthDaysInMonth = new Date(year, mi + 1, 0).getDate();
                const monthCells = [];
                for (let i = 0; i < monthFirstDay; i++) monthCells.push(null);
                for (let d = 1; d <= monthDaysInMonth; d++) monthCells.push(d);
                while (monthCells.length % 7 !== 0) monthCells.push(null);

                return (
                  <div key={mi} onClick={() => { setCurrentDate(new Date(year, mi, 1)); setViewMode("monthly"); }} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "12px", transition: "border-color 0.2s, box-shadow 0.2s", cursor: "pointer" }} onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.6)"; e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)"; }} onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "8px" }}>{m.name}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
                      {monthCells.map((day, di) => {
                        const dayPnl = day ? monthDayData[day] : null;
                        let bg = "rgba(255,255,255,0.05)";
                        if (dayPnl) bg = dayPnl.pnl >= 0 ? "rgba(20,83,56,0.8)" : "rgba(80,20,20,0.8)";
                        return (
                          <div key={di} style={{ width: "100%", paddingBottom: "100%", position: "relative", borderRadius: "4px", background: bg }}></div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}
        </div>

        {/* Weekly sidebar - only show in monthly view */}
        {viewMode === "monthly" && (
        <div style={{ width: "140px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ height: "145px" }}></div>
          {weekStats.map((ws, i) => (
            <div key={i} style={{ background: "var(--surface)", border: "1px solid rgba(249,115,22,0.6)", borderRadius: "8px", padding: "10px 12px", height: "130px", width: "100%", display: "flex", flexDirection: "column", justifyContent: "center", boxSizing: "border-box", transition: "box-shadow 0.2s", cursor: "pointer" }} onMouseEnter={e => e.currentTarget.style.boxShadow = "0 0 20px rgba(249,115,22,0.15)"} onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginBottom: "4px" }}>Week {i + 1}</div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: ws.pnl === 0 ? "var(--text)" : ws.pnl > 0 ? "#4ade80" : "#f87171" }}>
                {ws.pnl === 0 ? "$0.00" : `${ws.pnl > 0 ? "+" : ""}$${ws.pnl.toFixed(2)}`}
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>{ws.days} days</div>
            </div>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

function FirmDetailPage({ firmKey, data, onBack }) {
  const firm = FIRMS.find(f => f.firmKey === firmKey);
  const combines = data.combines.filter(e => e.firm === firmKey);
  const spending = data.spending.filter(e => e.firm === firmKey);
  const payouts = firmKey === "topstep" ? data.payouts : firmKey === "lucid" ? (data.lucidPayouts || []) : [];

  const totalEarned = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSpent = spending.reduce((sum, s) => sum + (s.amount || s.purchasePrice || s.total || 0), 0);
  const netProfit = totalEarned - totalSpent;
  const passed = combines.filter(c => !c.status || c.status === "Passed" || c.status === "Standard" || c.status === "Express").length;

  const [spendingCollapsed, setSpendingCollapsed] = useState(false);
  const [payoutsCollapsed, setPayoutsCollapsed] = useState(false);

  return (
    <div>
      <div className="metrics-grid" style={{ marginBottom: "24px" }}>
        <div className="metric-card">
          <div className="metric-label">Total Earned</div>
          <div className="metric-value mv-pos">${totalEarned.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Spent</div>
          <div className="metric-value mv-neg">${totalSpent.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net Profit</div>
          <div className={`metric-value ${netProfit === 0 ? "mv-neutral" : netProfit > 0 ? "mv-pos" : "mv-neg"}`}>${netProfit.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Combines Passed</div>
          <div className="metric-value mv-neutral">{passed}</div>
        </div>
        {totalSpent > 0 && (
          <div className="metric-card">
            <div className="metric-label">Profit Factor</div>
            <div className={`metric-value ${(totalEarned / totalSpent) >= 1 ? "mv-pos" : "mv-neg"}`}>{(totalEarned / totalSpent).toFixed(2)}</div>
          </div>
        )}
      </div>

      <PNLChart payouts={payouts} spending={spending} />

      {/* Spending Table */}
      {spending.length > 0 && (
        <div className="section" style={{ marginBottom: "12px" }}>
          <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setSpendingCollapsed(!spendingCollapsed)}>
            <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Spending {spendingCollapsed ? "▶" : "▼"}</span>
            <span className="badge">{spending.length}</span>
          </div>
          {!spendingCollapsed && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {spending.map((s, i) => (
                  <tr key={s.id || i}>
                    <td className="date">{s.date ? new Date(s.date).toLocaleDateString() : s.purchaseDate || "—"}</td>
                    <td className="subject-cell">{s.subject || s.productName || "—"}</td>
                    <td className="amount-neg">${(s.amount || s.purchasePrice || s.total || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {/* Payouts Table (Topstep only) */}
      {payouts.length > 0 && (
        <div className="section" style={{ marginBottom: "12px" }}>
          <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setPayoutsCollapsed(!payoutsCollapsed)}>
            <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payouts {payoutsCollapsed ? "▶" : "▼"}</span>
            <span className="badge">{payouts.length}</span>
          </div>
          {!payoutsCollapsed && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Subject</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p, i) => (
                  <tr key={p.id || i}>
                    <td className="date">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="subject-cell">{p.subject || "—"}</td>
                    <td className="amount">${(p.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}
    </div>
  );
}

const US_STATES = [
  { code: "AL", name: "Alabama", rate: 0.05 }, { code: "AK", name: "Alaska", rate: 0 },
  { code: "AZ", name: "Arizona", rate: 0.025 }, { code: "AR", name: "Arkansas", rate: 0.047 },
  { code: "CA", name: "California", rate: 0.133 }, { code: "CO", name: "Colorado", rate: 0.044 },
  { code: "CT", name: "Connecticut", rate: 0.0699 }, { code: "DE", name: "Delaware", rate: 0.066 },
  { code: "FL", name: "Florida", rate: 0 }, { code: "GA", name: "Georgia", rate: 0.055 },
  { code: "HI", name: "Hawaii", rate: 0.11 }, { code: "ID", name: "Idaho", rate: 0.058 },
  { code: "IL", name: "Illinois", rate: 0.0495 }, { code: "IN", name: "Indiana", rate: 0.0305 },
  { code: "IA", name: "Iowa", rate: 0.06 }, { code: "KS", name: "Kansas", rate: 0.057 },
  { code: "KY", name: "Kentucky", rate: 0.045 }, { code: "LA", name: "Louisiana", rate: 0.0425 },
  { code: "ME", name: "Maine", rate: 0.0715 }, { code: "MD", name: "Maryland", rate: 0.0575 },
  { code: "MA", name: "Massachusetts", rate: 0.09 }, { code: "MI", name: "Michigan", rate: 0.0405 },
  { code: "MN", name: "Minnesota", rate: 0.0985 }, { code: "MS", name: "Mississippi", rate: 0.047 },
  { code: "MO", name: "Missouri", rate: 0.048 }, { code: "MT", name: "Montana", rate: 0.059 },
  { code: "NE", name: "Nebraska", rate: 0.0664 }, { code: "NV", name: "Nevada", rate: 0 },
  { code: "NH", name: "New Hampshire", rate: 0 }, { code: "NJ", name: "New Jersey", rate: 0.1075 },
  { code: "NM", name: "New Mexico", rate: 0.059 }, { code: "NY", name: "New York", rate: 0.109 },
  { code: "NC", name: "North Carolina", rate: 0.0450 }, { code: "ND", name: "North Dakota", rate: 0.0290 },
  { code: "OH", name: "Ohio", rate: 0.0399 }, { code: "OK", name: "Oklahoma", rate: 0.0475 },
  { code: "OR", name: "Oregon", rate: 0.099 }, { code: "PA", name: "Pennsylvania", rate: 0.0307 },
  { code: "RI", name: "Rhode Island", rate: 0.0599 }, { code: "SC", name: "South Carolina", rate: 0.064 },
  { code: "SD", name: "South Dakota", rate: 0 }, { code: "TN", name: "Tennessee", rate: 0 },
  { code: "TX", name: "Texas", rate: 0 }, { code: "UT", name: "Utah", rate: 0.0485 },
  { code: "VT", name: "Vermont", rate: 0.0875 }, { code: "VA", name: "Virginia", rate: 0.0575 },
  { code: "WA", name: "Washington", rate: 0 }, { code: "WV", name: "West Virginia", rate: 0.065 },
  { code: "WI", name: "Wisconsin", rate: 0.0765 }, { code: "WY", name: "Wyoming", rate: 0 },
];

const FEDERAL_BRACKETS_SINGLE = [
  { min: 0, max: 12400, rate: 0.10 },
  { min: 12400, max: 50400, rate: 0.12 },
  { min: 50400, max: 105700, rate: 0.22 },
  { min: 105700, max: 201775, rate: 0.24 },
  { min: 201775, max: 256225, rate: 0.32 },
  { min: 256225, max: 640600, rate: 0.35 },
  { min: 640600, max: Infinity, rate: 0.37 },
];

const FEDERAL_BRACKETS_MARRIED = [
  { min: 0, max: 24800, rate: 0.10 },
  { min: 24800, max: 100800, rate: 0.12 },
  { min: 100800, max: 211400, rate: 0.22 },
  { min: 211400, max: 403550, rate: 0.24 },
  { min: 403550, max: 512450, rate: 0.32 },
  { min: 512450, max: 768700, rate: 0.35 },
  { min: 768700, max: Infinity, rate: 0.37 },
];

function calcFederalTax(income, brackets) {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    const taxable = Math.min(income, b.max) - b.min;
    tax += taxable * b.rate;
  }
  return tax;
}

function calcSETax(netIncome) {
  const seTax = Math.min(netIncome, 168600) * 0.153 + Math.max(0, netIncome - 168600) * 0.029;
  return seTax;
}

function TaxesPage({ payouts, spending, onBack, step, setStep, onDownloadClick, results, setResults }) {
  const [filingStatus, setFilingStatus] = useState("single");
  const [state, setState] = useState("FL");
  const [otherIncome, setOtherIncome] = useState("");
  const [homeOffice, setHomeOffice] = useState(false);
  const [homeOfficeSqft, setHomeOfficeSqft] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [retirementContrib, setRetirementContrib] = useState("");
  const [calculationCollapsed, setCalculationCollapsed] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const totalPayouts = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSpending = spending.reduce((sum, s) => sum + (s.amount || s.purchasePrice || s.total || 0), 0);

  const inputStyle = {
    width: "100%", padding: "12px 16px", background: "var(--surface2)",
    border: "1px solid var(--border)", borderRadius: "10px", color: "var(--text)",
    fontFamily: "inherit", fontSize: "14px", boxSizing: "border-box",
  };

  const selectStyle = {
    ...inputStyle,
    paddingRight: "32px",
    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    appearance: "none",
    WebkitAppearance: "none",
  };

  const labelStyle = {
    display: "block", fontSize: "12px", fontWeight: 700, color: "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px",
  };

  const calculate = () => {
    // Check if data has been synced
    if (payouts.length === 0 && spending.length === 0) {
      setSyncError(true);
      // Auto-dismiss after 5 seconds
      setTimeout(() => setSyncError(false), 5000);
      return;
    }
    setSyncError(false);

    const other = parseFloat(otherIncome) || 0;
    const homeOfficeDeduction = Math.min(parseInt(homeOfficeSqft) || 0, 300) * 6;
    const otherDed = parseFloat(otherDeductions) || 0;
    const retirement = parseFloat(retirementContrib) || 0;

    const grossPropIncome = totalPayouts;
    const propDeductions = totalSpending + homeOfficeDeduction + otherDed;
    const netPropIncome = Math.max(0, grossPropIncome - propDeductions);

    const seTax = calcSETax(netPropIncome);
    const seDeduction = seTax / 2;

    const totalIncome = netPropIncome + other - seDeduction - retirement;
    const taxableIncome = Math.max(0, totalIncome);

    const brackets = filingStatus === "married" ? FEDERAL_BRACKETS_MARRIED : FEDERAL_BRACKETS_SINGLE;
    const federalTax = calcFederalTax(taxableIncome, brackets);

    const selectedState = US_STATES.find(s => s.code === state);
    const stateTax = taxableIncome * (selectedState?.rate || 0);

    const totalTax = seTax + federalTax + stateTax;
    const effectiveRate = grossPropIncome > 0 ? (totalTax / grossPropIncome) * 100 : 0;
    const quarterlyPayment = totalTax / 4;
    const perPayout = payouts.length > 0 ? totalTax / payouts.length : 0;

    setResults({
      grossPropIncome, propDeductions, netPropIncome, seTax, seDeduction,
      federalTax, stateTax, totalTax, effectiveRate, quarterlyPayment, perPayout,
      stateName: selectedState?.name || state, taxableIncome, other, retirement,
    });
    setStep(2);
  };

  // Full page form
  if (step === 1) return (
    <div style={{ width: "100%" }}>

      {syncError && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "16px 20px", fontSize: "14px", color: "rgba(252,165,165,0.9)", zIndex: 100, maxWidth: "400px" }}>
          ⚠ Please sync your data first using the "Sync Data" button in the top right to load your payout and challenge fee information.
        </div>
      )}

      {/* Auto-filled summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "32px" }}>
        <div className="metric-card">
          <div className="metric-label">Total Payouts</div>
          <div className="metric-value mv-pos">${totalPayouts.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Challenge Fees</div>
          <div className="metric-value mv-neg">${totalSpending.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net Before Other Deductions</div>
          <div className="metric-value mv-neutral">${Math.max(0, totalPayouts - totalSpending).toFixed(2)}</div>
        </div>
      </div>

      {/* Form sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* Section 1 */}
        <div className="section">
          <div className="section-header">
            <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Personal Info</span>
          </div>
          <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={labelStyle}>Filing Status</label>
              <select value={filingStatus} onChange={e => setFilingStatus(e.target.value)} style={selectStyle}>
                <option value="single">Single</option>
                <option value="married">Married Filing Jointly</option>
                <option value="mfs">Married Filing Separately</option>
                <option value="hoh">Head of Household</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>State of Residence</label>
              <select value={state} onChange={e => setState(e.target.value)} style={selectStyle}>
                {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2 */}
        <div className="section">
          <div className="section-header">
            <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Other Income</span>
          </div>
          <div style={{ padding: "24px" }}>
            <label style={labelStyle}>Other Income This Year</label>
            <input type="text" inputMode="numeric" placeholder="0" value={otherIncome} onChange={e => setOtherIncome(e.target.value.replace(/[^0-9.]/g, ""))} style={inputStyle} />
          </div>
        </div>

        {/* Section 3 */}
        <div className="section">
          <div className="section-header">
            <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Additional Deductions</span>
          </div>
          <div style={{ padding: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
            <div>
              <label style={labelStyle}>SEP IRA / Solo 401k Contributions</label>
              <input type="text" inputMode="numeric" placeholder="0" value={retirementContrib} onChange={e => setRetirementContrib(e.target.value.replace(/[^0-9.]/g, ""))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Other Business Expenses</label>
              <input type="text" inputMode="numeric" placeholder="0" value={otherDeductions} onChange={e => setOtherDeductions(e.target.value.replace(/[^0-9.]/g, ""))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Home Office Deduction</label>
              <input type="text" inputMode="numeric" placeholder="0 SF" value={homeOfficeSqft} onChange={e => setHomeOfficeSqft(e.target.value.replace(/[^0-9]/g, ""))} style={inputStyle} />
            </div>
          </div>
        </div>

        <button onClick={calculate} style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>
          Calculate My Taxes
        </button>
      </div>
    </div>
  );

  // Results page
  if (!results) return null;

  const generateCPADocument = (results) => {
    const payoutsList = payouts.map(p => `<tr><td>${new Date(p.date).toLocaleDateString()}</td><td>${p.firm ? p.firm.charAt(0).toUpperCase() + p.firm.slice(1) : 'Topstep'}</td><td>$${(p.amount || 0).toFixed(2)}</td></tr>`).join('');
    const spendingList = spending.map(s => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${s.firm ? s.firm.charAt(0).toUpperCase() + s.firm.slice(1) : 'Topstep'}</td><td>$${(s.amount || s.purchasePrice || s.total || 0).toFixed(2)}</td></tr>`).join('');

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
    h1 { color: #f97316; font-size: 24px; margin-bottom: 10px; }
    h2 { color: #f97316; font-size: 16px; margin-top: 20px; margin-bottom: 10px; border-bottom: 2px solid #f97316; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f97316; color: white; padding: 10px; text-align: left; }
    td { padding: 8px; border-bottom: 1px solid #ddd; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .summary-item { background: #f5f5f5; padding: 10px; border-radius: 5px; }
    .summary-label { font-size: 12px; color: #666; }
    .summary-value { font-size: 16px; font-weight: bold; color: #f97316; }
    .note { background: #fffbea; padding: 10px; border-left: 4px solid #f97316; margin-top: 20px; font-size: 12px; }
  </style>
</head>
<body>
  <h1 style="font-family: 'Syne', 'Segoe UI', sans-serif; font-size: 36px; font-weight: 800; margin: 0 0 8px 0; line-height: 1; letter-spacing: -0.5px;">Prop<br>Tracker</h1>
  <p style="margin: 0 0 20px 0; color: #666; font-size: 14px;"></p>
  <p>Generated: ${new Date().toLocaleDateString()}</p>

  <h2>Tax Summary</h2>
  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Gross Prop Income</div>
      <div class="summary-value">$${results.grossPropIncome.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Business Deductions</div>
      <div class="summary-value">$${(results.grossPropIncome - results.netPropIncome).toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Net Taxable Income</div>
      <div class="summary-value">$${results.taxableIncome.toFixed(2)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Total Tax Liability</div>
      <div class="summary-value">$${results.totalTax.toFixed(2)}</div>
    </div>
  </div>

  <h2>Payout Transactions</h2>
  <table>
    <tr>
      <th>Date</th>
      <th>Prop Firm</th>
      <th>Amount</th>
    </tr>
    ${payoutsList || '<tr><td colspan="3">No payouts recorded</td></tr>'}
  </table>
  <div style="text-align: right; font-weight: bold; margin-bottom: 20px;">Total Payouts: $${results.grossPropIncome.toFixed(2)}</div>

  <div style="page-break-before: always;"></div>

  <h2>Challenge Fee Transactions</h2>
  <table>
    <tr>
      <th>Date</th>
      <th>Prop Firm</th>
      <th>Amount</th>
    </tr>
    ${spendingList || '<tr><td colspan="3">No challenge fees recorded</td></tr>'}
  </table>
  <div style="text-align: right; font-weight: bold; margin-bottom: 20px;">Total Challenge Fees: $${(results.grossPropIncome - results.netPropIncome - (parseFloat(otherDeductions) || 0) - (Math.min(parseInt(homeOfficeSqft) || 0, 300) * 5)).toFixed(2)}</div>

  <h2>Additional Deductions</h2>
  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Other Business Expenses</div>
      <div class="summary-value">$${parseFloat(otherDeductions) || 0}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Home Office Deduction</div>
      <div class="summary-value">$${Math.min(parseInt(homeOfficeSqft) || 0, 300) * 5}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Retirement Contributions</div>
      <div class="summary-value">$${results.retirement.toFixed(2)}</div>
    </div>
  </div>

  <div class="note">
    <strong>Note:</strong> This documentation is for tax filing purposes. Please ensure all supporting receipts and statements are provided to your CPA.
  </div>
</body>
</html>
    `;

    // Using html2pdf library from CDN
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      const element = document.createElement('div');
      element.innerHTML = htmlContent;
      const opt = {
        margin: 10,
        filename: `Tax_Documentation_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      html2pdf().set(opt).from(element).save();
    };
    document.head.appendChild(script);
  };

  return (
    <div style={{ width: "100%" }} data-results-container>

      {/* Hidden button to trigger PDF download from header */}
      <button data-download-btn onClick={() => generateCPADocument(results)} style={{ display: "none" }}>
        Download Tax Document
      </button>

      {/* Top summary */}
      <div className="metrics-grid" style={{ marginBottom: "24px" }}>
        <div className="metric-card">
          <div className="metric-label">Self-Employment Tax</div>
          <div className={`metric-value ${results.seTax === 0 ? "mv-neutral" : "mv-neg"}`}>${results.seTax.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Federal Income Tax</div>
          <div className={`metric-value ${results.federalTax === 0 ? "mv-neutral" : "mv-neg"}`}>${results.federalTax.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">State Tax</div>
          <div className={`metric-value ${results.stateTax === 0 ? "mv-neutral" : "mv-neg"}`}>${results.stateTax.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Tax Owed</div>
          <div className={`metric-value ${results.totalTax === 0 ? "mv-neutral" : "mv-neg"}`}>${results.totalTax.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Quarterly Payment</div>
          <div className={`metric-value ${results.quarterlyPayment === 0 ? "mv-neutral" : "mv-neutral"}`}>${results.quarterlyPayment.toFixed(2)}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Set Aside Per Payout</div>
          <div className={`metric-value ${results.perPayout === 0 ? "mv-neutral" : "mv-neutral"}`}>${results.perPayout.toFixed(2)}</div>
        </div>
      </div>

      {/* Tax breakdown */}
      <div className="section" style={{ marginBottom: "16px" }}>
        <div className="section-header" style={{ cursor: "pointer" }} onClick={() => setCalculationCollapsed(!calculationCollapsed)}>
          <span className="section-title" style={{ color: "#f97316", fontSize: "14px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>How It's Calculated {calculationCollapsed ? "▶" : "▼"}</span>
        </div>
        {!calculationCollapsed && (
        <div style={{ padding: "20px" }}>
          {[
            { label: "Gross Prop Income", value: results.grossPropIncome, sign: "", color: "var(--green)" },
            { label: "Challenge Fees Deduction", value: -totalSpending, sign: "", color: "var(--red)" },
            { label: "Other Business Expenses", value: -(parseFloat(otherDeductions) || 0), sign: "", color: "var(--red)" },
            { label: "Home Office Deduction", value: -(Math.min(parseInt(homeOfficeSqft) || 0, 300) * 6), sign: "", color: "var(--red)" },
            { label: "Net Prop Income", value: results.netPropIncome, sign: "", color: "#f97316", bold: true },
            { label: "Other Income", value: results.other, sign: "", color: "var(--green)" },
            { label: "SE Tax Deduction", value: -results.seDeduction, sign: "", color: "var(--red)" },
            { label: "Retirement Contributions", value: -results.retirement, sign: "", color: "var(--red)" },
            { label: "Total Taxable Income", value: results.taxableIncome, sign: "", color: "#f97316", bold: true },
          ].filter(r => r.value !== 0).map((row, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "13px", color: row.bold ? row.color : "#fff", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 700, color: row.color, fontFamily: "monospace" }}>
                {row.value < 0 ? "-" : ""}${Math.abs(row.value).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>


      <div style={{ background: "rgba(249,115,22,0.05)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "10px", padding: "16px 20px", fontSize: "12px", color: "var(--muted)", lineHeight: 1.7 }}>
        ⚠ This is an estimate for educational purposes only. Tax laws vary by individual situation. Consult a qualified CPA or tax professional before filing. Challenge fee deductibility depends on whether your trading qualifies as a business activity.
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: sessionReal, status } = useSession();
  const isDev = process.env.NODE_ENV === "development";
  const session = isDev && !sessionReal ? { user: { name: "Dev User", image: null, email: "dev@test.com" } } : sessionReal;

  // Auto-trigger Google sign-in when coming from marketing site login
  useEffect(() => {
    if (status === "loading") return;
    if (!session && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("autoLogin") === "1") {
        // Remove the param from URL cleanly
        const url = new URL(window.location.href);
        url.searchParams.delete("autoLogin");
        window.history.replaceState({}, "", url.toString());
        // Auto sign in with Google — since they just authed, no second prompt
        signIn("google", { callbackUrl: window.location.href });
      }
    }
  }, [status, session]);

  const [data, setData] = useState({ combines: [], spending: [], payouts: [], closed: [], lucidPayouts: [], firmData: { topstep: false, mff: false, lucid: false, apex: false } });
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState({ topstep: false, mff: false, lucid: false, apex: false });
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeFirm, setActiveFirm] = useState(null);
  const [taxStep, setTaxStep] = useState(1);
  const [taxResults, setTaxResults] = useState(null);
  const [savedJournals, setSavedJournals] = useState({});
  const [journalsHydrated, setJournalsHydrated] = useState(false);

  const [collapsedEntries, setCollapsedEntries] = useState({});
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryData, setNewEntryData] = useState({ instrument: "", direction: "Long", pnl: "", firm: "", time: "", setupType: "", notes: "", tags: [], discipline: "", image: null });
  const [formErrors, setFormErrors] = useState({});
  const [editingEntry, setEditingEntry] = useState(null); // { date, entryIdx }
  const [lightboxImage, setLightboxImage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const analyticsUploadRef = useRef(null);
  const [touchStart, setTouchStart] = useState(0);
  const [mouseDown, setMouseDown] = useState(false);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    if (diff > 50) {
      setSidebarOpen(false);
    }
  };

  const handleMouseDown = (e) => {
    if (sidebarOpen && e.clientX < 250) {
      setMouseDown(true);
      setTouchStart(e.clientX);
    }
  };

  const handleMouseUp = (e) => {
    if (mouseDown) {
      const diff = touchStart - e.clientX;
      if (diff > 50) {
        setSidebarOpen(false);
      }
      setMouseDown(false);
    }
  };

  // Load journals — Supabase first, localStorage fallback
  useEffect(() => {
    async function loadJournals() {
      try {
        const res = await fetch("/api/journals");
        if (res.ok) {
          const data = await res.json();
          if (data && !data.error && Object.keys(data).length > 0) {
            setSavedJournals(data);
            // Sync to localStorage as backup
            try { localStorage.setItem("journals", JSON.stringify(data)); } catch(e) {}
            setJournalsHydrated(true);
            return;
          }
        }
      } catch(e) {}
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem("journals");
        if (saved) setSavedJournals(JSON.parse(saved));
      } catch(e) {}
      setJournalsHydrated(true);
    }
    loadJournals();
  }, []);

  // Save to Supabase + localStorage whenever savedJournals changes (only after hydration)
  useEffect(() => {
    if (!journalsHydrated) return;
    // Save to localStorage immediately
    try { localStorage.setItem("journals", JSON.stringify(savedJournals)); } catch(e) {}
    // Save to Supabase (debounced via async fire-and-forget)
    const timer = setTimeout(() => {
      fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedJournals),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(timer);
  }, [savedJournals, journalsHydrated]);

  const fetchFirm = async (firmKey) => {
    setError(null);
    setFirmLoading(prev => ({ ...prev, [firmKey]: true }));
    try {
      const endpoints = {
        topstep: [fetch("/api/combines"), fetch("/api/spending"), fetch("/api/payouts"), fetch("/api/closed")],
        mff: [fetch("/api/mff/combines"), fetch("/api/mff/spending")],
        lucid: [fetch("/api/lucid/combines"), fetch("/api/lucid/spending"), fetch("/api/lucid/payouts")],
      };
      if (firmKey === "topstep") {
        const [combinesRes, spendingRes, payoutsRes, closedRes] = await Promise.all(endpoints.topstep);
        const [combinesData, spendingData, payoutsData, closedData] = await Promise.all([combinesRes.json(), spendingRes.json(), payoutsRes.json(), closedRes.json()]);
        setData(prev => ({
          ...prev,
          combines: [...prev.combines.filter(e => e.firm !== "topstep"), ...(combinesData.emails || []).map(e => ({ ...e, firm: "topstep" }))],
          spending: [...prev.spending.filter(e => e.firm !== "topstep"), ...(spendingData.emails || []).map(e => ({ ...e, firm: "topstep" }))],
          payouts: payoutsData.emails || [],
          closed: closedData.emails || [],
          firmData: { ...prev.firmData, topstep: true },
        }));
      } else if (firmKey === "mff") {
        const [combinesRes, spendingRes] = await Promise.all(endpoints.mff);
        const [combinesData, spendingData] = await Promise.all([combinesRes.json(), spendingRes.json()]);
        setData(prev => ({
          ...prev,
          combines: [...prev.combines.filter(e => e.firm !== "mff"), ...(combinesData.emails || []).map(e => ({ ...e, firm: "mff" }))],
          spending: [...prev.spending.filter(e => e.firm !== "mff"), ...(spendingData.emails || []).map(e => ({ ...e, firm: "mff" }))],
          firmData: { ...prev.firmData, mff: true },
        }));
      } else if (firmKey === "lucid") {
        const [combinesRes, spendingRes, payoutsRes] = await Promise.all(endpoints.lucid);
        const [combinesData, spendingData, payoutsData] = await Promise.all([combinesRes.json(), spendingRes.json(), payoutsRes.ok ? payoutsRes.json() : { emails: [] }]);
        setData(prev => ({
          ...prev,
          combines: [...prev.combines.filter(e => e.firm !== "lucid"), ...(combinesData.emails || []).map(e => ({ ...e, firm: "lucid" }))],
          spending: [...prev.spending.filter(e => e.firm !== "lucid"), ...(spendingData.emails || []).map(e => ({ ...e, firm: "lucid" }))],
          lucidPayouts: (payoutsData.emails || []),
          firmData: { ...prev.firmData, lucid: true },
        }));
      } else if (firmKey === "apex") {
        const [combinesRes, spendingRes] = await Promise.all([fetch("/api/apex/combines"), fetch("/api/apex/spending")]);
        const [combinesData, spendingData] = await Promise.all([combinesRes.json(), spendingRes.json()]);
        setData(prev => ({
          ...prev,
          combines: [...prev.combines.filter(e => e.firm !== "apex"), ...(combinesData.emails || []).map(e => ({ ...e, firm: "apex" }))],
          spending: [...prev.spending.filter(e => e.firm !== "apex"), ...(spendingData.emails || []).map(e => ({ ...e, firm: "apex" }))],
          firmData: { ...prev.firmData, apex: true },
        }));
      }
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setFirmLoading(prev => ({ ...prev, [firmKey]: false }));
    }
  };

  const fetchAllData = async () => {
    setError(null);
    setLoading(true);
    setFirmLoading({ topstep: true, mff: true, lucid: true, apex: true });
    try {
      const [combinesRes, spendingRes, payoutsRes, closedRes, mffCombinesRes, mffSpendingRes, lucidCombinesRes, lucidSpendingRes, lucidPayoutsRes, apexCombinesRes, apexSpendingRes] = await Promise.all([
        fetch("/api/combines"),
        fetch("/api/spending"),
        fetch("/api/payouts"),
        fetch("/api/closed"),
        fetch("/api/mff/combines"),
        fetch("/api/mff/spending"),
        fetch("/api/lucid/combines"),
        fetch("/api/lucid/spending"),
        fetch("/api/lucid/payouts"),
        fetch("/api/apex/combines"),
        fetch("/api/apex/spending"),
      ]);
      if (!combinesRes.ok || !spendingRes.ok || !payoutsRes.ok || !closedRes.ok) throw new Error("Failed to fetch data");
      const [combinesData, spendingData, payoutsData, closedData, mffCombinesData, mffSpendingData, lucidCombinesData, lucidSpendingData, lucidPayoutsData, apexCombinesData, apexSpendingData] = await Promise.all([
        combinesRes.json(), spendingRes.json(), payoutsRes.json(), closedRes.json(),
        mffCombinesRes.ok ? mffCombinesRes.json() : { emails: [] },
        mffSpendingRes.ok ? mffSpendingRes.json() : { emails: [] },
        lucidCombinesRes.ok ? lucidCombinesRes.json() : { emails: [] },
        lucidSpendingRes.ok ? lucidSpendingRes.json() : { emails: [] },
        lucidPayoutsRes.ok ? lucidPayoutsRes.json() : { emails: [] },
        apexCombinesRes.ok ? apexCombinesRes.json() : { emails: [] },
        apexSpendingRes.ok ? apexSpendingRes.json() : { emails: [] },
      ]);
      setData({
        combines: [
          ...(combinesData.emails || []).map(e => ({ ...e, firm: "topstep" })),
          ...(mffCombinesData.emails || []).map(e => ({ ...e, firm: "mff" })),
          ...(lucidCombinesData.emails || []).map(e => ({ ...e, firm: "lucid" })),
          ...(apexCombinesData.emails || []).map(e => ({ ...e, firm: "apex" })),
        ],
        spending: [
          ...(spendingData.emails || []).map(e => ({ ...e, firm: "topstep" })),
          ...(mffSpendingData.emails || []).map(e => ({ ...e, firm: "mff" })),
          ...(lucidSpendingData.emails || []).map(e => ({ ...e, firm: "lucid" })),
          ...(apexSpendingData.emails || []).map(e => ({ ...e, firm: "apex" })),
        ],
        payouts: [
          ...(payoutsData.emails || []).map(e => ({ ...e, firm: "topstep" })),
          ...(lucidPayoutsData.emails || []).map(e => ({ ...e, firm: "lucid" })),
        ],
        closed: closedData.emails || [],
        lucidPayouts: lucidPayoutsData.emails || [],
        firmData: { topstep: true, mff: true, lucid: true, apex: true },
      });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setFirmLoading({ topstep: false, mff: false, lucid: false, apex: false });
    }
  };

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)" }}>
        <div className="spinner" style={{ width: "32px", height: "32px", borderWidth: "3px" }} />
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "hidden" }}>
        <canvas id="flow-bg" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} ref={el => {
          if (!el) return;
          const ctx = el.getContext("2d");
          const resize = () => { el.width = window.innerWidth; el.height = window.innerHeight; };
          resize();
          window.addEventListener("resize", resize);
          const orbs = [
            { px: 0.1, py: 0.15, sx: 0.0008, sy: 0.0006, wobbleX: 0, wobbleY: 1, wobbleSpeedX: 0.003, wobbleSpeedY: 0.002, wobbleAmp: 0.05, size: 0.35, color: "90,30,3", opacity: 0.35 },
            { px: 0.85, py: 0.7, sx: -0.0007, sy: -0.0005, wobbleX: 2, wobbleY: 0.5, wobbleSpeedX: 0.004, wobbleSpeedY: 0.003, wobbleAmp: 0.04, size: 0.18, color: "100,40,5", opacity: 0.3 },
            { px: 0.5, py: 0.9, sx: 0.0006, sy: -0.0008, wobbleX: 1, wobbleY: 3, wobbleSpeedX: 0.002, wobbleSpeedY: 0.004, wobbleAmp: 0.06, size: 0.28, color: "120,50,8", opacity: 0.32 },
            { px: 0.2, py: 0.75, sx: -0.0009, sy: 0.0007, wobbleX: 3, wobbleY: 2, wobbleSpeedX: 0.005, wobbleSpeedY: 0.003, wobbleAmp: 0.03, size: 0.12, color: "140,60,10", opacity: 0.28 },
          ];
          function draw() {
            const W = el.width, H = el.height;
            ctx.clearRect(0, 0, W, H);
            ctx.fillStyle = "#0a0a0b";
            ctx.fillRect(0, 0, W, H);
            for (const orb of orbs) {
              orb.px += orb.sx; orb.py += orb.sy;
              orb.wobbleX += orb.wobbleSpeedX; orb.wobbleY += orb.wobbleSpeedY;
              if (orb.px > 1.3) orb.px = -0.3;
              if (orb.px < -0.3) orb.px = 1.3;
              if (orb.py > 1.3) orb.py = -0.3;
              if (orb.py < -0.3) orb.py = 1.3;
              const x = W * (orb.px + Math.sin(orb.wobbleX) * orb.wobbleAmp);
              const y = H * (orb.py + Math.cos(orb.wobbleY) * orb.wobbleAmp);
              const r = Math.min(W, H) * orb.size;
              const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
              grad.addColorStop(0, `rgba(${orb.color},${orb.opacity})`);
              grad.addColorStop(0.5, `rgba(${orb.color},${orb.opacity * 0.4})`);
              grad.addColorStop(1, `rgba(${orb.color},0)`);
              ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
              ctx.fillStyle = grad; ctx.fill();
            }
            requestAnimationFrame(draw);
          }
          draw();
        }} />
        <div style={{ width: "100%", maxWidth: "400px", padding: "2rem", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div style={{ cursor: "pointer", display: "flex", flexDirection: "column" }} onClick={() => { setActiveTab("dashboard"); setActiveFirm(null); setShowAddEntryModal(false); }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#f97316", marginBottom: "12px" }}>
              <span style={{ width: "8px", height: "8px", background: "#f97316", borderRadius: "50%", display: "inline-block", flexShrink: 0 }}></span>
              Prop Trading
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: "6px" }}>Prop Tracker</h1>
            <p style={{ fontSize: "13px", color: "#f97316", marginBottom: "1.5rem", lineHeight: 1.6 }}>Track combines &amp; payouts across all your prop firms</p>
          </div>
          <button className="google-btn" onClick={() => signIn("google")}>
            <svg viewBox="0 0 48 48" width="20" height="20">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  const { combines, spending, payouts, closed } = data;
  const standardCombines = combines.filter((c) => c.type === "Standard").length;
  const expressCombines = combines.filter((c) => c.type === "Express").length;
  const totalSpent = spending.reduce((sum, s) => sum + (s.amount || 0), 0);
  const totalEarned = payouts.reduce((sum, p) => sum + (p.amount || 0), 0);
  const netProfit = totalEarned - totalSpent;

  const navItem = (tab, label, icon) => (
    <div className={`nav-item ${activeTab === tab && !activeFirm ? "active" : ""}`} onClick={() => { setActiveTab(tab); setActiveFirm(null); setShowAddEntryModal(false); }} style={{ color: "#fff" }}>
      {icon}
      {label}
    </div>
  );

  return (
    <div style={{ display: "flex" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: "fixed",
          top: "24px",
          left: "24px",
          background: "none",
          border: "none",
          cursor: "pointer",
          zIndex: "1001",
          padding: "8px",
          display: sidebarOpen ? "none" : "block"
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" width="24" height="24">
          <line x1="3" y1="6" x2="21" y2="6"/>
          <line x1="3" y1="12" x2="21" y2="12"/>
          <line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="sidebar" style={{ transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.3s ease", position: "fixed", height: "100vh", zIndex: "999", width: "212px", display: "flex", flexDirection: "column" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sidebar-brand" onClick={() => { setActiveTab("dashboard"); setActiveFirm(null); setShowAddEntryModal(false); }} style={{ cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "38px", color: "#fff", letterSpacing: "1px", lineHeight: 1 }}>PROP</span>
              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "38px", background: "linear-gradient(90deg,#ef4444,#f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", letterSpacing: "1px", lineHeight: 1 }}>DESK</span>
            </div>
        </div>
        <nav className="sidebar-nav" style={{ flex: 1 }}>
          <div className="nav-section-label">Overview</div>
          {navItem("dashboard", "Dashboard", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)}
          {navItem("firms", "Firms", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>)}
          <div className="nav-section-label">Trading</div>
          {navItem("calendar", "Calendar", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>)}
          {navItem("journal", "Journal", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>)}
          {navItem("analytics", "Analytics", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>)}
          {navItem("intelligence", "Strategy Tracking", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>)}
          <div className="nav-section-label">Finance</div>
          {navItem("taxes", "Taxes", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="12" y1="12" x2="12" y2="18"/></svg>)}
        </nav>

        {/* User profile at bottom */}
        {session?.user && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0, background: "rgba(0,0,0,0.2)" }}>
            <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", paddingLeft: "40px" }}>
              {session.user.image ? (
                <img src={session.user.image} alt="" style={{ width: "30px", height: "30px", borderRadius: "50%", flexShrink: 0 }} />
              ) : (
                <svg viewBox="0 0 24 24" width="20" height="20" style={{ flexShrink: 0 }}><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{session.user.name}</div>
              </div>
            </div>
            <div style={{ padding: "0 12px 12px" }}>
              <button
                onClick={() => signOut({ callbackUrl: "https://www.propdesk.io" })}
                style={{ width: "100%", padding: "7px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "rgba(255,255,255,0.45)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", transition: "all 0.15s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(249,115,22,0.12)"; e.currentTarget.style.borderColor = "rgba(249,115,22,0.35)"; e.currentTarget.style.color = "#f97316"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
              >
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="main-content" style={{ marginLeft: sidebarOpen ? "212px" : "0", width: sidebarOpen ? "calc(100% - 212px)" : "100%", transition: "all 0.3s ease" }}>
        <div className="page-header" style={{ display: activeTab === "intelligence" ? "none" : undefined }}>
          <div style={{ marginLeft: sidebarOpen ? "0px" : "40px" }}>
            {activeFirm ? (
              <button onClick={() => setActiveFirm(null)} style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
            ) : activeTab === "taxes" && taxStep === 2 ? (
              <button onClick={() => setTaxStep(1)} style={{ background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
            ) : (
              <div>
                <h1 className="page-title">{activeTab === "taxes" ? "Tax Estimator" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
                {activeTab === "taxes" && <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "8px" }}>This is not tax advice. Consult a CPA for your specific situation.</p>}
              </div>
            )}
            {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}
          </div>
          {activeTab === "journal" && Object.values(savedJournals).some(e => Array.isArray(e) && e.length > 0) ? (
            <button className="btn-primary" onClick={() => setShowAddEntryModal(true)}>
              Add Entry
            </button>
          ) : activeTab === "journal" ? null : activeTab === "analytics" ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <input ref={analyticsUploadRef} type="file" accept=".csv" multiple style={{ display: "none" }} onChange={e => { if (analyticsUploadRef.current) analyticsUploadRef.current._cb && analyticsUploadRef.current._cb(e.target.files); }} />
              <button className="btn-primary" onClick={() => analyticsUploadRef.current?.click()}>
                + Add CSV
              </button>
              <button
                onClick={() => analyticsUploadRef.current?._resetCb && analyticsUploadRef.current._resetCb()}
                className="btn-primary"
                style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(249,115,22,0.5)"; e.currentTarget.style.color = "#f97316"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)"; }}>
                Clear All
              </button>
            </div>
          ) : activeTab === "taxes" && taxStep === 2 ? (
            <button className="btn-primary" onClick={() => {
              // Find the generate function in TaxesPage and call it
              const pdfBtn = document.querySelector('[data-download-btn]');
              if (pdfBtn) {
                pdfBtn.click();
              }
            }}>
              Download Tax Document
            </button>
          ) : (
            <button className="btn-primary" onClick={fetchAllData} disabled={loading}>
              {loading ? "Syncing..." : "Sync Data"}
            </button>
          )}
        </div>

        {activeTab === "intelligence" && <IntelligencePage sidebarOpen={sidebarOpen} />}
        <div className="page-body" style={{ display: activeTab === "intelligence" ? "none" : undefined }}>
          {error && <div className="error">⚠ {error}</div>}

          {activeFirm ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{FIRMS.find(f => f.firmKey === activeFirm)?.logo}</div>
                <h1 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.5px" }}>{FIRMS.find(f => f.firmKey === activeFirm)?.name}</h1>
              </div>
              <FirmDetailPage firmKey={activeFirm} data={data} onBack={() => setActiveFirm(null)} />
            </>
          ) : (
          <>

          {activeTab === "dashboard" && (
            <>
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-label">Total Earned</div>
                  <div className="metric-value mv-pos">${totalEarned.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total Spent</div>
                  <div className="metric-value mv-neg">${totalSpent.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Net Profit</div>
                  <div className={`metric-value ${netProfit === 0 ? "mv-neutral" : netProfit > 0 ? "mv-pos" : "mv-neg"}`}>${netProfit.toFixed(2)}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Combines Passed</div>
                  <div className="metric-value mv-neutral">{combines.filter(c => !c.status || c.status === "Passed" || c.status === "Standard" || c.status === "Express").length}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Profit Factor</div>
                  <div className={`metric-value ${totalSpent === 0 ? "mv-neutral" : (totalEarned / totalSpent) >= 1 ? "mv-pos" : "mv-neg"}`}>
                    {totalSpent === 0 ? "—" : (totalEarned / totalSpent).toFixed(2)}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: "16px" }}><FirmsGrid onSyncFirm={fetchFirm} onSyncAll={fetchAllData} onViewFirm={setActiveFirm} onClearFirm={(firmKey) => setData(prev => ({ ...prev, combines: prev.combines.filter(e => e.firm !== firmKey), spending: prev.spending.filter(e => e.firm !== firmKey), payouts: firmKey === "topstep" ? [] : prev.payouts, closed: firmKey === "topstep" ? [] : prev.closed, firmData: { ...prev.firmData, [firmKey]: false } }))} loading={loading} firmLoading={firmLoading} firmData={data.firmData} /></div>
              <PNLChart payouts={payouts} spending={spending} />
            </>
          )}

          {activeTab === "firms" && <FirmsGrid onSyncFirm={fetchFirm} onSyncAll={fetchAllData} onViewFirm={setActiveFirm} onClearFirm={(firmKey) => setData(prev => ({ ...prev, combines: prev.combines.filter(e => e.firm !== firmKey), spending: prev.spending.filter(e => e.firm !== firmKey), payouts: firmKey === "topstep" ? [] : prev.payouts, closed: firmKey === "topstep" ? [] : prev.closed, firmData: { ...prev.firmData, [firmKey]: false } }))} loading={loading} firmLoading={firmLoading} firmData={data.firmData} />}

          {activeTab === "calendar" && <CalendarPage payouts={payouts} spending={spending} savedJournals={savedJournals} setSavedJournals={setSavedJournals} session={session} />}
          {activeTab === "journal" && !journalsHydrated && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "200px" }}>
              <div className="spinner" />
            </div>
          )}
          {activeTab === "journal" && journalsHydrated && !Object.values(savedJournals).some(e => Array.isArray(e) && e.length > 0) && (
            <div style={{ position: "relative", minHeight: "100vh", overflow: "hidden" }}>
              <div style={{ filter: "blur(5px)", opacity: 0.35, pointerEvents: "none", userSelect: "none", position: "absolute", inset: 0, padding: "0 0 40px" }}>
                {/* Stat cards at top */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "20px" }}>
                  {[["Net P&L","+$8,420","var(--green)"],["Win Rate","61%","var(--green)"],["Avg Discipline","7.2/10","var(--orange)"]].map(([l,v,c]) => (
                    <div key={l} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderBottom: "2px solid #f97316", borderRadius: "10px", padding: "1rem 1.25rem" }}>
                      <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted)", marginBottom: "10px", fontWeight: 600 }}>{l}</div>
                      <div style={{ fontSize: "24px", fontWeight: 700, color: c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {/* Date group header */}
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}>Today — May 31, 2026</div>
                {[
                  { instrument: "NQ Long", pnl: 1240, outcome: "Win", firm: "Topstep 50K", time: "9:42 AM", setupType: "Breakout", notes: "Waited patiently for the setup. Watched the level hold for 12 minutes before entering on confirmation. Held through the first pullback even though it was uncomfortable. Took profit at the measured move target — no early exit, no second-guessing. This is exactly how I need to be trading every single day.", tags: ["Calm","Breakout","Followed Plan","Focused"], discipline: 9 },
                  { instrument: "NQ Short", pnl: -380, outcome: "Loss", firm: "Topstep 50K", time: "10:15 AM", setupType: "Revenge trade", notes: "Jumped back in immediately after the stop out. No setup, no plan, just wanted to make the money back. Knew it was wrong the moment I clicked the button but did it anyway. Classic revenge trade. Need to walk away after a loss and reset instead of forcing it.", tags: ["Revenge","FOMO","Off Plan","Impulsive"], discipline: 2 },
                  { instrument: "ES Long", pnl: 875, outcome: "Win", firm: "Apex 150K", time: "8:35 AM", setupType: "Pullback", notes: "Clean pullback to the 8 EMA on the 5-minute chart. Waited for the candle close to confirm, then entered with a tight stop just below the low. Hit the first target at 1:1 and trailed the rest to 2.5R. Textbook execution. The pre-market prep paid off — had this level marked the night before.", tags: ["Focused","Pullback","Disciplined","Patient"], discipline: 8 },
                  { instrument: "MNQ Short", pnl: -210, outcome: "Loss", firm: "Topstep 50K", time: "11:02 AM", setupType: "Scalp", notes: "Felt anxious after missing the big ES move. Forced a scalp on MNQ with no real confluence. The setup was marginal at best — I just needed to be in a trade. Stopped out for a small loss. The loss itself is fine, the reason for taking it is not.", tags: ["Anxious","Impulsive","Off Plan"], discipline: 3 },
                  { instrument: "NQ Long", pnl: 2100, outcome: "Win", firm: "Apex 150K", time: "9:15 AM", setupType: "Breakout", notes: "Best trade of the week by far. The open range breakout setup was clean — high volume, strong momentum, clean level. Sized in full and held through two pullbacks. Exited at the daily target. Felt completely calm the entire time. This is what peak performance feels like — I need to bottle this mindset.", tags: ["Confident","Breakout","Followed Plan","Calm"], discipline: 10 },
                  { instrument: "ES Short", pnl: 0, outcome: "BE", firm: "Topstep 50K", time: "1:45 PM", setupType: "Reversal", notes: "Saw a potential afternoon reversal setup but conviction wasn't strong enough. Entered half size and scratched it at breakeven when price action didn't confirm. No shame in a breakeven — protecting capital in low-conviction trades is good risk management.", tags: ["Patient","Reversal","Disciplined"], discipline: 7 },
                  { instrument: "NQ Long", pnl: -540, outcome: "Loss", firm: "Apex 150K", time: "2:30 PM", setupType: "Pullback", notes: "Should have stopped trading after the morning session. The afternoon chop got me. Took a pullback trade that looked similar to the morning setup but market conditions had completely changed. Overtraded today — morning was great but gave back too much in the PM session.", tags: ["Frustrated","Overconfident","Off Plan"], discipline: 3 },
                  { instrument: "MES Long", pnl: 320, outcome: "Win", firm: "Topstep 50K", time: "10:00 AM", setupType: "Scalp", notes: "Quick scalp on the 9:30 open momentum. In and out in under 3 minutes. No drama, no overthinking. Exactly what the plan called for on a news day — small size, defined risk, take the quick move and step aside. More of this please.", tags: ["Calm","Scalp","Focused","Followed Plan"], discipline: 8 },
                ].map((entry, i) => (
                  <div key={i} style={{ border: `1px solid ${entry.pnl > 0 ? "rgba(0,217,126,0.2)" : entry.pnl < 0 ? "rgba(239,68,68,0.2)" : "var(--border)"}`, borderRadius: "12px", padding: "20px", background: "var(--surface)", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 800 }}>{entry.instrument} <span style={{ color: entry.pnl > 0 ? "var(--green)" : entry.pnl < 0 ? "var(--red)" : "var(--orange)" }}>· {entry.pnl > 0 ? "+" : ""}{entry.pnl !== 0 ? "$" : ""}{entry.pnl !== 0 ? Math.abs(entry.pnl).toLocaleString() : "BE"}</span></span>
                      <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: entry.outcome === "Win" ? "var(--green-dim)" : entry.outcome === "Loss" ? "var(--red-dim)" : "var(--orange-dim)", color: entry.outcome === "Win" ? "var(--green)" : entry.outcome === "Loss" ? "var(--red)" : "var(--orange)" }}>{entry.outcome}</span>
                      <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--muted)" }}>Discipline: <span style={{ fontWeight: 700, color: entry.discipline >= 8 ? "var(--green)" : entry.discipline >= 5 ? "var(--orange)" : "var(--red)" }}>{entry.discipline}/10</span></span>
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>{entry.time} · {entry.firm} · {entry.setupType}</div>
                    <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px", lineHeight: 1.7 }}>{entry.notes}</div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {entry.tags.map(tag => { const isPos = ["Calm","Focused","Confident","Patient","Disciplined","Followed Plan"].includes(tag); const isNeg = ["Revenge","FOMO","Overconfident","Anxious","Frustrated","Impulsive","Off Plan"].includes(tag); return <span key={tag} style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: isPos ? "var(--green-dim)" : isNeg ? "var(--red-dim)" : "var(--orange-dim)", color: isPos ? "var(--green)" : isNeg ? "var(--red)" : "var(--orange)", border: `1px solid ${isPos ? "rgba(0,217,126,0.2)" : isNeg ? "rgba(239,68,68,0.2)" : "rgba(249,115,22,0.2)"}` }}>{tag}</span>; })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", paddingBottom: "180px" }}>
                <div style={{ background: "var(--surface)", border: "1px solid rgba(249,115,22,0.35)", borderRadius: "20px", padding: "48px 52px", maxWidth: "520px", width: "100%", textAlign: "center", boxShadow: "0 0 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(249,115,22,0.08)" }}>
                  <div style={{ fontSize: "9px", color: "#f97316", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, marginBottom: "10px" }}>Trade Journal</div>
                  <h2 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "12px", lineHeight: 1.2 }}>Journal Your First<br/>Trade</h2>
                  <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "28px", lineHeight: 1.7 }}>Track every trade with notes, emotions, tags, and images. Get instant insights on your discipline and patterns.</p>
                  <button onClick={() => setShowAddEntryModal(true)} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.02em", boxShadow: "0 4px 20px rgba(249,115,22,0.3)" }}>
                    Journal Your First Trade
                  </button>
                </div>
              </div>
            </div>
          )}
          {activeTab === "journal" && journalsHydrated && Object.values(savedJournals).some(e => Array.isArray(e) && e.length > 0) && (() => {
            const allEntries = Object.entries(savedJournals).flatMap(([date, entries]) =>
              Array.isArray(entries) ? entries.map(e => ({ ...e, _date: date })) : []
            );
            // Compute insights
            const disciplineScores = allEntries.map(e => Number(e.discipline)).filter(n => !isNaN(n) && n > 0);
            const avgDiscipline = disciplineScores.length ? (disciplineScores.reduce((a,b)=>a+b,0)/disciplineScores.length).toFixed(1) : null;
            const tagCounts = {};
            allEntries.forEach(e => (e.tags||[]).forEach(t => { tagCounts[t] = (tagCounts[t]||0)+1; }));
            const emotionTags = ["Calm","Focused","Confident","Patient","Disciplined"];
            const negativeTags = ["Revenge","FOMO","Overconfident","Anxious","Frustrated","Impulsive"];
            const bestEmotion = Object.entries(tagCounts).filter(([t])=>emotionTags.includes(t)).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
            const worstPattern = Object.entries(tagCounts).filter(([t])=>negativeTags.includes(t)).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
            const disciplineColor = avgDiscipline >= 8 ? "var(--green)" : avgDiscipline >= 5 ? "var(--orange)" : "var(--red)";
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Insight cards — always shown */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", fontWeight: 600 }}>Avg Discipline</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: avgDiscipline ? disciplineColor : "var(--muted2)" }}>{avgDiscipline ? `${avgDiscipline} / 10` : "—"}</div>
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", fontWeight: 600 }}>Best Emotion</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: bestEmotion ? "var(--green)" : "var(--muted2)" }}>{bestEmotion || "—"}</div>
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px 24px", textAlign: "center" }}>
                    <div style={{ fontSize: "10px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px", fontWeight: 600 }}>Worst Pattern</div>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: worstPattern ? "var(--red)" : "var(--muted2)" }}>{worstPattern || "—"}</div>
                  </div>
                </div>
                {/* Trade cards grouped by date */}
                {Object.entries(savedJournals).sort((a,b) => new Date(a[0]) - new Date(b[0])).map(([date, entries]) => {
                  if (!Array.isArray(entries) || entries.length === 0) return null;
                  const dayPnl = entries.reduce((sum,e) => sum + (parseFloat(e.pnl)||0), 0);
                  return (
                    <div key={date}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--muted2)" }}>{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: 700, color: dayPnl >= 0 ? "var(--green)" : "var(--red)" }}>{dayPnl >= 0 ? "+" : ""}{dayPnl >= 0 ? "$" : "-$"}{Math.abs(dayPnl).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:0})}</span>
                      </div>
                      {entries.map((entry, entryIdx) => {
                        const pnl = parseFloat(entry.pnl) || 0;
                        const isWin = pnl > 0;
                        const isLoss = pnl < 0;
                        const isBE = pnl === 0 && entry.pnl !== "";
                        const borderColor = isWin ? "rgba(0,217,126,0.25)" : isLoss ? "rgba(239,68,68,0.25)" : "var(--border)";
                        const outcomeColor = isWin ? "var(--green)" : isLoss ? "var(--red)" : "var(--orange)";
                        const outcomeBg = isWin ? "var(--green-dim)" : isLoss ? "var(--red-dim)" : "var(--orange-dim)";
                        const outcomeLabel = isWin ? "Win" : isLoss ? "Loss" : isBE ? "BE" : null;
                        return (
                          <div key={entryIdx} style={{ border: `1px solid ${borderColor}`, borderRadius: "12px", padding: "18px 20px", background: "var(--surface)", marginBottom: "10px", position: "relative" }}>
                            <div style={{ position: "absolute", top: "14px", right: "14px", display: "flex", gap: "8px" }}>
                              <button onClick={() => {
                              setEditingEntry({ date, entryIdx });
                              setNewEntryDate(new Date(date).toISOString().split('T')[0]);
                              setNewEntryData({ ...entry, tags: entry.tags || [] });
                              setFormErrors({});
                              setShowAddEntryModal(true);
                            }} style={{ background: "var(--orange-dim)", color: "var(--orange)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "6px", padding: "5px 14px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.03em" }}>Edit</button>
                              <button onClick={() => setSavedJournals(prev => { const updated = { ...prev, [date]: prev[date].filter((_,i) => i !== entryIdx) }; if (updated[date].length === 0) delete updated[date]; return updated; })} style={{ background: "var(--red-dim)", color: "var(--red)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", padding: "5px 14px", fontSize: "11px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, letterSpacing: "0.03em" }}>Delete</button>
                            </div>
                            {/* Header row */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap", paddingRight: "140px" }}>
                              <span style={{ fontSize: "16px", fontWeight: 800 }}>
                                {[entry.instrument, entry.direction].filter(Boolean).join(" ")}
                                {pnl !== 0 && <span style={{ color: pnl >= 0 ? "var(--green)" : "var(--red)" }}> · {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString(undefined,{minimumFractionDigits:0,maximumFractionDigits:2})}</span>}
                              </span>
                              {outcomeLabel && (
                                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: outcomeBg, color: outcomeColor }}>{outcomeLabel}</span>
                              )}
                            </div>
                            {/* Meta row */}
                            {(entry.time || entry.firm || entry.setupType) && (
                              <div style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "12px" }}>
                                {[entry.time, entry.firm, entry.setupType].filter(Boolean).join(" · ")}
                              </div>
                            )}
                            {/* Discipline above notes */}
                            {entry.discipline && (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                                <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Discipline</span>
                                <span style={{ fontSize: "18px", fontWeight: 800, lineHeight: 1, color: Number(entry.discipline) >= 8 ? "var(--green)" : Number(entry.discipline) >= 5 ? "var(--orange)" : "var(--red)" }}>{entry.discipline}</span>
                              </div>
                            )}
                            {/* Notes + image */}
                            <div style={{ display: "grid", gridTemplateColumns: entry.image ? "1fr auto" : "1fr", gap: "16px", alignItems: "start" }}>
                              <div>
                                {entry.notes && <div style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.7, marginBottom: "12px", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>{entry.notes}</div>}
                                {entry.tags && entry.tags.length > 0 && (
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    {entry.tags.map(tag => {
                                      const isPos = emotionTags.includes(tag);
                                      const isNeg = negativeTags.includes(tag);
                                      return <span key={tag} style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: isPos ? "rgba(249,115,22,0.15)" : isNeg ? "var(--red-dim)" : "rgba(255,255,255,0.06)", color: isPos ? "var(--orange)" : isNeg ? "var(--red)" : "var(--muted)", border: `1px solid ${isPos ? "rgba(249,115,22,0.2)" : isNeg ? "rgba(239,68,68,0.2)" : "var(--border)"}` }}>{tag}</span>;
                                    })}
                                  </div>
                                )}
                              </div>
                              {entry.image && (
                                <>
                                  <img
                                    src={entry.image}
                                    onClick={() => setLightboxImage(entry.image)}
                                    style={{ width: "120px", height: "90px", borderRadius: "8px", objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0, cursor: "zoom-in", transition: "opacity 0.15s" }}
                                    onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
                                    onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })()}
          {activeTab === "analytics" && <AnalyticsPage uploadRef={analyticsUploadRef} />}
          {activeTab === "taxes" && <TaxesPage payouts={payouts} spending={spending} onBack={() => setActiveTab("dashboard")} step={taxStep} setStep={setTaxStep} results={taxResults} setResults={setTaxResults} />}
          </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, cursor: "zoom-out", padding: "24px" }}>
          <img src={lightboxImage} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "12px", border: "1px solid var(--border)", objectFit: "contain", boxShadow: "0 0 80px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()} />
          <button onClick={() => setLightboxImage(null)} style={{ position: "fixed", top: "20px", right: "20px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", width: "36px", height: "36px", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>×</button>
        </div>
      )}

      {/* Add Trade Entry Modal */}
      {showAddEntryModal && (() => {
        const inputStyle = { width: "100%", padding: "9px 12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", boxSizing: "border-box", colorScheme: "dark", outline: "none" };
        const labelStyle = { display: "block", fontSize: "10px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" };
        const allTags = ["Calm","Focused","Confident","Patient","Disciplined","Followed Plan","Revenge","FOMO","Overconfident","Anxious","Frustrated","Impulsive","Off Plan","Breakout","Pullback","Reversal","Scalp"];
        const firms = ["Topstep","My Funded Futures","Apex Trader Funding","Lucid Trading","Take Profit Trader","Tradeify","Funded Next","Other"];
        const cancelAndReset = () => { setShowAddEntryModal(false); setEditingEntry(null); setNewEntryDate(new Date().toISOString().split('T')[0]); setNewEntryData({ instrument: "", direction: "Long", pnl: "", firm: "", time: "", setupType: "", notes: "", tags: [], discipline: "", image: null }); setFormErrors({}); };
        return (
          <div onClick={cancelAndReset} style={{ position: "fixed", top: 0, left: "220px", right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px", paddingTop: "30px" }}>
            <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "560px", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#f97316", textTransform: "uppercase", letterSpacing: ".12em", fontWeight: 700, marginBottom: "4px" }}>Trade Journal</div>
                  <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.3px" }}>{editingEntry ? "Edit Trade" : "Journal a Trade"}</h2>
                </div>
                
              </div>

              {/* Row 1: Date + Time */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={newEntryDate} onChange={e => { setNewEntryDate(e.target.value); setFormErrors(p => ({...p, date: false})); }} style={{ ...inputStyle, border: `1px solid ${formErrors.date ? "var(--red)" : "var(--border)"}` }} />
                </div>
                <div>
                  <label style={labelStyle}>Time</label>
                  <input type="time" value={newEntryData.time || ""} onChange={e => { setNewEntryData(p => ({...p, time: e.target.value})); setFormErrors(p => ({...p, time: false})); }} style={{ ...inputStyle, border: `1px solid ${formErrors.time ? "var(--red)" : "var(--border)"}` }} />
                </div>
              </div>

              {/* Row 2: Instrument + Direction */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>Ticker Symbol</label>
                  <input
                    placeholder="Ticker Symbol"
                    value={newEntryData.instrument || ""}
                    onChange={e => { setNewEntryData(p => ({...p, instrument: e.target.value})); setFormErrors(p => ({...p, instrument: false})); }}
                    onBlur={e => {
                      const VALID_TICKERS = ["NQ","MNQ","ES","MES","YM","MYM","RTY","M2K","CL","NG","RB","HO","GC","MGC","SI","HG","PL","6E","6J","6B","6A","6C","ZB","ZN","ZF","ZT","ZC","ZS","ZW","LE","HE","BTC","ETH"];
                      const val = e.target.value.trim().toUpperCase();
                      if (val === "") return;
                      if (VALID_TICKERS.includes(val)) {
                        setNewEntryData(p => ({...p, instrument: val}));
                        setFormErrors(p => ({...p, instrument: false}));
                      } else {
                        setFormErrors(p => ({...p, instrument: true}));
                      }
                    }}
                    style={{ ...inputStyle, border: `1px solid ${formErrors.instrument ? "var(--red)" : "var(--border)"}` }}
                  />
                  {formErrors.instrument && (newEntryData.instrument || "").trim() !== "" && (
                    <div style={{ fontSize: "10px", color: "var(--red)", marginTop: "4px", fontWeight: 600 }}>Not A Valid Ticker</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Direction</label>
                  <div style={{ display: "flex", gap: "8px", border: formErrors.direction ? "1px solid var(--red)" : "none", borderRadius: "8px", padding: formErrors.direction ? "2px" : "0" }}>
                    {["Long","Short"].map(d => (
                      <button key={d} onClick={() => { setNewEntryData(p => ({...p, direction: d})); setFormErrors(p => ({...p, direction: false})); }} style={{ flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${newEntryData.direction === d ? (d === "Long" ? "var(--green)" : "var(--red)") : "var(--border)"}`, background: newEntryData.direction === d ? (d === "Long" ? "var(--green-dim)" : "var(--red-dim)") : "var(--surface2)", color: newEntryData.direction === d ? (d === "Long" ? "var(--green)" : "var(--red)") : "var(--muted)", fontWeight: 700, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>{d}</button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 3: P&L (auto-detects win/loss/BE from value) */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>P&L</label>
                <input type="text" inputMode="decimal" placeholder="P&L" value={newEntryData.pnl || ""} onChange={e => { const v = e.target.value; if (/^-?\d*\.?\d*$/.test(v)) { setNewEntryData(p => ({...p, pnl: v})); setFormErrors(p => ({...p, pnl: false})); } }} style={{ ...inputStyle, border: `1px solid ${formErrors.pnl ? "var(--red)" : "var(--border)"}` }} />
              </div>

              {/* Row 4: Firm + Setup Type */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>Firm</label>
                  <select value={newEntryData.firm || ""} onChange={e => { setNewEntryData(p => ({...p, firm: e.target.value})); setFormErrors(p => ({...p, firm: false})); }} style={{ ...inputStyle, appearance: "none", border: `1px solid ${formErrors.firm ? "var(--red)" : "var(--border)"}` }}>
                    <option value="">Select Firm</option>
                    {firms.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Setup Type</label>
                  <input placeholder="Setup Type" value={newEntryData.setupType || ""} onChange={e => setNewEntryData(p => ({...p, setupType: e.target.value}))} style={inputStyle} />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Notes</label>
                <textarea placeholder="Notes" value={newEntryData.notes || ""} onChange={e => setNewEntryData(p => ({...p, notes: e.target.value}))} style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }} />
              </div>

              {/* Tags */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {allTags.map(tag => {
                    const selected = (newEntryData.tags || []).includes(tag);
                    const isNeg = ["Revenge","FOMO","Overconfident","Anxious","Frustrated","Impulsive","Off Plan"].includes(tag);
                    const isPos = ["Calm","Focused","Confident","Patient","Disciplined","Followed Plan"].includes(tag);
                    return (
                      <button
                      key={tag}
                      onClick={() => setNewEntryData(p => ({ ...p, tags: selected ? p.tags.filter(t=>t!==tag) : [...(p.tags||[]), tag] }))}
                      onMouseEnter={e => {
                        if (!selected) {
                          e.currentTarget.style.color = isNeg ? "var(--red)" : isPos ? "var(--green)" : "var(--orange)";
                          e.currentTarget.style.borderColor = isNeg ? "rgba(239,68,68,0.4)" : isPos ? "rgba(0,217,126,0.4)" : "rgba(249,115,22,0.4)";
                          e.currentTarget.style.background = isNeg ? "var(--red-dim)" : isPos ? "var(--green-dim)" : "var(--orange-dim)";
                        }
                      }}
                      onMouseLeave={e => {
                        if (!selected) {
                          e.currentTarget.style.color = "var(--muted)";
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                      style={{ padding: "4px 10px", borderRadius: "20px", border: `1px solid ${selected ? (isNeg ? "rgba(239,68,68,0.5)" : isPos ? "rgba(0,217,126,0.5)" : "rgba(249,115,22,0.5)") : "var(--border)"}`, background: selected ? (isNeg ? "var(--red-dim)" : isPos ? "var(--green-dim)" : "var(--orange-dim)") : "transparent", color: selected ? (isNeg ? "var(--red)" : isPos ? "var(--green)" : "var(--orange)") : "var(--muted)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all .1s" }}
                    >{tag}</button>
                    );
                  })}
                </div>
              </div>

              {/* Discipline score */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Discipline Score</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setNewEntryData(p => ({...p, discipline: p.discipline == n ? "" : n}))} style={{ flex: 1, padding: "10px 4px", borderRadius: "8px", border: `1px solid ${newEntryData.discipline == n ? (n >= 8 ? "var(--green)" : n >= 5 ? "rgba(249,115,22,0.5)" : "rgba(239,68,68,0.5)") : "var(--border)"}`, background: newEntryData.discipline == n ? (n >= 8 ? "var(--green-dim)" : n >= 5 ? "var(--orange-dim)" : "var(--red-dim)") : "var(--surface2)", color: newEntryData.discipline == n ? (n >= 8 ? "var(--green)" : n >= 5 ? "var(--orange)" : "var(--red)") : "var(--muted)", fontWeight: 800, fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Image upload */}
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Chart Screenshot</label>
                {newEntryData.image ? (
                  <div style={{ position: "relative", display: "inline-block" }}>
                    <img src={newEntryData.image} style={{ width: "100%", maxHeight: "160px", objectFit: "cover", borderRadius: "8px", border: "1px solid var(--border)", display: "block" }} />
                    <button onClick={() => setNewEntryData(p => ({...p, image: null}))} style={{ position: "absolute", top: "6px", right: "6px", background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%", width: "22px", height: "22px", cursor: "pointer", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                ) : (
                  <label style={{ display: "block", border: "1.5px dashed rgba(249,115,22,0.3)", borderRadius: "8px", padding: "16px", textAlign: "center", cursor: "pointer", background: "rgba(249,115,22,0.02)", transition: "all .2s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,0.6)";e.currentTarget.style.background="rgba(249,115,22,0.05)"}} onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(249,115,22,0.3)";e.currentTarget.style.background="rgba(249,115,22,0.02)"}}>
                    <div style={{ fontSize: "13px", color: "var(--muted)", fontWeight: 600 }}>Click to upload screenshot</div>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { const r = new FileReader(); r.onload = ev => setNewEntryData(p => ({...p, image: ev.target.result})); r.readAsDataURL(e.target.files[0]); }}} />
                  </label>
                )}
              </div>

              {/* Validation error message */}
              {Object.values(formErrors).some(Boolean) && (
                <div style={{ background: "var(--red-dim)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--red)", padding: "10px 14px", borderRadius: "8px", marginBottom: "14px", fontSize: "12px", fontWeight: 600, textAlign: "center" }}>
                  Please Complete All Required Fields
                </div>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={() => {
                  const VALID_TICKERS = ["NQ","MNQ","ES","MES","YM","MYM","RTY","M2K","CL","NG","RB","HO","GC","MGC","SI","HG","PL","6E","6J","6B","6A","6C","ZB","ZN","ZF","ZT","ZC","ZS","ZW","LE","HE","BTC","ETH"];
                  const errors = {};
                  if (!newEntryDate) errors.date = true;
                  if (!newEntryData.time) errors.time = true;
                  const tickerVal = (newEntryData.instrument || "").trim().toUpperCase();
                  if (!tickerVal || !VALID_TICKERS.includes(tickerVal)) errors.instrument = true;
                  else setNewEntryData(p => ({...p, instrument: tickerVal}));
                  if (!newEntryData.direction) errors.direction = true;
                  if (newEntryData.pnl === "" || newEntryData.pnl === null || newEntryData.pnl === undefined) errors.pnl = true;
                  if (!newEntryData.firm) errors.firm = true;
                  if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
                  const dateKey = new Date(newEntryDate + "T12:00:00").toLocaleDateString();
                  if (editingEntry) {
                    setSavedJournals(prev => {
                      const updated = { ...prev };
                      const oldDate = editingEntry.date;
                      const oldIdx = editingEntry.entryIdx;
                      // Remove from old date
                      const oldEntries = [...(updated[oldDate] || [])];
                      oldEntries.splice(oldIdx, 1);
                      if (oldEntries.length === 0) delete updated[oldDate];
                      else updated[oldDate] = oldEntries;
                      // Insert into new date
                      updated[dateKey] = [...(updated[dateKey] || []), { ...newEntryData, tags: newEntryData.tags || [] }];
                      return updated;
                    });
                  } else {
                    setSavedJournals(prev => ({ ...prev, [dateKey]: [...(prev[dateKey] || []), { ...newEntryData, tags: newEntryData.tags || [] }] }));
                  }
                  cancelAndReset();
                }} style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{editingEntry ? "Update Trade" : "Save Trade"}</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}