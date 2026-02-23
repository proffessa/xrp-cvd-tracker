// api/debug-binance.js - Test which Binance/Bybit futures endpoints are reachable from Vercel
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const tests = [
    // Binance futures endpoints
    { name: 'fapi.binance.com/ticker/24hr', url: 'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=XRPUSDT' },
    { name: 'fapi.binance.com/takerBuySellVol', url: 'https://fapi.binance.com/futures/data/takerBuySellVol?symbol=XRPUSDT&period=5m&limit=1' },
    { name: 'fapi.binance.com/openInterest', url: 'https://fapi.binance.com/fapi/v1/openInterest?symbol=XRPUSDT' },
    { name: 'fapi.binance.com/topLongShortPositionRatio', url: 'https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=XRPUSDT&period=5m&limit=1' },
    { name: 'fapi.binance.com/bookTicker', url: 'https://fapi.binance.com/fapi/v1/ticker/bookTicker?symbol=XRPUSDT' },
    { name: 'dapi.binance.com/ticker', url: 'https://dapi.binance.com/dapi/v1/ticker/24hr?symbol=XRPUSD_PERP' },
    { name: 'api.binance.com/ticker/24hr', url: 'https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT' },
    { name: 'api3.binance.com/ticker/24hr', url: 'https://api3.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT' },
    // Bybit futures endpoints
    { name: 'api.bybit.com/tickers', url: 'https://api.bybit.com/v5/market/tickers?category=linear&symbol=XRPUSDT' },
    { name: 'api.bybit.com/account-ratio', url: 'https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1' },
    { name: 'api.bytick.com/tickers', url: 'https://api.bytick.com/v5/market/tickers?category=linear&symbol=XRPUSDT' },
    { name: 'api.bytick.com/account-ratio', url: 'https://api.bytick.com/v5/market/account-ratio?category=linear&symbol=XRPUSDT&period=1h&limit=1' },
    { name: 'api2.bybit.com/tickers', url: 'https://api2.bybit.com/v5/market/tickers?category=linear&symbol=XRPUSDT' },
  ];

  const results = await Promise.all(
    tests.map(async ({ name, url }) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        clearTimeout(timeout);
        const text = await response.text();
        const isJson = !text.trim().startsWith('<');
        return {
          name,
          url,
          status: response.status,
          ok: response.ok,
          isJson,
          preview: isJson ? text.slice(0, 120) : 'NOT JSON',
        };
      } catch (err) {
        return {
          name,
          url,
          status: 0,
          ok: false,
          isJson: false,
          preview: err.message,
        };
      }
    })
  );

  return res.status(200).json({ results });
}