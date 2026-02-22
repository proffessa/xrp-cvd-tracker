// api/get-history.js - Get CVD history from Supabase
import { createClient } from '@supabase/supabase-js';

// Map period strings to milliseconds
const PERIOD_MS = {
  '1h':  1 * 60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w':  7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '3m': 90 * 24 * 60 * 60 * 1000,
};

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

    const { period = '1d' } = req.query;

    let query = supabase
      .from('cvd_history')
      .select('id, timestamp, exchange, buy_volume, sell_volume, price')
      .order('timestamp', { ascending: true });

    // Use Date.now() for correct UTC-based time filtering (avoids setHours timezone drift)
    if (period !== 'all' && PERIOD_MS[period]) {
      const startDate = new Date(Date.now() - PERIOD_MS[period]);
      query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Compute per-exchange delta-based cumulative CVD on the server
    // delta[t] = (buy[t] - sell[t]) - (buy[t-1] - sell[t-1])
    // This avoids the "always positive" problem caused by summing raw rolling volumes
    const prevNetMap = {};   // last known (buy - sell) per exchange
    const cumulMap = {};     // running cumulative CVD per exchange

    const enriched = (historyData || []).map(record => {
      const exId = record.exchange;
      const net = record.buy_volume - record.sell_volume;

      if (prevNetMap[exId] === undefined) {
        // First record for this exchange: delta = 0 (no previous reference)
        prevNetMap[exId] = net;
        cumulMap[exId] = 0;
      } else {
        const delta = net - prevNetMap[exId];
        cumulMap[exId] += delta;
        prevNetMap[exId] = net;
      }

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