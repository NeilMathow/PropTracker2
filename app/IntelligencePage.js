"use client";
import { useState, useEffect, useRef } from "react";

const SYMBOLS = [
  { key: "NQ", label: "NQ", tv: "FOREXCOM:NSXUSD", full: "Nasdaq 100" },
  { key: "ES", label: "ES", tv: "FOREXCOM:SPXUSD", full: "S&P 500" },
  { key: "YM", label: "YM", tv: "FOREXCOM:DJI", full: "Dow Jones 30" },
  { key: "GC", label: "GC", tv: "TVC:GOLD", full: "Gold" },
  { key: "SI", label: "SI", tv: "TVC:SILVER", full: "Silver" },
  { key: "CL", label: "CL", tv: "TVC:USOIL", full: "Crude Oil WTI" },
];

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1D"];

const MACRO_EVENTS = [
  { name: "FOMC Minutes", impact: "HIGH", freq: "Every 6 weeks" },
  { name: "Fed Rate Decision", impact: "HIGH", freq: "Every 6 weeks" },
  { name: "US CPI", impact: "HIGH", freq: "Monthly" },
  { name: "Core CPI", impact: "HIGH", freq: "Monthly" },
  { name: "NFP", impact: "HIGH", freq: "1st Friday" },
  { name: "Unemployment Rate", impact: "HIGH", freq: "Monthly" },
  { name: "PPI", impact: "MEDIUM", freq: "Monthly" },
  { name: "PCE Index", impact: "HIGH", freq: "Monthly" },
  { name: "Core PCE", impact: "HIGH", freq: "Monthly" },
  { name: "GDP Advance", impact: "HIGH", freq: "Quarterly" },
  { name: "Retail Sales", impact: "HIGH", freq: "Monthly" },
  { name: "Jobless Claims", impact: "MEDIUM", freq: "Weekly" },
  { name: "Fed Speech", impact: "MEDIUM", freq: "Variable" },
  { name: "ISM Mfg PMI", impact: "MEDIUM", freq: "Monthly" },
];

const NEWS_ITEMS = [
  { time: "00:01", text: "Fed officials signal rate path dependent on upcoming CPI data" },
  { time: "00:14", text: "NQ futures slip 0.3% as risk-off sentiment builds overnight" },
  { time: "01:02", text: "Treasury yields tick higher ahead of bond auction" },
  { time: "01:45", text: "China PMI beats expectations — risk-on early Asia session" },
  { time: "02:30", text: "Oil drops on rising US inventory data" },
  { time: "03:11", text: "ECB member hints at July rate decision flexibility" },
];

function TradingViewWidget({ symbol, interval }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol,
      interval: interval,
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      backgroundColor: "rgba(13, 13, 13, 1)",
      gridColor: "rgba(255, 255, 255, 0.04)",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);
  }, [symbol, interval]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

function TickerBar() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "FOREXCOM:NSXUSD", title: "NQ | Nasdaq 100" },
        { proName: "FOREXCOM:SPXUSD", title: "ES | S&P 500" },
        { proName: "FOREXCOM:DJI", title: "YM | Dow Jones 30" },
        { proName: "TVC:GOLD", title: "GC | Gold" },
        { proName: "TVC:SILVER", title: "SI | Silver" },
        { proName: "TVC:USOIL", title: "CL | Crude Oil" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: "en",
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "46px",
        overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(0,0,0,0.3)",
      }}
    />
  );
}

function EconomicCalendarWidget() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: "100%",
      locale: "en",
      importanceFilter: "0,1",
      countryFilter: "us",
    });

    containerRef.current.appendChild(script);
  }, []);

  return (
    <div style={{ width: "100%", height: "150px", overflow: "hidden", position: "relative" }}>
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ width: "100%", height: "430px", marginTop: "-70px" }}
      />
    </div>
  );
}


function getActiveSessions() {
  const now = new Date();
  // Convert to ET (UTC-4 during EDT, UTC-5 during EST)
  const etOffset = -4;
  const etHour = (now.getUTCHours() + etOffset + 24) % 24;
  const etMin = now.getUTCMinutes();
  const etTime = etHour + etMin / 60;
  return {
    Asia: etTime >= 19 || etTime < 4,       // 7pm–4am ET
    London: etTime >= 3 && etTime < 12,     // 3am–12pm ET
    "New York": etTime >= 8 && etTime < 17, // 8am–5pm ET
  };
}

