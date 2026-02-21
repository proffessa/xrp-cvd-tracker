// api/exchange.js - Working version without CoinGecko
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

  try {
    let data = null;

    if (exchange === 'binance') {
      const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=XRPUSDT');
      const json = await response.json();
      if (json.code) throw new Error(json.msg || 'Binance API error');
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.lastPrice);
      const open = parseFloat(json.openPrice);
      const priceChange = (price - open) / open;
      const buyRatio = 0.50 + (priceChange * 0.3);

      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'kraken') {
      const response = await fetch('https://api.kraken.com/0/public/Ticker?pair=XRPUSD');
      const json = await response.json();
      if (json.error?.length > 0) throw new Error(json.error[0]);
      const ticker = json.result.XXRPZUSD || json.result.XRPUSD;
      const volume = parseFloat(ticker.v[1]);
      const price = parseFloat(ticker.c[0]);
      const open = parseFloat(ticker.o);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'coinbase') {
      const response = await fetch('https://api.exchange.coinbase.com/products/XRP-USD/stats');
      const json = await response.json();
      const volume = parseFloat(json.volume);
      const price = parseFloat(json.last);
      const open = parseFloat(json.open);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      
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
      const buyRatio = 0.50 + (changeRate * 0.3);
      
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
      const buyRatio = 0.50 + (changePercent / 100 * 0.3);
      
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
      const open = parseFloat(ticker.open24h);
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      
      data = {
        volume: volume,
        price: price,
        buyVolume: volume * Math.max(0.45, Math.min(0.55, buyRatio)),
        sellVolume: volume * Math.max(0.45, Math.min(0.55, 1 - buyRatio))
      };
    }
    else if (exchange === 'bybit') {
      const response = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=XRPUSDT');
      const json = await response.json();
      if (json.retCode !== 0) throw new Error(json.retMsg || 'Bybit API error');
      const ticker = json.result.list[0];
      const volume = parseFloat(ticker.volume24h);
      const price = parseFloat(ticker.lastPrice);
      const open = parseFloat(ticker.prevPrice24h);
      const priceChange = (price - open) / open;
      const buyRatio = 0.50 + (priceChange * 0.3);

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
      const priceChange = ((price - open) / open);
      const buyRatio = 0.50 + (priceChange * 0.3);
      
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
      const dailyChangePercent = parseFloat(json[4]);
      const buyRatio = 0.50 + (dailyChangePercent * 0.3);
      
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
      const krwToUsd = 1 / 1400; // ~1400 KRW = 1 USD
      const priceUsd = priceKRW * krwToUsd;
      const buyRatio = 0.50 + (changeRate * 0.3);
      
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
