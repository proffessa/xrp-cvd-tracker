// api/get-history.js - Get CVD history from Supabase
import { createClient } from '@supabase/supabase-js';

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
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_KEY
    );

    const { limit = 100, hours = 2 } = req.query;

    // Get CVD history for last N hours
    const timeAgo = new Date();
    timeAgo.setHours(timeAgo.getHours() - parseInt(hours));

    const { data: historyData, error: historyError } = await supabase
      .from('cvd_history')
      .select('*')
      .gte('timestamp', timeAgo.toISOString())
      .order('timestamp', { ascending: true })
      .limit(parseInt(limit) * 10); // Get more data for all exchanges

    if (historyError) {
      console.error('Error fetching history:', historyError);
      return res.status(500).json({ error: 'Failed to fetch history' });
    }

    // Get latest baseline values for each exchange
    const { data: latestData, error: latestError } = await supabase
      .from('cvd_latest')
      .select('*');

    if (latestError) {
      console.error('Error fetching latest:', latestError);
    }

    // Format data for frontend
    const formattedData = {
      history: historyData || [],
      latest: latestData || [],
      count: historyData?.length || 0
    };

    return res.status(200).json(formattedData);

  } catch (error) {
    console.error('Get history error:', error);
    return res.status(500).json({ error: error.message });
  }
}
