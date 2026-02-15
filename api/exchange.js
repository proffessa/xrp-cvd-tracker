// Vercel Serverless Function - Using CoinGecko API (NO REGIONAL BLOCKS)
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
    // CoinGecko exchange IDs mapping
    const exchangeMap = {
      'binance': 'binance',
      'upbit': 'upbit',
      'kucoin': 'kucoin',
      'kraken': 'kraken',
      'coinbase': 'gdax', // Coinbase Pro
      'bitfinex': 'bitfinex',
      'bitstamp': 'bitstamp',
      'gate': 'gate',
      'okx': 'okex',
      'bybit': 'bybit_spot'
    };

    const geckoExchangeId = exchangeMap[exchange];
    
    if (!geckoExchangeId) {
      return res.status(400).json({ error: `Unknown exchange: ${exchange}` });
    }

    // CoinGecko API - Get XRP tickers from specific exchange
    const response = await fetch(
      `https://api.coingecko.com/api/v3/exchanges/${geckoExchangeId}/tickers?coin_ids=ripple&include_exchange_logo=false`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const json = await response.json();

    if (!json.tickers || json.tickers.length === 0) {
      throw new Error('No XRP tickers found for this exchange');
    }

    // Find XRP/USDT or XRP/USD ticker
    let ticker = json.tickers.find(t => 
      (t.target === 'USDT' || t.target === 'USD') && 
      (t.base === 'XRP' || t.coin_id === 'ripple')
    );

    // Fallback to any XRP ticker
    if (!ticker) {
      ticker = json.tickers.find(t => t.base === 'XRP' || t.coin_id === 'ripple');
    }

    if (!ticker) {
      throw new Error('No suitable XRP ticker found');
    }

    // Extract data
    const volume = parseFloat(ticker.volume);
    const price = parseFloat(ticker.last);
    
    // CoinGecko provides converted USD volume
    const volumeUSD = parseFloat(ticker.converted_volume?.usd || ticker.volume);

    // Validate
    if (isNaN(volume) || isNaN(price) || volume <= 0 || price <= 0) {
      throw new Error('Invalid data from CoinGecko');
    }

    // Calculate buy/sell volumes based on bid/ask spread
    // Narrower spread = more balanced, wider spread = more volatility
    const bidAskSpread = ticker.bid_ask_spread_percentage || 0.1;
    
    // Use spread to estimate buy/sell pressure
    // Smaller spread = more buying pressure (more competitive)
    const buyRatio = 0.5 + (0.5 - Math.min(bidAskSpread, 1) / 2) * 0.02;
    
    const data = {
      volume: volume,
      price: price,
      volumeUSD: volumeUSD,
      buyVolume: volume * buyRatio,
      sellVolume: volume * (1 - buyRatio),
      buyRatio: buyRatio,
      spread: bidAskSpread,
      trust_score: ticker.trust_score
    };

    return res.status(200).json(data);

  } catch (error) {
    console.error(`Error fetching ${exchange}:`, error.message);
    return res.status(500).json({ 
      error: error.message,
      exchange: exchange
    });
  }
}
