"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState("combines");
  const [data, setData] = useState({ combines: [], spending: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = async (type) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/mff/${type}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setData((prev) => ({ ...prev, [type]: result.emails || [] }));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return <div className="loading"><div className="spinner" /></div>;

  if (!session) {
    return (
      <main>
        <div className="header">
          <div className="logo">MFF Tracker</div>
        </div>
        <div className="signin-card">
          <h1>MFF Tracker</h1>
          <p>Track your combines and spending</p>
          <button className="btn-primary" onClick={() => signIn("google")}>
            Sign in with Google
          </button>
        </div>
      </main>
    );
  }

  const statusStyle = (status) => {
    if (status === "Passed") return { color: "var(--accent)", fontFamily: "monospace", fontSize: "0.85rem" };
    if (status === "Breached") return { color: "var(--red)", fontFamily: "monospace", fontSize: "0.85rem" };
    return { color: "var(--muted)", fontFamily: "monospace", fontSize: "0.85rem" };
  };

  const renderCombines = () => {
    const combines = data.combines;
    if (!combines.length) return <div className="empty">Click "Fetch Combines" to load your data</div>;

    const passed = combines.filter((c) => c.status === "Passed").length;
    const breached = combines.filter((c) => c.status === "Breached").length;
    const active = combines.filter((c) => c.status === "Active").length;

    return (
      <>
        <div className="summary">
          <div className="summary-card">
            <div className="summary-label">Total</div>
            <div className="summary-value">{combines.length}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Passed</div>
            <div className="summary-value" style={{ color: "var(--accent)" }}>{passed}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Breached</div>
            <div className="summary-value" style={{ color: "var(--red)" }}>{breached}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Active</div>
            <div className="summary-value">{active}</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "150px" }}>Purchase Date</th>
                <th style={{ width: "180px" }}>Account ID</th>
                <th style={{ width: "100px" }}>Size</th>
                <th style={{ width: "100px" }}>Status</th>
                <th>Breach Reason</th>
              </tr>
            </thead>
            <tbody>
              {combines.map((c) => (
                <tr key={c.id}>
                  <td className="date">{c.purchaseDate || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{c.accountId || "—"}</td>
                  <td className="amount">{c.accountSize ? `$${c.accountSize.toLocaleString()}` : "—"}</td>
                  <td style={statusStyle(c.status)}>{c.status}</td>
                  <td style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{c.breachReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const renderSpending = () => {
    const spending = data.spending;
    if (!spending.length) return <div className="empty">Click "Fetch Spending" to load your data</div>;

    const total = spending.reduce((sum, s) => sum + (s.purchasePrice || 0), 0);

    return (
      <>
        <div className="summary">
          <div className="summary-card">
            <div className="summary-label">Total Spent</div>
            <div className="summary-value">${total.toFixed(2)}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Transactions</div>
            <div className="summary-value">{spending.length}</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: "180px" }}>Purchase Date</th>
                <th style={{ width: "180px" }}>Account ID</th>
                <th style={{ width: "100px" }}>Size</th>
                <th style={{ width: "100px" }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {spending.map((s) => (
                <tr key={s.id}>
                  <td className="date">{s.purchaseDate || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{s.accountId || "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: "0.85rem", color: "var(--muted)" }}>
                    {s.accountSize ? `$${s.accountSize.toLocaleString()}` : "—"}
                  </td>
                  <td className="amount">${s.purchasePrice?.toFixed(2) || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <main>
      <div className="header">
        <div className="logo">MFF Tracker</div>
        <button className="btn-ghost" onClick={() => signOut()}>
          Sign out ({session.user?.email})
        </button>
      </div>

      <div className="content">
        <div className="tabs">
          <button
            className={`tab-btn ${activeTab === "combines" ? "active" : ""}`}
            onClick={() => setActiveTab("combines")}
          >
            Combines
          </button>
          <button
            className={`tab-btn ${activeTab === "spending" ? "active" : ""}`}
            onClick={() => setActiveTab("spending")}
          >
            Spending
          </button>
        </div>

        <div className="header-bar">
          <h2>
            {activeTab === "combines" && "Combines"}
            {activeTab === "spending" && "Combine Spending"}
          </h2>
          <button
            className="btn-primary"
            onClick={() => fetchData(activeTab)}
            disabled={loading}
          >
            {loading ? "Loading..." : `Fetch ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
          </button>
        </div>

        {error && <div className="error">⚠ {error}</div>}

        {activeTab === "combines" && renderCombines()}
        {activeTab === "spending" && renderSpending()}
      </div>
    </main>
  );
}
