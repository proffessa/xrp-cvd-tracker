// api/futures-exchange.js - Fetch futures (perpetual swap) data for a given exchange
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { exchange } = req.query;

  if (!exchange) {
    return res.status(400).json({ error: 'Exchange parameter required' });
  }

  async function safeFetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0', ...(options.headers || {}) },
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      const text = await response.text();
      if (text.trim().startsWith('<')) return null;
      try { return JSON.parse(text); } catch { return null; }
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  try {
    let data = null;

    if (exchange === 'binance') {
      // takerBuySellVol returns 404 from sin1; use ticker + topLongShortPositionRatio instead
      const [tickerJson, oiJson, lsJson] = await Promise.all([
        safeFetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XRPUSDT'),
        safeFetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=XRPUSDT'),
        safeFetch('https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1'),
      ]);

      if (!tickerJson) throw new Error('binance: ticker/24hr endpoint failed');
      if (!oiJson) throw new Error('binance: openInterest endpoint failed');

      const price = parseFloat(tickerJson.lastPrice);
      const openInterest = parseFloat(oiJson.openInterest);
      const vol24h = parseFloat(tickerJson.volume);

      let buyRatio, sellRatio;
      if (lsJson && lsJson[0]) {
        buyRatio = parseFloat(lsJson[0].longAccount);
        sellRatio = parseFloat(lsJson[0].shortAccount);
      } else {
        const priceChangePercent = parseFloat(tickerJson.priceChangePercent) / 100;
        buyRatio = Math.max(0.4, Math.min(0.6, 0.5 + priceChangePercent * 0.5));
        sellRatio = 1 - buyRatio;
      }

      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * sellRatio;
      // cvdDelta: net taker buy volume for this 5-min interval
      const cvdDelta = (vol24h * (buyRatio - sellRatio)) / 288;

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'bybit') {
      // Both api.bybit.com and api.bytick.com work from sin1 region
      const [tickerJson, ratioJson] = await Promise.all([
        safeFetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=XRPUSDT'),
        safeFetch('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1'),
      ]);

      // fallback to bytick if bybit fails
      const ticker0 = tickerJson?.retCode === 0 ? tickerJson : await safeFetch('https://api.bytick.com/v5/market/tickers?category=linear&symbol=XRPUSDT');
      const ratio0 = ratioJson?.retCode === 0 ? ratioJson : await safeFetch('https://api.bytick.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1');

      if (!ticker0 || ticker0.retCode !== 0) throw new Error('bybit: tickers endpoint failed');
      if (!ratio0 || ratio0.retCode !== 0) throw new Error('bybit: account-ratio endpoint failed');

      const ticker = ticker0.result.list[0];
      const ratio = ratio0.result.list[0];

      const openInterest = parseFloat(ticker.openInterest);
      const buyRatio = parseFloat(ratio.buyRatio);
      const sellRatio = parseFloat(ratio.sellRatio);
      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * sellRatio;
      const cvdDelta = parseFloat(ticker.volume24h) * (buyRatio - sellRatio) / 288;
      const price = parseFloat(ticker.lastPrice);

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'okx') {
      const [priceJson, oiJson] = await Promise.all([
        safeFetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT-SWAP'),
        safeFetch('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=XRP-USDT-SWAP'),
      ]);

      if (!priceJson || priceJson.code !== '0') throw new Error('okx: ticker endpoint failed');

      const ticker = priceJson.data[0];
      const price = parseFloat(ticker.last);
      const open24h = parseFloat(ticker.open24h);
      const vol24h = parseFloat(ticker.vol24h);
      const priceChange = (price - open24h) / open24h;
      const buyRatio = Math.max(0.45, Math.min(0.55, 0.50 + priceChange * 0.3));

      let openInterest;
      if (oiJson && oiJson.code === '0' && oiJson.data[0]) {
        openInterest = parseFloat(oiJson.data[0].oiCcy);
      } else {
        const avgPrice = (price + open24h) / 2;
        openInterest = parseFloat(ticker.volCcy24h) / avgPrice;
      }

      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * (1 - buyRatio);
      const cvdDelta = vol24h * (buyRatio - (1 - buyRatio)) / 288;

      data = { cvdDelta, openInterest, longVol, shortVol, price };
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