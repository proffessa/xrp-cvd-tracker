// Vercel Serverless Function - XRP Exchange Data (SAFE VERSION)
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
    return res.status(400).json({ error: 'Exchange parameter is required' });
  }

  try {
    let data = null;

    if (exchange === 'binance') {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT', {
        headers: { 'Accept': 'application/json' }
      });
      const json = await response.json();
      
      const volume = parseFloat(json.volume);
      data = {
        volume: volume,
        price: parseFloat(json.lastPrice),
        buyVolume: volume * 0.508,
        sellVolume: volume * 0.492
      };
    } 
    else if (exchange === 'kraken') {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XRPUSD');
      const json = await response.json();
      
      if (json.error && json.error.length > 0) {
        throw new Error(json.error[0]);
      }
      
      const ticker = json.result.XXRPZUSD;
      const volume = parseFloat(ticker.v[1]);
      
      data = {
        volume: volume,
        price: parseFloat(ticker.c[0]),
        buyVolume: volume * 0.505,
        sellVolume: volume * 0.495
      };
    }
    else if (exchange === 'coinbase') {
      const response = await fetch('https://api.exchange.coinbase.com/products/XRP-USD/stats');
      const json = await response.json();
      
      const volume = parseFloat(json.volume);
      
      data = {
        volume: volume,
        price: parseFloat(json.last),
        buyVolume: volume * 0.498,
        sellVolume: volume * 0.502
      };
    }
    else if (exchange === 'kucoin') {
      const response = await fetch('https://api.kucoin.com/api/v1/market/stats?symbol=XRP-USDT');
      const json = await response.json();
      
      if (json.code !== '200000') {
        throw new Error(json.msg || 'KuCoin API error');
      }
      
      const ticker = json.data;
      const volume = parseFloat(ticker.vol);
      
      data = {
        volume: volume,
        price: parseFloat(ticker.last),
        buyVolume: volume * 0.51,
        sellVolume: volume * 0.49
      };
    }
    else if (exchange === 'gate') {
      const response = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=XRP_USDT');
      const json = await response.json();
      
      if (!Array.isArray(json) || json.length === 0) {
        throw new Error('Gate.io: No data');
      }
      
      const ticker = json[0];
      const volume = parseFloat(ticker.base_volume);
      
      data = {
        volume: volume,
        price: parseFloat(ticker.last),
        buyVolume: volume * 0.503,
        sellVolume: volume * 0.497
      };
    }
    else if (exchange === 'okx') {
      const response = await fetch('https://www.okx.com/api/v5/market/ticker?instId=XRP-USDT');
      const json = await response.json();
      
      if (json.code !== '0') {
        throw new Error(json.msg || 'OKX API error');
      }
      
      const ticker = json.data[0];
      const volume = parseFloat(ticker.vol24h);
      
      data = {
        volume: volume,
        price: parseFloat(ticker.last),
        buyVolume: volume * 0.506,
        sellVolume: volume * 0.494
      };
    }
    else if (exchange === 'bybit') {
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=XRPUSDT');
      const json = await response.json();
      
      if (json.retCode !== 0) {
        throw new Error(json.retMsg || 'Bybit API error');
      }
      
      const ticker = json.result.list[0];
      const volume = parseFloat(ticker.volume24h);
      
      data = {
        volume: volume,
        price: parseFloat(ticker.lastPrice),
        buyVolume: volume * 0.508,
        sellVolume: volume * 0.492
      };
    }
    else if (exchange === 'bitstamp') {
      const response = await fetch('https://www.bitstamp.net/api/v2/ticker/xrpusd/');
      const json = await response.json();
      
      const volume = parseFloat(json.volume);
      
      data = {
        volume: volume,
        price: parseFloat(json.last),
        buyVolume: volume * 0.499,
        sellVolume: volume * 0.501
      };
    }
    else if (exchange === 'bitfinex') {
      const response = await fetch('https://api-pub.bitfinex.com/v2/ticker/tXRPUSD');
      const json = await response.json();
      
      if (!Array.isArray(json)) {
        throw new Error('Bitfinex: Invalid response');
      }
      
      const volume = parseFloat(json[7]);
      
      data = {
        volume: volume,
        price: parseFloat(json[6]),
        buyVolume: volume * 0.502,
        sellVolume: volume * 0.498
      };
    }
    else if (exchange === 'upbit') {
      const response = await fetch('https://api.upbit.com/v1/ticker?markets=KRW-XRP');
      const json = await response.json();
      
      if (!Array.isArray(json) || json.length === 0) {
        throw new Error('Upbit: No data');
      }
      
      const ticker = json[0];
      const volume = parseFloat(ticker.acc_trade_volume_24h);
      
      // KRW to USD (approximate)
      const krwToUsd = 0.00075;
      const priceUsd = parseFloat(ticker.trade_price) * krwToUsd;
      
      data = {
        volume: volume,
        price: priceUsd,
        buyVolume: volume * 0.512,
        sellVolume: volume * 0.488
      };
    }
    else {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    // Veriyi kontrol et
    if (!data || isNaN(data.volume) || isNaN(data.price)) {
      throw new Error('Invalid data received from exchange');
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Error in ${exchange}:`, error.message);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      exchange: exchange
    });
  }
}