export default function IntelligencePage({ sidebarOpen = true }) {
  const sidebarWidth = sidebarOpen ? 212 : 0;
  const [activeSym, setActiveSym] = useState(SYMBOLS[0]);
  const [activeInterval, setActiveInterval] = useState("15m");
  const [volatility, setVolatility] = useState("NORMAL");
  const [vixValue, setVixValue] = useState(null);
  const [vixIndex, setVixIndex] = useState("VIX");
  const [sessions, setSessions] = useState(getActiveSessions());

  useEffect(() => {
    const tick = () => setSessions(getActiveSessions());
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchVix = async () => {
      try {
        const res = await fetch(`/api/vix?sym=${activeSym.key}`);
        const data = await res.json();
        if (data.level) setVolatility(data.level);
        if (data.vix) setVixValue(data.vix.toFixed(2));
        if (data.index) setVixIndex(data.index);
      } catch {}
    };
    fetchVix();
    const interval = setInterval(fetchVix, 60000);
    return () => clearInterval(interval);
  }, [activeSym]);

  const impactColor = (impact) => {
    if (impact === "HIGH") return "#ef4444";
    if (impact === "MEDIUM") return "#f97316";
    return "#eab308";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: `calc(100% - ${sidebarWidth}px)`, overflow: "hidden", background: "#0d0d0d", position: "fixed", top: 0, left: `${sidebarWidth}px`, zIndex: 10, transition: "left 0.3s ease, width 0.3s ease" }}>
      {/* Ticker tape */}
      <TickerBar />

      {/* Main body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* LEFT: Chart */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Session + Symbol bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
            background: "rgba(0,0,0,0.2)",
            flexWrap: "wrap",
          }}>
            {/* Session indicators */}
            <div style={{ display: "flex", gap: "10px", marginRight: "8px" }}>
              {(["Asia", "London", "New York"]).map(name => ({ name, active: sessions[name] })).map(s => (
                <div key={s.name} style={{
                  fontSize: "11px",
                  color: s.active ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: s.active ? "#f97316" : "rgba(255,255,255,0.2)", display: "inline-block" }} />
                  {s.name}
                </div>
              ))}
            </div>

            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.1)" }} />

            {/* Symbol tabs */}
            <div style={{ display: "flex", gap: "5px" }}>
              {SYMBOLS.map(sym => (
                <button
                  key={sym.key}
                  onClick={() => setActiveSym(sym)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: "20px",
                    border: "1px solid",
                    borderColor: activeSym.key === sym.key ? "#f97316" : "rgba(255,255,255,0.12)",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: activeSym.key === sym.key ? "#f97316" : "rgba(255,255,255,0.04)",
                    color: activeSym.key === sym.key ? "#fff" : "rgba(255,255,255,0.55)",
                    transition: "all 0.15s",
                  }}
                >
                  {sym.label}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: "auto", fontSize: "12px", color: "rgba(255,255,255,0.4)", fontWeight: "600" }}>
              {activeSym.full}
            </div>

            <div style={{ width: "1px", height: "18px", background: "rgba(255,255,255,0.1)" }} />

            {/* Interval tabs */}
            <div style={{ display: "flex", gap: "4px" }}>
              {INTERVALS.map(iv => (
                <button
                  key={iv}
                  onClick={() => setActiveInterval(iv)}
                  style={{
                    padding: "4px 9px",
                    borderRadius: "5px",
                    border: "none",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    background: activeInterval === iv ? "rgba(249,115,22,0.2)" : "transparent",
                    color: activeInterval === iv ? "#f97316" : "rgba(255,255,255,0.35)",
                    transition: "all 0.15s",
                  }}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>

          {/* TradingView Chart */}
          <div style={{ flex: 1, overflow: "hidden", padding: "12px 16px 16px 28px", display: "flex", alignItems: "stretch", justifyContent: "center" }}>
            <div style={{ width: "95%", flex: 1, borderRadius: "12px", overflow: "hidden", border: "2px solid #f97316", background: "#131722", boxShadow: "0 0 20px rgba(249,115,22,0.4), 0 0 60px rgba(249,115,22,0.15)" }}>
              <TradingViewWidget
                key={`${activeSym.tv}-${activeInterval}`}
                symbol={activeSym.tv}
                interval={{"1m":"1","5m":"5","15m":"15","1h":"60","4h":"240","1D":"1D"}[activeInterval] || "15"}
              />
            </div>
          </div>

        </div>

        {/* RIGHT PANEL */}
        <div style={{
          width: "300px",
          flexShrink: 0,
          borderLeft: "1px solid rgba(255,255,255,0.07)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          background: "rgba(0,0,0,0.15)",
        }}>
          {/* Volatility Context */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              VOLATILITY CONTEXT
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", color: "rgba(255,255,255,0.55)", fontWeight: 500 }}>Session Volatility</span>
              <span style={{
                fontSize: "13px",
                fontWeight: "800",
                color: volatility === "LOW" ? "#60a5fa" : volatility === "NORMAL" ? "#fbbf24" : volatility === "HIGH" ? "#f97316" : "#ef4444",
                letterSpacing: "0.05em",
              }}>{volatility}</span>
            </div>
            <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: volatility === "LOW" ? "20%" : volatility === "NORMAL" ? "50%" : volatility === "HIGH" ? "75%" : "100%",
                background: volatility === "LOW" ? "#60a5fa" : volatility === "NORMAL" ? "linear-gradient(90deg,#f97316,#fbbf24)" : volatility === "HIGH" ? "#f97316" : "#ef4444",
                borderRadius: "99px",
                transition: "width 0.6s ease",
              }} />
            </div>
            {vixValue && <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", marginTop: "6px" }}>{vixIndex} {vixValue}</div>}
          </div>

          {/* NQ Macro Watchlist */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              {activeSym.key} MACRO WATCHLIST
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {MACRO_EVENTS.map((ev, i) => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: impactColor(ev.impact), flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.75)" }}>{ev.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: "700", color: impactColor(ev.impact) }}>{ev.impact}</span>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>{ev.freq}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Economic Calendar */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.5)", letterSpacing: "0.08em", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
              ECONOMIC CALENDAR
            </div>
            <EconomicCalendarWidget />
          </div>
        </div>
      </div>
    </div>
  );
}
