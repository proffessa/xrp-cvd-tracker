// api/get-history.js - Get CVD history from Supabase
import { createClient } from '@supabase/supabase-js';

const DEFAULT_SPOT_EXCHANGES = ['binance', 'upbit', 'kucoin', 'kraken', 'coinbase', 'bitfinex', 'bitstamp', 'gate', 'okx', 'bybit'];

// Map period strings to milliseconds
const PERIOD_MS = {
  '1h':  1 * 60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '5d':  5 * 24 * 60 * 60 * 1000,
  '1w':  7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '3m': 90 * 24 * 60 * 60 * 1000,
};

const ROW_LIMIT_PER_EXCHANGE = 5000;

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

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase environment variables not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { period = '1d', exchanges } = req.query;
    const exchangeList = String(exchanges || DEFAULT_SPOT_EXCHANGES.join(','))
      .split(',')
      .map(exchange => exchange.trim().toLowerCase())
      .filter(Boolean);

    const startDate = (period !== 'all' && PERIOD_MS[period])
      ? new Date(Date.now() - PERIOD_MS[period]).toISOString()
      : null;

    const queryForExchange = async (exchangeId) => {
      let query = supabase
        .from('cvd_history')
        .select('id, timestamp, exchange, cvd, buy_volume, sell_volume, price')
        .eq('exchange', exchangeId)
        .order('timestamp', { ascending: false })
        .limit(ROW_LIMIT_PER_EXCHANGE);

      if (startDate) {
        query = query.gte('timestamp', startDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    };

    const groupedRows = await Promise.all(exchangeList.map(queryForExchange));
    const sorted = groupedRows
      .flat()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Each saved record contains a net delta (buy_volume - sell_volume)
    // cvd===0 means old seed row — fall back to buy_volume - sell_volume
    const cumulMap = {};

    const enriched = sorted.map(record => {
      const exId = record.exchange;
      const delta = (Number.isFinite(record.cvd) && record.cvd !== 0)
        ? record.cvd
        : (record.buy_volume || 0) - (record.sell_volume || 0);

      if (cumulMap[exId] === undefined) cumulMap[exId] = 0;
      cumulMap[exId] += delta;

      return {
        ...record,
        cumulative_cvd: cumulMap[exId],
      };
    });

    return res.status(200).json({
      history: enriched,
      count: enriched.length,
    });

  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: error.message });
  }
}
