// Next page of large companies (by market cap) from Yahoo's screener: ?offset=0&size=25
import { yget, send, ensureSession } from "./_yahoo.js";
const UA = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36", "Content-Type": "application/json" };
const REGIONS = ["us", "de", "fr", "gb", "nl", "ch", "es", "it", "se", "dk", "no", "be", "fi", "ie"];
export default async function handler(req, res) {
  const offset = Math.max(0, parseInt(req.query?.offset || "0", 10) || 0);
  const size = Math.min(50, Math.max(5, parseInt(req.query?.size || "25", 10) || 25));
  let symbols = [], source = "screener";
  try {
    const info = await ensureSession();
    const body = {
      size, offset, sortField: "intradaymarketcap", sortType: "DESC", quoteType: "EQUITY", userId: "", userIdType: "guid",
      query: { operator: "AND", operands: [
        { operator: "GT", operands: ["intradaymarketcap", 10e9] },
        { operator: "OR", operands: REGIONS.map(r => ({ operator: "EQ", operands: ["region", r] })) }
      ] }
    };
    const r = await fetch("https://query2.finance.yahoo.com/v1/finance/screener?crumb=" + encodeURIComponent(info.crumb), { method: "POST", headers: { ...UA, cookie: info.cookie }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error("screener " + r.status);
    const j = await r.json();
    symbols = (j?.finance?.result?.[0]?.quotes || []).map(q => q.symbol);
    if (!symbols.length) throw new Error("empty");
  } catch (e) {
    source = "predefined";
    const j = await yget(`https://query2.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=most_actives&count=${size}&start=${offset}`);
    symbols = (j?.finance?.result?.[0]?.quotes || []).map(q => q.symbol);
  }
  send(res, { offset, size, source, symbols }, 3600, 86400);
}
