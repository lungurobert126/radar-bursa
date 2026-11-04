// Search any company (?q=), trending suggestions (?trending=1) and full company data (?s=SYMBOL).
import { yget, send } from "./_yahoo.js";
const SECMAP = { "Technology": "tech", "Communication Services": "tech", "Healthcare": "health", "Energy": "energy", "Consumer Defensive": "food" };
const US_EX = /NMS|NYQ|NGM|NCM|ASE|PCX|BTS|NYSE|NASDAQ|PNK|OQB|OQX|OTC/i;
async function quotes(symbols) {
  const j = await yget("https://query2.finance.yahoo.com/v7/finance/quote?symbols=" + symbols.map(encodeURIComponent).join(","));
  return j?.quoteResponse?.result || [];
}
export default async function handler(req, res) {
  try {
    const { q, s, trending } = req.query || {};
    if (q !== undefined) {
      const j = await yget("https://query2.finance.yahoo.com/v1/finance/search?quotesCount=8&newsCount=0&q=" + encodeURIComponent(q), { crumb: false });
      const items = (j?.quotes || []).filter(x => x.quoteType === "EQUITY").map(x => ({ s: x.symbol, n: x.shortname || x.longname || x.symbol, ex: x.exchDisp || x.exchange || "", sector: x.sectorDisp || x.sector || "" }));
      return send(res, { items }, 3600, 86400);
    }
    if (trending !== undefined) {
      const j = await yget("https://query2.finance.yahoo.com/v1/finance/trending/US?count=25", { crumb: false });
      const syms = (j?.finance?.result?.[0]?.quotes || []).map(x => x.symbol).slice(0, 25);
      const qs = syms.length ? await quotes(syms) : [];
      const items = qs.filter(x => x.quoteType === "EQUITY").slice(0, 8).map(x => ({ s: x.symbol, n: x.shortName || x.longName || x.symbol, ex: x.fullExchangeName || x.exchange || "", chg: x.regularMarketChangePercent ?? null }));
      return send(res, { items }, 900, 3600);
    }
    if (s) {
      const sym = String(s).toUpperCase();
      const [qa] = await quotes([sym]);
      if (!qa) return res.status(404).json({ error: "not found" });
      const out = {
        t: qa.symbol, n: qa.longName || qa.shortName || qa.symbol, cur: qa.currency || "USD", ex: qa.fullExchangeName || qa.exchange || "",
        reg: US_EX.test(qa.exchange || "") || US_EX.test(qa.fullExchangeName || "") ? "US" : "INT",
        price: qa.regularMarketPrice ?? null, dchg: qa.regularMarketChangePercent ?? null,
        capLocal: qa.marketCap ? qa.marketCap / 1e9 : null, pe: qa.trailingPE ?? null, fpe: qa.forwardPE ?? null,
        ch: qa.fiftyTwoWeekChangePercent ?? null, div: qa.dividendYield ?? null, an: qa.averageAnalystRating || "",
        first: qa.firstTradeDateMilliseconds ? new Date(qa.firstTradeDateMilliseconds).getUTCFullYear() : null,
        cash: null, debt: null, secName: "", sec: "other", ys: [], g5: null
      };
      // market cap in USD
      out.cap = out.capLocal;
      if (out.capLocal != null && out.cur !== "USD") {
        try { const fxc = out.cur === "GBp" ? "GBP" : out.cur.toUpperCase(); const [fx] = await quotes([fxc + "USD=X"]); const r = fx?.regularMarketPrice; out.cap = r ? out.capLocal * (out.cur === "GBp" ? r / 100 : r) : null; } catch (e) { out.cap = null; }
      }
      try {
        const j = await yget(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=financialData,assetProfile`);
        const r = j?.quoteSummary?.result?.[0] || {}; const f = r.financialData || {};
        out.cash = f.totalCash?.raw != null ? f.totalCash.raw / 1e9 : null;
        out.debt = f.totalDebt?.raw != null ? f.totalDebt.raw / 1e9 : (f.totalCash ? 0 : null);
        out.finCur = f.financialCurrency || out.cur;
        out.secName = r.assetProfile?.sector || ""; out.sec = SECMAP[out.secName] || "other";
      } catch (e) { out.err1 = String(e.message || e); }
      try {
        const j = await yget(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=max&interval=3mo`, { crumb: false });
        const r = j?.chart?.result?.[0];
        if (r?.meta?.firstTradeDate) out.first = Math.min(out.first ?? 9999, new Date(r.meta.firstTradeDate * 1000).getUTCFullYear());
        const ts = r?.timestamp || [], cl = r?.indicators?.adjclose?.[0]?.adjclose || r?.indicators?.quote?.[0]?.close || [];
        const by = {}; ts.forEach((x, i) => { if (cl[i] != null) by[new Date(x * 1000).getUTCFullYear()] = cl[i]; });
        const Y = new Date().getUTCFullYear();
        for (let y = Y - 10; y <= Y; y++) out.ys.push(by[y] != null ? +by[y].toPrecision(4) : null);
        out.g5 = out.ys[10] != null && out.ys[5] ? (out.ys[10] / out.ys[5] - 1) * 100 : null;
      } catch (e) { out.err2 = String(e.message || e); }
      return send(res, out, 120, 600);
    }
    res.status(400).json({ error: "use ?q=, ?s= or ?trending=1" });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
}
