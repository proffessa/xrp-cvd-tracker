// api/debug-futures.js - Test Gate.io, Kraken, Bitfinex OI endpoints
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  async function safeFetch(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      clearTimeout(timeout);
      const text = await response.text();
      const isJson = !text.trim().startsWith('<');
      return { status: response.status, ok: response.ok, isJson, preview: isJson ? text.slice(0, 200) : 'NOT JSON' };
    } catch (err) {
      clearTimeout(timeout);
      return { status: 0, ok: false, isJson: false, preview: err.message };
    }
  }

  const tests = [
    // Gate.io OI
    { name: 'gate: futures tickers (XRP_USDT)', url: 'https://api.gateio.ws/api/v4/futures/usdt/tickers?contract=XRP_USDT' },
    { name: 'gate: futures contract (XRP_USDT)', url: 'https://api.gateio.ws/api/v4/futures/usdt/contracts/XRP_USDT' },
    // Kraken futures tickers - list all to find XRP symbol
    { name: 'kraken: all futures tickers', url: 'https://futures.kraken.com/derivatives/api/v3/tickers' },
    { name: 'kraken: instruments list', url: 'https://futures.kraken.com/derivatives/api/v3/instruments' },
    // Bitfinex OI endpoints
    { name: 'bitfinex: futures ticker tXRPF0:USTF0', url: 'https://api-pub.bitfinex.com/v2/ticker/tXRPF0:USTF0' },
    { name: 'bitfinex: pos.size last', url: 'https://api-pub.bitfinex.com/v2/stats1/pos.size:1m:tXRPF0:USTF0/last' },
    { name: 'bitfinex: pos.size hist', url: 'https://api-pub.bitfinex.com/v2/stats1/pos.size:1m:tXRPF0:USTF0/hist?limit=1' },
    { name: 'bitfinex: open.interest last', url: 'https://api-pub.bitfinex.com/v2/stats1/open.interest:1m:tXRPF0:USTF0/last' },
  ];

  const results = await Promise.all(tests.map(async ({ name, url }) => ({ name, url, ...(await safeFetch(url)) })));
  return res.status(200).json({ results });
}