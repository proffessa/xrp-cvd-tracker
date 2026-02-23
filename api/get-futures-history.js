// api/get-futures-history.js - Get futures CVD history from Supabase
import { createClient } from '@supabase/supabase-js';

const PERIOD_MS = {
  '1h':  1 * 60 * 60 * 1000,
  '6h':  6 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w':  7 * 24 * 60 * 60 * 1000,
  '1m': 30 * 24 * 60 * 60 * 1000,
  '3m': 90 * 24 * 60 * 60 * 1000,
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
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
      .from('futures_history')
      .select('exchange, cvd_delta, open_interest, long_vol, short_vol, price, timestamp')
      .order('timestamp', { ascending: true })
      .limit(10000);

    if (period !== 'all' && PERIOD_MS[period]) {
      const startDate = new Date(Date.now() - PERIOD_MS[period]);
      query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching futures history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch futures history' });
    }

    const cumulMap = {};

    const enriched = (historyData || []).map(record => {
      const exId = record.exchange;
      const delta = Number.isFinite(record.cvd_delta) ? record.cvd_delta : 0;

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
    console.error('Get futures history error:', error);
    return res.status(500).json({ error: error.message });
  }
}
