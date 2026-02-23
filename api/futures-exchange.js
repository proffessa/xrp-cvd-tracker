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
    const response = await fetch(url, { ...options, headers: { 'User-Agent': 'Mozilla/5.0', ...(options.headers || {}) } });
    if (!response.ok) return null;
    const text = await response.text();
    if (text.trim().startsWith('<')) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function safeFetchWithFallback(urls) {
    for (const url of urls) {
      try {
        const result = await safeFetch(url);
        if (result !== null) return result;
      } catch {
        continue;
      }
    }
    return null;
  }

  try {
    let data = null;

    if (exchange === 'binance') {
      const [takerJson, oiJson, lsJson, tickerJson] = await Promise.all([
        safeFetchWithFallback([
          'https://fapi.binance.com/futures/data/takerBuySellVol?symbol=XRPUSDT&period=5m&limit=1',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/fapi/v1/openInterest?symbol=XRPUSDT',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XRPUSDT',
        ]),
      ]);

      if (!tickerJson) throw new Error('binance: ticker/24hr endpoint failed');
      if (!oiJson) throw new Error('binance: openInterest endpoint failed');

      let cvdDelta;
      if (takerJson && takerJson[0]) {
        const latest = takerJson[0];
        cvdDelta = parseFloat(latest.buyVol) - parseFloat(latest.sellVol);
      } else {
        const vol = parseFloat(tickerJson.volume);
        const priceChangePercent = parseFloat(tickerJson.priceChangePercent) / 100;
        const buyRatio = Math.max(0.4, Math.min(0.6, 0.5 + priceChangePercent * 0.5)); // clamp 40-60%, skew by price change
        cvdDelta = (vol * (buyRatio - (1 - buyRatio))) / 288; // 288 = 24h * 60min / 5min intervals
      }

      const openInterest = parseFloat(oiJson.openInterest);
      let longVol, shortVol;
      if (lsJson && lsJson[0]) {
        longVol = openInterest * parseFloat(lsJson[0].longAccount);
        shortVol = openInterest * parseFloat(lsJson[0].shortAccount);
      } else {
        longVol = openInterest * 0.5;
        shortVol = openInterest * 0.5;
      }
      const price = parseFloat(tickerJson.lastPrice);

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'bybit') {
      // api.bybit.com is blocked from Vercel; api.bytick.com is Bybit's official backup domain
      const [tickerJson, ratioJson] = await Promise.all([
        safeFetch('https://api.bytick.com/v5/market/tickers?category=linear&symbol=XRPUSDT'),
        safeFetch('https://api.bytick.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1'),
      ]);

      if (!tickerJson || tickerJson.retCode !== 0) throw new Error('bybit: tickers endpoint failed');
      if (!ratioJson || ratioJson.retCode !== 0) throw new Error('bybit: account-ratio endpoint failed');

      const ticker = tickerJson.result.list[0];
      const ratio = ratioJson.result.list[0];

      const openInterest = parseFloat(ticker.openInterest);
      const buyRatio = parseFloat(ratio.buyRatio);
      const sellRatio = parseFloat(ratio.sellRatio);
      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * sellRatio;
      const cvdDelta = parseFloat(ticker.volume24h) * (buyRatio - sellRatio) / 288; // 288 = 24h * 60min / 5min intervals
      const price = parseFloat(ticker.lastPrice);

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'okx') {
      const priceJson = await safeFetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT-SWAP');

      if (!priceJson || priceJson.code !== '0') throw new Error('okx: ticker endpoint failed');

      const ticker = priceJson.data[0];
      const price = parseFloat(ticker.last);
      const open24h = parseFloat(ticker.open24h);
      const vol24h = parseFloat(ticker.vol24h); // contract sayısı
      const priceChange = (price - open24h) / open24h;
      const buyRatio = Math.max(0.45, Math.min(0.55, 0.50 + priceChange * 0.3)); // clamp 45-55%, skew by price change

      // openInterest için volCcy24h / 24h ortalama fiyat yaklaşımı
      const avgPrice = (price + open24h) / 2;
      const openInterest = parseFloat(ticker.volCcy24h) / avgPrice; // yaklaşım
      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * (1 - buyRatio);
      const cvdDelta = vol24h * (buyRatio - (1 - buyRatio)) / 288; // 288 = 24h * 60min / 5min intervals

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Futures API Error [${exchange}]:`, error.message);
    return res.status(500).json({
      error: error.message,
      exchange: exchange
    });
  }
}
