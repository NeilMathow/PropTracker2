"use client";
import { useState } from "react";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    monthlyPrice: "$5",
    yearlyPrice: "$36",
    yearlySavings: "Save $24",
    monthlyPriceId: "price_1TdKPfBDnma0BBQnRGICVOAh",
    yearlyPriceId: "price_1TdLOVBDnma0BBQnjaquQy7A",
    color: "#888",
    features: [
      "1 Prop Firm Account",
      "30-Day Trade History",
      "Rule Tracking Per Firm",
      "Payout Calendar",
      "Consistency Tracker",
    ],
    locked: [
      "Journal & Emotion Log",
      "AI Insights",
      "Tax Calculator",
      "Strategy Tracking",
      "Analytics",
      "Deep-Dive Reports",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: "$29",
    yearlyPrice: "$180",
    yearlySavings: "Save $168",
    monthlyPriceId: "price_1TdKe3BDnma0BBQnsuIGuEmO",
    yearlyPriceId: "price_1TdLPcBDnma0BBQnNj4e0eA8",
    color: "#f97316",
    popular: true,
    features: [
      "Unlimited Prop Firm Accounts",
      "2-Year Trade History",
      "Rule Tracking Per Firm",
      "Payout Calendar",
      "Consistency Tracker",
      "Journal & Emotion Log",
      "AI Insights",
      "Tax Calculator",
      "Strategy Tracking",
      "Analytics",
      "Deep-Dive Reports",
    ],
    locked: ["Priority Support", "Early Feature Access", "Firm Integration Requests", "Dedicated Account Manager", "Account Snapshots"],
  },
  {
    key: "elite",
    name: "Elite",
    monthlyPrice: "$79",
    yearlyPrice: "$276",
    yearlySavings: "Save $372",
    monthlyPriceId: "price_1TdKfYBDnma0BBQnqqpJODT6",
    yearlyPriceId: "price_1TdLNgBDnma0BBQnOxCHllEi",
    color: "#00d97e",
    features: [
      "Unlimited Prop Firm Accounts",
      "Full Trade History",
      "Everything in Pro",
      "Priority Support",
      "Early Feature Access",
      "Firm Integration Requests",
      "Dedicated Account Manager",
      "Account Snapshots",
    ],
    locked: [],
  },
];

