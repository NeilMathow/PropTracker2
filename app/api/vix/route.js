const SYMBOL_CONFIG = {
  // Equity indices → VIX
  NQ:  { ticker: "%5EVIX",  thresholds: [15, 20, 30] },
  ES:  { ticker: "%5EVIX",  thresholds: [15, 20, 30] },
  YM:  { ticker: "%5EVIX",  thresholds: [15, 20, 30] },
  // Gold / Silver → GVZ
  GC:  { ticker: "%5EGVZ",  thresholds: [13, 20, 32] },
  SI:  { ticker: "%5EGVZ",  thresholds: [13, 20, 32] },
  // Crude Oil → OVX
  CL:  { ticker: "%5EOVX",  thresholds: [25, 40, 60] },
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const sym = (searchParams.get("sym") || "NQ").toUpperCase();
  const config = SYMBOL_CONFIG[sym] || SYMBOL_CONFIG.NQ;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${config.ticker}?interval=1m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } }
    );
    const json = await res.json();
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;

    let level = "NORMAL";
    if (price !== null) {
      const [low, normal, high] = config.thresholds;
      if (price < low) level = "LOW";
      else if (price < normal) level = "NORMAL";
      else if (price < high) level = "HIGH";
      else level = "EXTREME";
    }

    return Response.json({ vix: price, level, index: config.ticker.replace("%5E", "") });
  } catch {
    return Response.json({ vix: null, level: "NORMAL", index: "VIX" });
  }
}
