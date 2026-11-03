// Minimal Yahoo Finance client (cookie + crumb), no dependencies.
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9" };
let session = null; // { cookie, crumb, at }

async function newSession() {
  const r = await fetch("https://fc.yahoo.com/", { headers: UA, redirect: "manual" });
  const raw = typeof r.headers.getSetCookie === "function" ? r.headers.getSetCookie() : [r.headers.get("set-cookie") || ""];
  const cookie = raw.filter(Boolean).map(c => c.split(";")[0]).join("; ");
  const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { ...UA, cookie } });
  const crumb = (await c.text()).trim();
  if (!c.ok || !crumb || crumb.includes("<")) throw new Error("crumb failed: " + c.status + " " + crumb.slice(0, 80));
  session = { cookie, crumb, at: Date.now() };
  return session;
}
async function getSession(force) {
  if (!force && session && Date.now() - session.at < 30 * 60e3) return session;
  return newSession();
}
export async function yget(url, { crumb = true } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const s = await getSession(attempt > 0);
    const u = crumb ? url + (url.includes("?") ? "&" : "?") + "crumb=" + encodeURIComponent(s.crumb) : url;
    const r = await fetch(u, { headers: { ...UA, cookie: s.cookie } });
    if (r.status === 401 || r.status === 403) continue;
    if (!r.ok) throw new Error(r.status + " " + url);
    return r.json();
  }
  throw new Error("unauthorized " + url);
}
export async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = { error: String(e.message || e) }; } } }));
  return out;
}
export const TICKERS = "AAPL MSFT GOOGL NVDA CSCO ORCL ADBE QCOM TXN ADI AMAT LRCX KLAC ACN IBM CTSH INTC META AVGO ASML SAP STM JNJ LLY MRK PFE AMGN GILD REGN VRTX ISRG MDT SYK ABT BMY TMO NVO NVS AZN SNY GSK RHHBY XOM CVX COP EOG SLB SHEL TTE BP EQNR E KO PEP MDLZ HSY GIS MNST ADM UL NSRGY AMZN TSLA BRK-B JPM V WMT HSBC LVMUY HESAY SIEGY SBGSY IDEXY".split(" ");
export function send(res, body, maxAge, swr) {
  res.setHeader("Cache-Control", `public, s-maxage=${maxAge}, stale-while-revalidate=${swr}`);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify(body));
}