export default function BillingPage({ currentPlan = "starter" }) {
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState(null);

  const handleUpgrade = async (plan) => {
    const priceId = yearly ? plan.yearlyPriceId : plan.monthlyPriceId;
    if (plan.key === currentPlan) return;
    setLoading(plan.key);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
    }
    setLoading(null);
  };

  const planRank = { starter: 0, pro: 1, elite: 2 };
  const currentRank = planRank[currentPlan] || 0;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "11px", color: "#f97316", textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, marginBottom: "6px" }}>Billing & Plan</div>
        <h2 style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.5px", marginBottom: "6px" }}>
          Current plan: <span style={{ color: currentPlan === "elite" ? "#00d97e" : currentPlan === "pro" ? "#f97316" : "#888", textTransform: "capitalize" }}>{currentPlan}</span>
        </h2>
        <p style={{ fontSize: "13px", color: "var(--muted)" }}>Upgrade anytime. Cancel anytime.</p>
      </div>

      {/* Billing toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "14px", marginBottom: "28px" }}>
        <span style={{ fontSize: "14px", fontWeight: 600, color: !yearly ? "var(--text)" : "var(--muted)" }}>Monthly</span>
        <div
          onClick={() => setYearly(!yearly)}
          style={{
            width: "48px", height: "26px", borderRadius: "13px", cursor: "pointer",
            background: yearly ? "linear-gradient(135deg,#ef4444,#f97316)" : "rgba(255,255,255,0.1)",
            position: "relative", transition: "background .2s",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div style={{
            position: "absolute", top: "3px",
            left: yearly ? "24px" : "3px",
            width: "18px", height: "18px", borderRadius: "50%",
            background: "#fff", transition: "left .2s",
            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }} />
        </div>
        <span style={{ fontSize: "14px", fontWeight: 600, color: yearly ? "var(--text)" : "var(--muted)" }}>
          Yearly
          {yearly && <span style={{ marginLeft: "8px", fontSize: "11px", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontWeight: 700 }}>2 MONTHS FREE</span>}
        </span>
      </div>

      {/* Plan cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "32px" }}>
        {PLANS.map(plan => {
          const isCurrentPlan = plan.key === currentPlan;
          const isDowngrade = planRank[plan.key] < currentRank;
          const isUpgrade = planRank[plan.key] > currentRank;
          const isLoading = loading === plan.key;

          return (
            <div key={plan.key} style={{
              background: "var(--surface)",
              border: `1px solid ${isCurrentPlan ? plan.color : "var(--border)"}`,
              borderRadius: "14px", padding: "24px", position: "relative",
              transition: "border-color .2s, transform .2s",
              boxShadow: isCurrentPlan ? `0 0 24px ${plan.color}18` : "none",
              transform: plan.popular ? "scale(1.02)" : "scale(1)",
            }}>
              {plan.popular && !isCurrentPlan && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#ef4444,#f97316)", color: "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 12px", borderRadius: "20px", letterSpacing: ".05em", whiteSpace: "nowrap" }}>
                  MOST POPULAR
                </div>
              )}
              {isCurrentPlan && (
                <div style={{ position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)", background: plan.color, color: plan.key === "starter" ? "#000" : "#fff", fontSize: "10px", fontWeight: 700, padding: "3px 12px", borderRadius: "20px", letterSpacing: ".05em", whiteSpace: "nowrap" }}>
                  CURRENT PLAN
                </div>
              )}

              <div style={{ fontSize: "12px", fontWeight: 700, color: plan.color, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: "8px" }}>{plan.name}</div>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "4px" }}>
                <span style={{ fontSize: "34px", fontWeight: 800, color: "var(--text)", fontFamily: "monospace" }}>
                  {yearly ? plan.yearlyPrice : plan.monthlyPrice}
                </span>
                <span style={{ fontSize: "13px", color: "var(--muted)" }}>{yearly ? "/year" : "/month"}</span>
              </div>
              {yearly && (
                <div style={{ fontSize: "11px", color: "#00d97e", fontWeight: 700, marginBottom: "16px" }}>{plan.yearlySavings} vs monthly</div>
              )}
              {!yearly && <div style={{ marginBottom: "16px" }} />}

              {/* Features */}
              <div style={{ marginBottom: "20px" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "7px", fontSize: "12px", color: "var(--text)" }}>
                    <span style={{ color: plan.color, fontWeight: 700, fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>✓</span>
                    {f}
                  </div>
                ))}
                {plan.locked.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "7px", fontSize: "12px", color: "var(--muted2)" }}>
                    <span style={{ color: "var(--muted2)", fontSize: "13px", flexShrink: 0, marginTop: "1px" }}>✗</span>
                    {f}
                  </div>
                ))}
              </div>

              {/* Button */}
              <button
                onClick={() => handleUpgrade(plan)}
                disabled={isCurrentPlan || isDowngrade || isLoading}
                style={{
                  width: "100%", padding: "12px", borderRadius: "9px", border: "none",
                  cursor: isCurrentPlan || isDowngrade ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: "13px", fontWeight: 700,
                  transition: "all .15s",
                  background: isCurrentPlan
                    ? "rgba(255,255,255,0.06)"
                    : isDowngrade
                    ? "rgba(255,255,255,0.03)"
                    : plan.key === "elite"
                    ? "linear-gradient(135deg,#00d97e,#00b86b)"
                    : plan.key === "pro"
                    ? "linear-gradient(135deg,#ef4444,#f97316)"
                    : "linear-gradient(135deg,#666,#888)",
                  color: isCurrentPlan || isDowngrade ? "var(--muted)" : "#fff",
                  opacity: isDowngrade ? 0.4 : 1,
                }}
              >
                {isLoading ? "Redirecting..." : isCurrentPlan ? "Current Plan" : isDowngrade ? "Downgrade" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Current plan feature list */}
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="section-header" style={{ cursor: "default" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#f97316", textTransform: "uppercase", letterSpacing: "0.06em" }}>Included in your {currentPlan} plan</span>
        </div>
        <div style={{ padding: "1.25rem 1.5rem" }}>
          {PLANS.find(p => p.key === currentPlan)?.features.map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--text)" }}>
              <span style={{ color: "#00d97e", fontWeight: 700 }}>✓</span>{f}
            </div>
          ))}
          {(PLANS.find(p => p.key === currentPlan)?.locked.length > 0) && (
            <>
              <div style={{ fontSize: "11px", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: ".08em", margin: "16px 0 10px" }}>Upgrade to unlock</div>
              {PLANS.find(p => p.key === currentPlan)?.locked.map(f => (
                <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "13px", color: "var(--muted)" }}>
                  <span style={{ color: "var(--muted2)" }}>🔒</span>{f}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
