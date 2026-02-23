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
      .select('id, timestamp, exchange, cvd, buy_volume, sell_volume, price')
      .order('timestamp', { ascending: false })
      .limit(1000);

    if (period !== 'all' && PERIOD_MS[period]) {
      const startDate = new Date(Date.now() - PERIOD_MS[period]);
      query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Reverse so data is oldest-first for cumulative calculation
    const sorted = (historyData || []).reverse();

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