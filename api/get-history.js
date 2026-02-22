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

    if (period !== 'all' && PERIOD_MS[period]) {
      const startDate = new Date(Date.now() - PERIOD_MS[period]);
      query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Each saved record already contains a single-snapshot delta:
    //   buy_volume - sell_volume = net buy pressure for that interval
    // So cumulative CVD = simple running sum of those deltas per exchange.
    const cumulMap = {};

    const enriched = (historyData || []).map(record => {
      const exId = record.exchange;
      const delta = record.buy_volume - record.sell_volume;

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