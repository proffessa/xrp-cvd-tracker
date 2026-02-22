// api/exchange.js - Fixed: Binance/Bybit via CoinGecko fallback + safe JSON parsing
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
    const text = await response.text();
    if (text.trim().startsWith('<')) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function fetchFromCoinGecko(exchangeId, coinGeckoExchangeId) {
    try {
      const json = await safeFetch(
        `https://api.coingecko.com/api/v3/exchanges/${coinGeckoExchangeId}/tickers?coin_ids=ripple&include_exchange_logo=false&depth=false`
      );
      if (!json || !Array.isArray(json.tickers) || json.tickers.length === 0) return null;
      const ticker = json.tickers.find(t =>
        (t.base === 'XRP' || t.base === 'RIPPLE') &&
        (t.target === 'USDT' || t.target === 'USD')
      ) || json.tickers[0];
      if (!ticker) return null;
      const price = parseFloat(ticker.last);
      const volume = parseFloat(ticker.volume);
      const changePercent = parseFloat(ticker.bid_ask_spread_percentage) || 0;
      const buyRatio = 0.50 + (changePercent * 0.003);
      return {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    } catch {
      return null;
    }
  }

  try {
    let data = null;

    if (exchange === 'binance') {
      const endpoints = [
        'https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT',
        'https://api1.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT',
        'https://api2.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT',
        'https://api3.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT',
        'https://data.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT',
        'https://data-api.binance.vision/api/v3/ticker/24hr?symbol=XRPUSDT',
      ];

      let json = null;
      for (const url of endpoints) {
        try {
          json = await safeFetch(url);
          if (json && !json.code) break;
          json = null;
        } catch (e) { continue; }
      }

      if (json && !json.code) {
        const volume = parseFloat(json.volume);
        const price = parseFloat(json.lastPrice);
        const open = parseFloat(json.openPrice);
        const priceChange = (price - open) / open;
        const buyRatio = 0.50 + (priceChange * 0.3);
        data = {
          volume,
          price,
          buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
          sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
        };
      } else {
        data = await fetchFromCoinGecko('binance', 'binance');
        if (!data) throw new Error('Binance API error - all endpoints failed');
      }
    }
    else if (exchange === 'kraken') {
      const json = await safeFetch('https://api.kraken.com/0/public/Ticker?pair=XRPUSD');
      if (!json) throw new Error('Kraken returned invalid response');
      if (json.error?.length > 0) throw new Error(json.error[0]);
      const ticker = json.result.XXRPZUSD || json.result.XRPUSD;
      const volume = parseFloat(ticker.v[1]);
      const price = parseFloat(ticker.c[0]);
      const open = parseFloat(ticker.o);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'coinbase') {
      const json = await safeFetch('https://api.exchange.coinbase.com/products/XRP-USD/stats');
      if (!json) throw new Error('Coinbase returned invalid response');
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.last);
      const open = parseFloat(json.open);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'kucoin') {
      const json = await safeFetch('https://api.kucoin.com/api/v1/market/stats?symbol=XRP-USDT');
      if (!json) throw new Error('KuCoin returned invalid response');
      if (json.code !== '200000') throw new Error(json.msg);
      const ticker = json.data;
      const volume = parseFloat(ticker.vol);
      const price = parseFloat(ticker.last);
      const changeRate = parseFloat(ticker.changeRate);
      const buyRatio = 0.50 + (changeRate * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'gate') {
      const json = await safeFetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRP_USDT');
      if (!json) throw new Error('Gate.io returned invalid response');
      if (!Array.isArray(json) || json.length === 0) throw new Error('No data');
      const ticker = json[0];
      const volume = parseFloat(ticker.base_volume);
      const price = parseFloat(ticker.last);
      const changePercent = parseFloat(ticker.change_percentage);
      const buyRatio = 0.50 + (changePercent / 100 * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'okx') {
      const json = await safeFetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT');
      if (!json) throw new Error('OKX returned invalid response');
      if (json.code !== '0') throw new Error(json.msg);
      const ticker = json.data[0];
      const volume = parseFloat(ticker.vol24h);
      const price = parseFloat(ticker.last);
      const open = parseFloat(ticker.open24h);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'bybit') {
      const json = await safeFetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=XRPUSDT');
      if (json && json.retCode === 0 && json.result?.list?.[0]) {
        const ticker = json.result.list[0];
        const volume = parseFloat(ticker.volume24h);
        const price = parseFloat(ticker.lastPrice);
        const open = parseFloat(ticker.prevPrice24h);
        const priceChange = (price - open) / open;
        const buyRatio = 0.50 + (priceChange * 0.3);
        data = {
          volume,
          price,
          buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
          sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
        };
      } else {
        data = await fetchFromCoinGecko('bybit', 'bybit_spot');
        if (!data) throw new Error('Bybit API error - all endpoints failed');
      }
    }
    else if (exchange === 'bitstamp') {
      const json = await safeFetch('https://www.bitstamp.net/api/v2/ticker/xrpusd/');
      if (!json) throw new Error('Bitstamp returned invalid response');
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.last);
      const open = parseFloat(json.open);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'bitfinex') {
      const json = await safeFetch('https://api-pub.bitfinex.com/v2/ticker/tXRPUSD');
      if (!json) throw new Error('Bitfinex returned invalid response');
      if (!Array.isArray(json)) throw new Error('Invalid response');
      const volume = parseFloat(json[7]);
      const price = parseFloat(json[6]);
      const dailyChangePercent = parseFloat(json[4]);
      const buyRatio = 0.50 + (dailyChangePercent * 0.3);
      data = {
        volume,
        price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'upbit') {
      const json = await safeFetch('https://api.upbit.com/v1/ticker?markets=KRW-XRP');
      if (!json) throw new Error('Upbit returned invalid response');
      if (!Array.isArray(json) || json.length === 0) throw new Error('No data');
      const ticker = json[0];
      const volume = parseFloat(ticker.acc_trade_volume_24h);
      const priceKRW = parseFloat(ticker.trade_price);
      const changeRate = parseFloat(ticker.signed_change_rate);
      const krwToUsd = 1 / 1400;
      const priceUsd = priceKRW * krwToUsd;
      const buyRatio = 0.50 + (changeRate * 0.3);
      data = {
        volume,
        price: priceUsd,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    if (!data || isNaN(data.volume) || isNaN(data.price)) {
      throw new Error('Invalid data received');
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`API Error [${exchange}]:`, error.message);
    return res.status(500).json({ 
      error: error.message,
      exchange: exchange
    });
  }
}