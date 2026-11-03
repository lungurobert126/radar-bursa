// Slow-moving data: cash & debt (balance sheet) and 10-year price history.
import { yget, pool, TICKERS, send } from "./_yahoo.js";
export default async function handler(req, res) {
  const rows = await pool(TICKERS, 8, async (t) => {
    const out = { cash: null, debt: null, ys: [], g5: null, first: null };
    try {
      const j = await yget(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=financialData`);
      const f = j?.quoteSummary?.result?.[0]?.financialData || {};
      out.cash = f.totalCash?.raw != null ? f.totalCash.raw / 1e9 : null;
      out.debt = f.totalDebt?.raw != null ? f.totalDebt.raw / 1e9 : (f.totalCash ? 0 : null);
    } catch (e) { out.err1 = String(e.message || e); }
    try {
      const j = await yget(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=max&interval=3mo`, { crumb: false });
      const r = j?.chart?.result?.[0];
      out.first = r?.meta?.firstTradeDate ? new Date(r.meta.firstTradeDate * 1000).getUTCFullYear() : null;
      const ts = r?.timestamp || [], cl = r?.indicators?.adjclose?.[0]?.adjclose || r?.indicators?.quote?.[0]?.close || [];
      const byYear = {};
      ts.forEach((s, i) => { if (cl[i] != null) byYear[new Date(s * 1000).getUTCFullYear()] = cl[i]; });
      const Y = new Date().getUTCFullYear();
      for (let y = Y - 10; y <= Y; y++) out.ys.push(byYear[y] != null ? +byYear[y].toPrecision(4) : null);
      const now = out.ys[10], ago = out.ys[5];
      out.g5 = now != null && ago ? (now / ago - 1) * 100 : null;
      out.startYear = Y - 10;
    } catch (e) { out.err2 = String(e.message || e); }
    return out;
  });
  const data = {}; TICKERS.forEach((t, i) => data[t] = rows[i]);
  send(res, { updated: Date.now(), data }, 6 * 3600, 24 * 3600);
}
