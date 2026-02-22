// api/save-cvd.js - Save CVD data to Supabase
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase environment variables not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { exchanges, xrpPrice } = req.body;

    if (!exchanges || !Array.isArray(exchanges)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    const now = new Date().toISOString();
    const successfulExchanges = exchanges.filter(ex => ex.status === 'success');

    const previousDeltaByExchange = {};
    await Promise.all(
      successfulExchanges.map(async (ex) => {
        const { data: prevRow } = await supabase
          .from('cvd_history')
          .select('buy_volume, sell_volume')
          .eq('exchange', ex.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (prevRow) {
          previousDeltaByExchange[ex.id] = (prevRow.buy_volume || 0) - (prevRow.sell_volume || 0);
        }
      })
    );

    // Save CVD history for each exchange
    // cvd column: interval delta between the latest and previous snapshot
    const cvdRecords = successfulExchanges.map(ex => {
      const snapshotDelta = (ex.buyVolume || 0) - (ex.sellVolume || 0);
      const previousSnapshotDelta = previousDeltaByExchange[ex.id];
      return {
        timestamp: now,
        exchange: ex.id,
        cvd: previousSnapshotDelta === undefined ? 0 : snapshotDelta - previousSnapshotDelta,
        volume: ex.volume24h || 0,
        buy_volume: ex.buyVolume || 0,
        sell_volume: ex.sellVolume || 0,
        price: ex.price || xrpPrice || 0,
      };
    });

    if (cvdRecords.length > 0) {
      const { error: historyError } = await supabase
        .from('cvd_history')
        .insert(cvdRecords);

      if (historyError) {
        console.error('Error saving CVD history:', historyError);
        return res.status(500).json({ error: 'Failed to save CVD history', details: historyError.message });
      }
    }

    return res.status(200).json({ success: true, saved: cvdRecords.length });

  } catch (error) {
    console.error('Save CVD error:', error);
    return res.status(500).json({ error: error.message });
  }
}
