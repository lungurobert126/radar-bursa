// Major market news from Yahoo Finance search, grouped by type.
import { yget, pool, TICKERS, send } from "./_yahoo.js";
const RULES = [
  ["ceo", /\bCEO\b.*(step|resign|retire|exit|depart|oust|replac|succe|appoint|name|new|interim)|(step|resign|retire|oust|appoint|name[sd]?|new|interim) .*\b(CEO|chief executive)\b|successor/i],
  ["lay", /layoff|lay off|laid off|job cuts?|cut(s|ting)? .*\b(jobs|roles|positions|staff|employees|workers)\b|workforce reduction|redundanc|restructur/i],
  ["ma", /\b(merger|merge|acquir|acquisition|takeover|buyout|to buy|deal to|bid for|spin.?off|IPO)\b/i],
  ["earn", /\b(earnings|quarterly|Q[1-4]|results|revenue|profit|guidance|outlook|forecast|beats?|miss(es)?)\b/i],
  ["macro", /\b(Fed|Federal Reserve|ECB|interest rates?|rate (cut|hike)|inflation|CPI|jobs report|payrolls|GDP|recession|tariffs?|treasur(y|ies)|bond yields?|oil prices?|dollar)\b/i],
];
const GENERAL = ["stock market today", "Wall Street stocks", "European stocks", "Federal Reserve", "inflation", "earnings", "merger acquisition", "CEO steps down", "layoffs", "oil prices", "tariffs", "S&P 500", "Nasdaq", "Dow Jones"];
export default async function handler(req, res) {
  const queries = [...GENERAL.map(q => ({ q })), ...TICKERS.map(t => ({ q: t, t }))];
  const lists = await pool(queries, 8, async ({ q, t }) => {
    const j = await yget("https://query2.finance.yahoo.com/v1/finance/search?quotesCount=0&newsCount=10&q=" + encodeURIComponent(q), { crumb: false });
    return (j?.news || []).map(n => ({ ...n, _t: t }));
  });
  const seen = new Map();
  for (const list of lists) for (const n of (Array.isArray(list) ? list : [])) {
    if (!n.title || !n.link) continue;
    const kind = (RULES.find(([, re]) => re.test(n.title)) || ["mkt"])[0];
    const key = n.uuid || n.link; const prev = seen.get(key);
    const tick = new Set([...(prev?.tickers || []), ...(n.relatedTickers || []).filter(x => TICKERS.includes(x)), ...(n._t ? [n._t] : [])]);
    seen.set(key, { title: n.title, kind, link: n.link, publisher: n.publisher, time: (n.providerPublishTime || 0) * 1000, tickers: [...tick] });
  }
  const items = [...seen.values()].filter(x => Date.now() - x.time < 14 * 864e5).sort((a, b) => b.time - a.time).slice(0, 150);
  send(res, { updated: Date.now(), items }, 900, 3600);
}
