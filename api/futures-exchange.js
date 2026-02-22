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
      const [takerJson, oiJson, lsJson, priceJson] = await Promise.all([
        safeFetchWithFallback([
          'https://fapi.binance.com/futures/data/takerBuySellVol?symbol=XRPUSDT&period=5m&limit=1',
          'https://www.binance.com/futures/data/takerBuySellVol?symbol=XRPUSDT&period=5m&limit=1',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/fapi/v1/openInterest?symbol=XRPUSDT',
          'https://www.binance.com/fapi/v1/openInterest?symbol=XRPUSDT',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1',
          'https://www.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1',
        ]),
        safeFetchWithFallback([
          'https://fapi.binance.com/fapi/v1/ticker/price?symbol=XRPUSDT',
          'https://www.binance.com/fapi/v1/ticker/price?symbol=XRPUSDT',
        ]),
      ]);

      if (!takerJson) throw new Error(`${exchange}: takerBuySellVol endpoint failed`);
      if (!oiJson) throw new Error(`${exchange}: openInterest endpoint failed`);
      if (!lsJson) throw new Error(`${exchange}: topLongShortPositionRatio endpoint failed`);
      if (!priceJson) throw new Error(`${exchange}: ticker/price endpoint failed`);

      const latest = takerJson[0];
      const cvdDelta = parseFloat(latest.buyVol) - parseFloat(latest.sellVol);
      const openInterest = parseFloat(oiJson.openInterest);
      const lsLatest = lsJson[0];
      const longVol = openInterest * parseFloat(lsLatest.longAccount);
      const shortVol = openInterest * parseFloat(lsLatest.shortAccount);
      const price = parseFloat(priceJson.price);

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'bybit') {
      const [tickerJson, oiJson, ratioJson] = await Promise.all([
        safeFetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=XRPUSDT'),
        safeFetch('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=XRPUSDT&intervalTime=5min&limit=1'),
        safeFetch('https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=5min&limit=1'),
      ]);

      if (!tickerJson) throw new Error(`${exchange}: tickers endpoint failed`);
      if (!oiJson) throw new Error(`${exchange}: open-interest endpoint failed`);
      if (!ratioJson) throw new Error(`${exchange}: account-ratio endpoint failed`);

      const ticker = tickerJson?.result?.list?.[0];
      const oiEntry = oiJson?.result?.list?.[0];
      const ratio = ratioJson?.result?.list?.[0];

      if (!ticker || !oiEntry || !ratio) throw new Error(`${exchange}: missing nested data in response`);

      const openInterest = parseFloat(oiEntry.openInterest);
      const buyRatio = parseFloat(ratio.buyRatio);
      const longVol = openInterest * buyRatio;
      const shortVol = openInterest * parseFloat(ratio.sellRatio);
      const cvdDelta = parseFloat(ticker.volume24h) * (buyRatio - (1 - buyRatio)) / 288; // 288 = 24h * 60min / 5min intervals
      const price = parseFloat(ticker.lastPrice);

      data = { cvdDelta, openInterest, longVol, shortVol, price };
    }
    else if (exchange === 'okx') {
      const [takerJson, oiJson, lsJson, priceJson] = await Promise.all([
        safeFetch('https://www.okx.com/api/v5/market/taker-volume?instId=XRP-USDT-SWAP&instType=SWAP&period=5m&limit=1'),
        safeFetch('https://www.okx.com/api/v5/market/open-interest?instId=XRP-USDT-SWAP'),
        safeFetch('https://www.okx.com/api/v5/market/long-short-account-ratio?instId=XRP-USDT-SWAP&period=5m&limit=1'),
        safeFetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT-SWAP'),
      ]);

      if (!takerJson) throw new Error(`${exchange}: taker-volume endpoint failed`);
      if (!oiJson) throw new Error(`${exchange}: open-interest endpoint failed`);
      if (!lsJson) throw new Error(`${exchange}: long-short-account-ratio endpoint failed`);
      if (!priceJson) throw new Error(`${exchange}: ticker endpoint failed`);

      if (takerJson.code !== '0') throw new Error(`${exchange}: taker-volume error: ${takerJson.msg}`);
      if (oiJson.code !== '0') throw new Error(`${exchange}: open-interest error: ${oiJson.msg}`);
      if (lsJson.code !== '0') throw new Error(`${exchange}: long-short-account-ratio error: ${lsJson.msg}`);
      if (priceJson.code !== '0') throw new Error(`${exchange}: ticker error: ${priceJson.msg}`);

      const takerRow = takerJson.data[0];
      const cvdDelta = parseFloat(takerRow[2]) - parseFloat(takerRow[1]);
      const openInterest = parseFloat(oiJson.data[0].oi);
      const ratio = parseFloat(lsJson.data[0][1]);
      const longVol = openInterest * (ratio / (1 + ratio));
      const shortVol = openInterest * (1 / (1 + ratio));
      const price = parseFloat(priceJson.data[0].last);

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
