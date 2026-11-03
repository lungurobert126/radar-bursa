// Live quotes: price, market cap, P/E, 52-week change, dividend, analyst rating, first trade date.
import { yget, TICKERS, send } from "./_yahoo.js";
export default async function handler(req, res) {
  try {
    const data = {}; const errors = [];
    for (let i = 0; i < TICKERS.length; i += 40) {
      const chunk = TICKERS.slice(i, i + 40);
      try {
        const j = await yget("https://query2.finance.yahoo.com/v7/finance/quote?symbols=" + chunk.join(","));
        for (const q of j?.quoteResponse?.result || []) {
          data[q.symbol] = {
            price: q.regularMarketPrice ?? null, dchg: q.regularMarketChangePercent ?? null, cur: q.currency || "USD",
            cap: q.marketCap ? q.marketCap / 1e9 : null, pe: q.trailingPE ?? null, fpe: q.forwardPE ?? null,
            ch: q.fiftyTwoWeekChangePercent ?? null, div: q.dividendYield ?? (q.trailingAnnualDividendYield != null ? q.trailingAnnualDividendYield * 100 : null),
            an: q.averageAnalystRating || "", first: q.firstTradeDateMilliseconds ? new Date(q.firstTradeDateMilliseconds).getUTCFullYear() : null,
            t: q.regularMarketTime ? q.regularMarketTime * 1000 : null
          };
        }
      } catch (e) { errors.push(String(e.message || e)); }
    }
    send(res, { updated: Date.now(), data, errors }, 60, 300);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
}
