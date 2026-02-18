// api/exchange.js - Exchange API with Supabase integration
export default async function handler(req, res) {
  // CORS headers
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

  try {
    let data = null;

    if (exchange === 'binance') {
      try {
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT', {
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.status === 451) {
          const altResponse = await fetch('https://api1.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT');
          if (!altResponse.ok) throw new Error('Binance blocked');
          const json = await altResponse.json();
          const volume = parseFloat(json.volume);
          const price = parseFloat(json.lastPrice);
          const priceChange = parseFloat(json.priceChangePercent);
          const buyRatio = 0.50 + (priceChange / 100 * 0.5);
          data = {
            volume: volume,
            price: price,
            buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
            sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
          };
        } else if (!response.ok) {
          throw new Error(`Binance: ${response.status}`);
        } else {
          const json = await response.json();
          const volume = parseFloat(json.volume);
          const price = parseFloat(json.lastPrice);
          const priceChange = parseFloat(json.priceChangePercent);
          const buyRatio = 0.50 + (priceChange / 100 * 0.5);
          data = {
            volume: volume,
            price: price,
            buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
            sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
          };
        }
      } catch (error) {
        throw new Error(`Binance: ${error.message}`);
      }
    }
    else if (exchange === 'kraken') {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XRPUSD');
      const json = await response.json();
      if (json.error?.length > 0) throw new Error(json.error[0]);
      const ticker = json.result.XXRPZUSD || json.result.XRPUSD;
      const volume = parseFloat(ticker.v[1]);
      const price = parseFloat(ticker.c[0]);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * 0.505,
        sellVolume: volume * 0.495
      };
    }
    else if (exchange === 'coinbase') {
      const response = await fetch('https://api.exchange.coinbase.com/products/XRP-USD/stats');
      const json = await response.json();
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.last);
      const open = parseFloat(json.open);
      const priceChange = ((price - open) / open) * 100;
      const buyRatio = 0.50 + (priceChange * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'kucoin') {
      const response = await fetch('https://api.kucoin.com/api/v1/market/stats?symbol=XRP-USDT');
      const json = await response.json();
      if (json.code !== '200000') throw new Error(json.msg);
      const ticker = json.data;
      const volume = parseFloat(ticker.vol);
      const price = parseFloat(ticker.last);
      const changeRate = parseFloat(ticker.changeRate);
      const buyRatio = 0.50 + (changeRate * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'gate') {
      const response = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRP_USDT');
      const json = await response.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error('No data');
      const ticker = json[0];
      const volume = parseFloat(ticker.base_volume);
      const price = parseFloat(ticker.last);
      const changePercent = parseFloat(ticker.change_percentage);
      const buyRatio = 0.50 + (changePercent / 100 * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'okx') {
      const response = await fetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT');
      const json = await response.json();
      if (json.code !== '0') throw new Error(json.msg);
      const ticker = json.data[0];
      const volume = parseFloat(ticker.vol24h);
      const price = parseFloat(ticker.last);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * 0.506,
        sellVolume: volume * 0.494
      };
    }
    else if (exchange === 'bybit') {
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=XRPUSDT');
      const json = await response.json();
      if (json.retCode !== 0) throw new Error(json.retMsg);
      const ticker = json.result.list[0];
      const volume = parseFloat(ticker.volume24h);
      const price = parseFloat(ticker.lastPrice);
      const priceChange = parseFloat(ticker.price24hPcnt);
      const buyRatio = 0.50 + (priceChange * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'bitstamp') {
      const response = await fetch('https://www.bitstamp.net/api/v2/ticker/xrpusd/');
      const json = await response.json();
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.last);
      const open = parseFloat(json.open);
      const priceChange = ((price - open) / open) * 100;
      const buyRatio = 0.50 + (priceChange * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'bitfinex') {
      const response = await fetch('https://api-pub.bitfinex.com/v2/ticker/tXRPUSD');
      const json = await response.json();
      if (!Array.isArray(json)) throw new Error('Invalid response');
      const volume = parseFloat(json[7]);
      const price = parseFloat(json[6]);
      const dailyChange = parseFloat(json[5]);
      const buyRatio = 0.50 + (dailyChange * 0.5);
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'upbit') {
      const response = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-XRP');
      const json = await response.json();
      if (!Array.isArray(json) || json.length === 0) throw new Error('No data');
      const ticker = json[0];
      const volume = parseFloat(ticker.acc_trade_volume_24h);
      const priceKRW = parseFloat(ticker.trade_price);
      const changeRate = parseFloat(ticker.signed_change_rate);
      const krwToUsd = 0.00075;
      const priceUsd = priceKRW * krwToUsd;
      const buyRatio = 0.50 + (changeRate * 0.5);
      data = {
        volume: volume,
        price: priceUsd,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    if (!data || isNaN(data.volume) || isNaN(data.price)) {
      throw new Error('Invalid data');
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
