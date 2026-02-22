// api/get-history.js - Get CVD history from Supabase
import { createClient } from '@supabase/supabase-js';

// Map period strings to hours
const PERIOD_HOURS = {
  '1h': 1,
  '6h': 6,
  '1d': 24,
  '1w': 24 * 7,
  '1m': 24 * 30,
  '3m': 24 * 90,
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

    // Apply time filter unless 'all' is selected
    if (period !== 'all' && PERIOD_HOURS[period]) {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - PERIOD_HOURS[period]);
      query = query.gte('timestamp', startDate.toISOString());
    }

    const { data: historyData, error: historyError } = await query;

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    return res.status(200).json({
      history: historyData || [],
      count: historyData?.length || 0
    });

  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: error.message });
  }
}
