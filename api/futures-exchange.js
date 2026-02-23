// api/futures-exchange.js - Fetch futures (perpetual swap) data for a given exchange
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  const { exchange } = req.query;
  if (!exchange) return res.status(400).json({ error: 'Exchange parameter required' });

  async function safeFetch(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const r = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
      clearTimeout(timeout);
      if (!r.ok) return null;
      const text = await r.text();
      if (text.trim().startsWith('<')) return null;
      try { return JSON.parse(text); } catch { return null; }
    } catch { clearTimeout(timeout); return null; }
  }

  try {
    let data = null;

    if (exchange === 'binance') {
      const [t, oi, ls] = await Promise.all([
        safeFetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XRPUSDT'),
        safeFetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=XRPUSDT'),
        safeFetch('https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1'),
      ]);
      if (!t) throw new Error('binance: ticker failed');
      if (!oi) throw new Error('binance: openInterest failed');
      const price = parseFloat(t.lastPrice);
      const OI = parseFloat(oi.openInterest);
      const vol = parseFloat(t.volume);
      let br = ls?.[0] ? parseFloat(ls[0].longAccount) : Math.max(0.4, Math.min(0.6, 0.5 + parseFloat(t.priceChangePercent) / 100 * 0.5));
      let sr = 1 - br;
      data = { cvdDelta: vol * (br - sr) / 288, openInterest: OI, longVol: OI * br, shortVol: OI * sr, price };
    }

    else if (exchange === 'bybit') {
      const [tj, rj] = await Promise.all([
        safeFetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=XRPUSDT'),
        safeFetch('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1'),
      ]);
      const t0 = tj?.retCode === 0 ? tj : await safeFetch('https://api.bytick.com/v5/market/tickers?category=linear&symbol=XRPUSDT');
      const r0 = rj?.retCode === 0 ? rj : await safeFetch('https://api.bytick.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1');
      if (!t0 || t0.retCode !== 0) throw new Error('bybit: tickers failed');
      if (!r0 || r0.retCode !== 0) throw new Error('bybit: account-ratio failed');
      const t = t0.result.list[0], r = r0.result.list[0];
      const oi = parseFloat(t.openInterest), br = parseFloat(r.buyRatio), sr = parseFloat(r.sellRatio);
      data = { cvdDelta: parseFloat(t.volume24h) * (br - sr) / 288, openInterest: oi, longVol: oi * br, shortVol: oi * sr, price: parseFloat(t.lastPrice) };
    }

    else if (exchange === 'okx') {
      const [pj, oj] = await Promise.all([
        safeFetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT-SWAP'),
        safeFetch('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=XRP-USDT-SWAP'),
      ]);
      if (!pj || pj.code !== '0') throw new Error('okx: ticker failed');
      const t = pj.data[0], price = parseFloat(t.last), open24h = parseFloat(t.open24h), vol = parseFloat(t.vol24h);
      const br = Math.max(0.45, Math.min(0.55, 0.5 + (price - open24h) / open24h * 0.3));
      const oi = (oj?.code === '0' && oj.data[0]) ? parseFloat(oj.data[0].oiCcy) : parseFloat(t.volCcy24h) / ((price + open24h) / 2);
      data = { cvdDelta: vol * (br - (1 - br)) / 288, openInterest: oi, longVol: oi * br, shortVol: oi * (1 - br), price };
    }

    else if (exchange === 'kucoin') {
      const [tj, cj] = await Promise.all([
        safeFetch('https://api-futures.kucoin.com/api/v1/ticker?symbol=XRPUSDTM'),
        safeFetch('https://api-futures.kucoin.com/api/v1/contracts/XRPUSDTM'),
      ]);
      if (!tj || tj.code !== '200000') throw new Error('kucoin: futures ticker failed');
      const t = tj.data, price = parseFloat(t.price);
      const bs = parseFloat(t.bestBidSize || 0), as2 = parseFloat(t.bestAskSize || 0);
      const br = Math.max(0.45, Math.min(0.55, bs / (bs + as2 || 1))), sr = 1 - br;
      const oi = (cj?.code === '200000' && cj.data) ? parseFloat(cj.data.openInterest || 0) * parseFloat(cj.data.multiplier || 1) : 0;
      data = { cvdDelta: oi * (br - sr) / 288, openInterest: oi, longVol: oi * br, shortVol: oi * sr, price };
    }

    else if (exchange === 'gate') {
      const [tj, cj] = await Promise.all([
        safeFetch('https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=XRP_USDT'),
        safeFetch('https://api.gateio.ws/api/v4/futures/usdt/contracts/XRP_USDT'),
      ]);
      if (!tj || !Array.isArray(tj) || !tj[0]) throw new Error('gate: futures ticker failed');
      const t = tj[0], price = parseFloat(t.last), vol = parseFloat(t.volume_24h_base || t.volume_24h || 0);
      const br = Math.max(0.45, Math.min(0.55, 0.5 + parseFloat(t.change_percentage || 0) / 100 * 0.3)), sr = 1 - br;
      let oi = 0;
      if (cj) {
        const qm = parseFloat(cj.quanto_multiplier || cj.multiplier || 1);
        oi = Math.abs(parseFloat(cj.position_size || 0)) * qm;
      }
      if (oi === 0 && t.total_size) oi = parseFloat(t.total_size);
      data = { cvdDelta: vol * (br - sr) / 288, openInterest: oi, longVol: oi * br, shortVol: oi * sr, price };
    }

    else if (exchange === 'kraken') {
      const tj = await safeFetch('https://futures.kraken.com/derivatives/api/v3/tickers');
      if (!tj || tj.result !== 'success') throw new Error('kraken: futures tickers failed');
      const t = tj.tickers?.find(x => x.symbol === 'PF_XRPUSD') ||
                tj.tickers?.find(x => x.symbol === 'PI_XRPUSD') ||
                tj.tickers?.find(x => x.symbol?.toUpperCase().includes('XRP'));
      if (!t) throw new Error('kraken: XRP ticker not found');
      const price = parseFloat(t.last || t.markPrice || 0);
      const oi = parseFloat(t.openInterest || 0);
      // Kraken has no public long/short ratio
      data = { cvdDelta: 0, openInterest: oi, longVol: oi * 0.5, shortVol: oi * 0.5, price };
    }

    else if (exchange === 'bitfinex') {
      const tj = await safeFetch('https://api-pub.bitfinex.com/v2/ticker/tXRPF0:USTF0');
      if (!tj || !Array.isArray(tj)) throw new Error('bitfinex: futures ticker failed');
      // [BID, BID_SIZE, ASK, ASK_SIZE, DAILY_CHANGE, DAILY_CHANGE_RELATIVE, LAST_PRICE, VOLUME, HIGH, LOW]
      const price = parseFloat(tj[6]), vol = parseFloat(tj[7]);
      const bs = parseFloat(tj[1]), as2 = parseFloat(tj[3]);
      const br = Math.max(0.45, Math.min(0.55, bs / (bs + as2 || 1))), sr = 1 - br;
      // OI not available via public API for tXRPF0:USTF0
      data = { cvdDelta: vol * (br - sr) / 288, openInterest: 0, longVol: 0, shortVol: 0, price };
    }

    else {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Futures API Error [${exchange}]:`, error.message);
    return res.status(500).json({ error: error.message, exchange });
  }
}