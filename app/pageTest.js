"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";

function PNLChart({ payouts, spending }) {
  const [tooltip, setTooltip] = useState(null);
  const [isCollapsed, setIsCollapsed] = useState(true);
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
  )}
];

function FirmsGrid({ onSyncFirm, onSyncAll, onClearFirm, loading, firmLoading, firmData }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
      {FIRMS.map((firm) => {
        const hasData = firm.connected === "dynamic" ? (firmData[firm.firmKey] || false) : firm.connected;
        const isFirmLoading = firmLoading?.[firm.firmKey] || false;
        return (
        <div key={firm.name}
          style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "1.25rem", display: "flex", flexDirection: "column", gap: "14px", transition: "border-color 0.2s, box-shadow 0.2s" }}
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
            <div style={{ flexShrink: 0, width: "42px", height: "42px", borderRadius: "10px", overflow: "hidden" }}>{firm.logo}</div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
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
            {!journalCollapsed && savedJournals[selectedDay.toLocaleDateString()] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setJournalData({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
                const previewContainer = document.querySelector('[data-preview]');
                if (previewContainer) previewContainer.innerHTML = '';
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = '';
              }}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
                fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              Delete
            </button>
            )}
          </div>
          
          {!journalCollapsed && (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            {/* Mistakes */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mistakes</div>
              <textarea
                placeholder="What mistakes did you make today?"
                value={journalData.mistakes}
                onChange={(e) => setJournalData({...journalData, mistakes: e.target.value})}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  minHeight: "120px",
                  resize: "vertical",
                  flex: 1
                }}
              />
            </div>

            {/* Habits */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Habits</div>
              <textarea
                placeholder="What habits did you notice today?"
                value={journalData.habits}
                onChange={(e) => setJournalData({...journalData, habits: e.target.value})}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  minHeight: "120px",
                  resize: "vertical",
                  flex: 1
                }}
              />
            </div>

            {/* Setups */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Setups</div>
              <textarea
                placeholder="What setups worked or didn't work?"
                value={journalData.setups}
                onChange={(e) => setJournalData({...journalData, setups: e.target.value})}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  minHeight: "120px",
                  resize: "vertical",
                  flex: 1
                }}
              />
            </div>

            {/* Reflection */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Reflection</div>
              <textarea
                placeholder="What are your thoughts and reflections?"
                value={journalData.reflection}
                onChange={(e) => setJournalData({...journalData, reflection: e.target.value})}
                style={{
                  background: "var(--surface2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "12px",
                  color: "var(--text)",
                  fontFamily: "inherit",
                  fontSize: "13px",
                  minHeight: "120px",
                  resize: "vertical",
                  flex: 1
                }}
              />
            </div>
          </div>

          {/* Image Preview */}
          <div data-preview style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "20px", marginTop: "20px" }}></div>
          
          {/* Buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <label style={{ cursor: "pointer" }}>
              <div style={{ padding: "10px 24px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", borderRadius: "8px", fontWeight: 700, fontSize: "12px", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Add Images
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                style={{
                  display: "none"
                }}
                onChange={(e) => {
                  const previewContainer = document.querySelector('[data-preview]');
                  if (previewContainer && e.target.files.length > 0) {
                    previewContainer.innerHTML = '';
                    const file = e.target.files[0];
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const img = document.createElement('img');
                      img.src = event.target.result;
                      img.style.maxWidth = '100px';
                      img.style.maxHeight = '100px';
                      img.style.borderRadius = '6px';
                      img.style.border = '1px solid var(--border)';
                      previewContainer.appendChild(img);
                      
                      // Save only 1 image
                      setJournalData(prev => ({
                        ...prev,
                        images: [event.target.result]
                      }));
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </label>
            <button
              onClick={() => {
                const dateKey = selectedDay.toLocaleDateString();
                const newEntry = { mistakes: journalData.mistakes, habits: journalData.habits, setups: journalData.setups, reflection: journalData.reflection, images: journalData.images.slice(0, 1) };
                setSavedJournals(prev => ({
                  ...prev,
                  [dateKey]: [...(prev[dateKey] || []), newEntry]
                }));
                // Reset everything
                setJournalData({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
                setEntryIndex(null);
                const previewContainer = document.querySelector('[data-preview]');
                if (previewContainer) previewContainer.innerHTML = '';
                // Reset file input
                const fileInput = document.querySelector('input[type="file"]');
                if (fileInput) fileInput.value = '';
              }}
              style={{
                background: "linear-gradient(135deg,#ef4444,#f97316)",
                color: "#fff",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "12px",
                fontFamily: "inherit",
                whiteSpace: "nowrap"
              }}
            >
              Save Journal
            </button>
          </div>
          </>
          )}
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

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [data, setData] = useState({ combines: [], spending: [], payouts: [], closed: [], firmData: { topstep: false, mff: false, lucid: false, apex: false } });
  const [loading, setLoading] = useState(false);
  const [firmLoading, setFirmLoading] = useState({ topstep: false, mff: false, lucid: false, apex: false });
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [savedJournals, setSavedJournals] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("journals");
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  const [collapsedEntries, setCollapsedEntries] = useState({});
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [newEntryDate, setNewEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [newEntryData, setNewEntryData] = useState({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  // Save to localStorage whenever savedJournals changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("journals", JSON.stringify(savedJournals));
    }
  }, [savedJournals]);

  const fetchFirm = async (firmKey) => {
    setError(null);
    setFirmLoading(prev => ({ ...prev, [firmKey]: true }));
    try {
      const endpoints = {
        topstep: [fetch("/api/combines"), fetch("/api/spending"), fetch("/api/payouts"), fetch("/api/closed")],
        mff: [fetch("/api/mff/combines"), fetch("/api/mff/spending")],
        lucid: [fetch("/api/lucid/combines"), fetch("/api/lucid/spending")],
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
        const [combinesRes, spendingRes] = await Promise.all(endpoints.lucid);
        const [combinesData, spendingData] = await Promise.all([combinesRes.json(), spendingRes.json()]);
        setData(prev => ({
          ...prev,
          combines: [...prev.combines.filter(e => e.firm !== "lucid"), ...(combinesData.emails || []).map(e => ({ ...e, firm: "lucid" }))],
          spending: [...prev.spending.filter(e => e.firm !== "lucid"), ...(spendingData.emails || []).map(e => ({ ...e, firm: "lucid" }))],
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
      const [combinesRes, spendingRes, payoutsRes, closedRes, mffCombinesRes, mffSpendingRes, lucidCombinesRes, lucidSpendingRes, apexCombinesRes, apexSpendingRes] = await Promise.all([
        fetch("/api/combines"),
        fetch("/api/spending"),
        fetch("/api/payouts"),
        fetch("/api/closed"),
        fetch("/api/mff/combines"),
        fetch("/api/mff/spending"),
        fetch("/api/lucid/combines"),
        fetch("/api/lucid/spending"),
        fetch("/api/apex/combines"),
        fetch("/api/apex/spending"),
      ]);
      if (!combinesRes.ok || !spendingRes.ok || !payoutsRes.ok || !closedRes.ok) throw new Error("Failed to fetch data");
      const [combinesData, spendingData, payoutsData, closedData, mffCombinesData, mffSpendingData, lucidCombinesData, lucidSpendingData, apexCombinesData, apexSpendingData] = await Promise.all([
        combinesRes.json(), spendingRes.json(), payoutsRes.json(), closedRes.json(),
        mffCombinesRes.ok ? mffCombinesRes.json() : { emails: [] },
        mffSpendingRes.ok ? mffSpendingRes.json() : { emails: [] },
        lucidCombinesRes.ok ? lucidCombinesRes.json() : { emails: [] },
        lucidSpendingRes.ok ? lucidSpendingRes.json() : { emails: [] },
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
        payouts: payoutsData.emails || [],
        closed: closedData.emails || [],
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#f97316", marginBottom: "12px" }}>
            <span style={{ width: "8px", height: "8px", background: "#f97316", borderRadius: "50%", display: "inline-block", flexShrink: 0 }}></span>
            Prop Trading
          </div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "36px", fontWeight: 800, letterSpacing: "-1.5px", marginBottom: "6px" }}>Prop Tracker</h1>
          <p style={{ fontSize: "13px", color: "#f97316", marginBottom: "1.5rem", lineHeight: 1.6 }}>Track combines &amp; payouts across all your prop firms</p>
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
    <div className={`nav-item ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)} style={{ color: "#fff" }}>
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
      <div className="sidebar" style={{ transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)", transition: "transform 0.3s ease", position: "fixed", height: "100vh", zIndex: "999", width: "212px" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="sidebar-brand">
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "9px", color: "#f97316", textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
              <span style={{ width: "6px", height: "6px", background: "#f97316", borderRadius: "50%", display: "inline-block" }}></span>
              Prop Trading
            </div>
            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: "22px", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.5px", color: "#fff" }}>Prop Tracker</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Overview</div>
          {navItem("dashboard", "Dashboard", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>)}
          {navItem("firms", "Firms", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>)}
          <div className="nav-section-label">Trading</div>
          {navItem("calendar", "Calendar", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>)}
          {navItem("journal", "Journal", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>)}
          {navItem("analytics", "Analytics", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>)}
          <div className="nav-section-label">Finance</div>
          {navItem("taxes", "Taxes", <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/><line x1="12" y1="12" x2="12" y2="18"/></svg>)}
        </nav>
        <div className="sidebar-footer">
          <button className="signout-btn" onClick={() => signOut()}>Sign out</button>
        </div>
      </div>

      <div className="main-content" style={{ marginLeft: sidebarOpen ? "212px" : "0", width: sidebarOpen ? "calc(100% - 212px)" : "100%", transition: "all 0.3s ease" }}>
        <div className="page-header">
          <div style={{ marginLeft: sidebarOpen ? "0px" : "40px" }}>
            <h1 className="page-title">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1>
            {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}
          </div>
          {activeTab === "journal" ? (
            <button className="btn-primary" onClick={() => setShowAddEntryModal(true)}>
              Add Entry
            </button>
          ) : (
            <button className="btn-primary" onClick={fetchAllData} disabled={loading}>
              {loading ? "Syncing..." : "Sync Data"}
            </button>
          )}
        </div>

        <div className="page-body">
          {error && <div className="error">⚠ {error}</div>}

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
              <div style={{ marginBottom: "16px" }}><FirmsGrid onSyncFirm={fetchFirm} onSyncAll={fetchAllData} onClearFirm={(firmKey) => setData(prev => ({ ...prev, combines: prev.combines.filter(e => e.firm !== firmKey), spending: prev.spending.filter(e => e.firm !== firmKey), payouts: firmKey === "topstep" ? [] : prev.payouts, closed: firmKey === "topstep" ? [] : prev.closed, firmData: { ...prev.firmData, [firmKey]: false } }))} loading={loading} firmLoading={firmLoading} firmData={data.firmData} /></div>
              <PNLChart payouts={payouts} spending={spending} />
            </>
          )}

          {activeTab === "firms" && <FirmsGrid onSyncFirm={fetchFirm} onSyncAll={fetchAllData} onClearFirm={(firmKey) => setData(prev => ({ ...prev, combines: prev.combines.filter(e => e.firm !== firmKey), spending: prev.spending.filter(e => e.firm !== firmKey), payouts: firmKey === "topstep" ? [] : prev.payouts, closed: firmKey === "topstep" ? [] : prev.closed, firmData: { ...prev.firmData, [firmKey]: false } }))} loading={loading} firmLoading={firmLoading} firmData={data.firmData} />}

          {activeTab === "calendar" && <CalendarPage payouts={payouts} spending={spending} savedJournals={savedJournals} setSavedJournals={setSavedJournals} session={session} />}
          {activeTab === "journal" && (
            <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "1fr" }}>
              {Object.keys(savedJournals).length === 0 ? (
                <div className="empty" style={{ gridColumn: "1 / -1" }}>No journal entries yet</div>
              ) : (
                Object.entries(savedJournals).map(([date, entries]) => 
                  Array.isArray(entries) ? entries.map((entry, entryIdx) => (
                    <div key={`${date}-${entryIdx}`} style={{ border: "1px solid var(--border)", borderRadius: "12px", padding: "12px", background: "var(--surface)", display: "flex", flexDirection: "column", position: "relative" }}>
                      {!collapsedEntries[`${date}-${entryIdx}`] && (
                      <button
                        onClick={() => {
                          setSavedJournals(prev => ({
                            ...prev,
                            [date]: prev[date].filter((_, idx) => idx !== entryIdx)
                          }));
                        }}
                        style={{
                          position: "absolute",
                          top: "12px",
                          right: "12px",
                          background: "#ef4444",
                          color: "#fff",
                          border: "none",
                          padding: "10px 24px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: "12px",
                          fontFamily: "inherit",
                          whiteSpace: "nowrap",
                          zIndex: 10
                        }}
                      >
                        Delete
                      </button>
                      )}
                      <div 
                        style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", marginBottom: collapsedEntries[`${date}-${entryIdx}`] ? "0" : "12px", minHeight: "32px" }}
                        onClick={() => setCollapsedEntries(prev => ({
                          ...prev,
                          [`${date}-${entryIdx}`]: !prev[`${date}-${entryIdx}`]
                        }))}
                      >
                        <span style={{ fontSize: "14px", fontWeight: 700, color: "#f97316" }}>
                          {new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} {collapsedEntries[`${date}-${entryIdx}`] ? "▶" : "▼"}
                        </span>
                      </div>
                      {!collapsedEntries[`${date}-${entryIdx}`] && (
                      <div style={{ display: "grid", gridTemplateColumns: entry.images && entry.images.length > 0 ? "0.7fr 0.3fr" : "1fr", gap: "24px", alignItems: "start" }}>
                        <div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            {entry.mistakes && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mistakes</div>
                              <div style={{ fontSize: "13px", color: "var(--muted)", background: "var(--surface2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", wordWrap: "break-word", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{entry.mistakes}</div>
                            </div>
                            )}
                            {entry.habits && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Habits</div>
                              <div style={{ fontSize: "13px", color: "var(--muted)", background: "var(--surface2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", wordWrap: "break-word", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{entry.habits}</div>
                            </div>
                            )}
                            {entry.setups && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Setups</div>
                              <div style={{ fontSize: "13px", color: "var(--muted)", background: "var(--surface2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", wordWrap: "break-word", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{entry.setups}</div>
                            </div>
                            )}
                            {entry.reflection && (
                            <div>
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reflection</div>
                              <div style={{ fontSize: "13px", color: "var(--muted)", background: "var(--surface2)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border)", wordWrap: "break-word", whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{entry.reflection}</div>
                            </div>
                            )}
                          </div>
                        </div>
                        {entry.images && entry.images.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px", justifyContent: "flex-start", marginTop: "50px" }}>
                          <div style={{ position: "relative", display: "block", width: "100%", aspectRatio: "1" }}>
                            <img src={entry.images[0]} style={{ width: "100%", height: "100%", borderRadius: "6px", border: "1px solid var(--border)", objectFit: "cover", display: "block" }} />
                          </div>
                        </div>
                        )}
                      </div>
                      )}
                    </div>
                  )) : null
                )
              )}
            </div>
          )}
          {(activeTab === "analytics" || activeTab === "taxes") && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "400px" }}>
              <div style={{ textAlign: "center", color: "var(--muted)" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>Coming Soon</div>
                <div style={{ fontSize: "14px" }}>We're working on this feature. Check back later!</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Entry Modal */}
      {showAddEntryModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "24px", maxWidth: "500px", width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>Add Journal Entry</h2>
            
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", textTransform: "uppercase" }}>Date</label>
              <input
                type="date"
                value={newEntryDate}
                onChange={(e) => setNewEntryDate(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", boxSizing: "border-box", colorScheme: "dark" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", textTransform: "uppercase" }}>Mistakes</label>
              <textarea
                placeholder="What mistakes did you make?"
                value={newEntryData.mistakes}
                onChange={(e) => setNewEntryData(prev => ({...prev, mistakes: e.target.value}))}
                style={{ width: "100%", padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", resize: "vertical", minHeight: "80px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", textTransform: "uppercase" }}>Habits</label>
              <textarea
                placeholder="What habits did you notice?"
                value={newEntryData.habits}
                onChange={(e) => setNewEntryData(prev => ({...prev, habits: e.target.value}))}
                style={{ width: "100%", padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", resize: "vertical", minHeight: "80px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", textTransform: "uppercase" }}>Setups</label>
              <textarea
                placeholder="What setups worked or didn't work?"
                value={newEntryData.setups}
                onChange={(e) => setNewEntryData(prev => ({...prev, setups: e.target.value}))}
                style={{ width: "100%", padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", resize: "vertical", minHeight: "80px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "var(--text)", marginBottom: "8px", textTransform: "uppercase" }}>Reflection</label>
              <textarea
                placeholder="What are your thoughts and reflections?"
                value={newEntryData.reflection}
                onChange={(e) => setNewEntryData(prev => ({...prev, reflection: e.target.value}))}
                style={{ width: "100%", padding: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text)", fontFamily: "inherit", fontSize: "13px", resize: "vertical", minHeight: "80px", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ marginBottom: "20px", display: "flex", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {newEntryData.images && newEntryData.images.length > 0 && (
                <div style={{ position: "relative", width: "fit-content" }} onMouseEnter={(e) => { const btn = e.currentTarget.querySelector('button'); if (btn) btn.style.opacity = "1"; }} onMouseLeave={(e) => { const btn = e.currentTarget.querySelector('button'); if (btn) btn.style.opacity = "0"; }}>
                  <img src={newEntryData.images[0]} style={{ maxWidth: "100px", maxHeight: "100px", borderRadius: "6px", border: "1px solid var(--border)", objectFit: "cover", display: "block" }} />
                  <button
                    onClick={() => setNewEntryData(prev => ({...prev, images: []}))}
                    style={{
                      position: "absolute",
                      top: "0px",
                      right: "0px",
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: "20px",
                      height: "20px",
                      cursor: "pointer",
                      fontWeight: "bold",
                      fontSize: "14px",
                      padding: "0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: "0",
                      transition: "opacity 0.2s",
                      transform: "translate(50%, -50%)"
                    }}
                  >
                    ×
                  </button>
                </div>
                )}
                <label style={{ cursor: "pointer", display: "inline-block" }}>
                  <div style={{ padding: "10px 24px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", borderRadius: "8px", fontWeight: 700, fontSize: "12px", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    Add Image
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setNewEntryData(prev => ({
                            ...prev,
                            images: [event.target.result]
                          }));
                        };
                        reader.readAsDataURL(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowAddEntryModal(false);
                  setNewEntryDate(new Date().toISOString().split('T')[0]);
                  setNewEntryData({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
                }}
                style={{ padding: "10px 24px", background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12px", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const dateKey = new Date(newEntryDate).toLocaleDateString();
                  setSavedJournals(prev => ({
                    ...prev,
                    [dateKey]: [...(prev[dateKey] || []), newEntryData]
                  }));
                  setShowAddEntryModal(false);
                  setNewEntryDate(new Date().toISOString().split('T')[0]);
                  setNewEntryData({ mistakes: "", habits: "", setups: "", reflection: "", images: [] });
                }}
                style={{ padding: "10px 24px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 700, fontSize: "12px", fontFamily: "inherit" }}
              >
                Save Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
