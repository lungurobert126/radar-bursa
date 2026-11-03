// Major news (CEO changes, layoffs) from Yahoo Finance search, filtered by keywords.
import { yget, pool, TICKERS, send } from "./_yahoo.js";
const CEO = /\bCEO\b|chief executive|steps? down|resign|successor|appoint(s|ed)? .*(chief|head)|names? new|to lead/i;
const LAY = /layoff|lay off|laid off|job cuts?|cut(s|ting)? [\d,.]+ ?(k |thousand )?(jobs|roles|positions|staff|employees|workers)|slash(es)? .*jobs|workforce reduction|redundanc/i;
export default async function handler(req, res) {
  const queries = [...TICKERS.map(t => ({ q: t, t })), { q: "CEO steps down" }, { q: "layoffs job cuts" }, { q: "names new CEO" }];
  const lists = await pool(queries, 8, async ({ q, t }) => {
    const j = await yget("https://query2.finance.yahoo.com/v1/finance/search?quotesCount=0&newsCount=10&q=" + encodeURIComponent(q), { crumb: false });
    return (j?.news || []).map(n => ({ ...n, _t: t }));
  });
  const seen = new Map();
  for (const list of lists) for (const n of (Array.isArray(list) ? list : [])) {
    const title = n.title || ""; const kind = LAY.test(title) ? "lay" : CEO.test(title) ? "ceo" : null;
    if (!kind) continue;
    const key = n.uuid || n.link; const prev = seen.get(key);
    const tick = new Set([...(prev?.tickers || []), ...(n.relatedTickers || []).filter(x => TICKERS.includes(x)), ...(n._t ? [n._t] : [])]);
    seen.set(key, { title, kind, link: n.link, publisher: n.publisher, time: (n.providerPublishTime || 0) * 1000, tickers: [...tick] });
  }
  const items = [...seen.values()].filter(x => Date.now() - x.time < 60 * 864e5).sort((a, b) => b.time - a.time).slice(0, 60);
  send(res, { updated: Date.now(), items }, 1800, 3600);
}
