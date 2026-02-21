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

    // Save CVD history for each exchange
    const cvdRecords = exchanges
      .filter(ex => ex.status === 'success')
      .map(ex => ({
        exchange: ex.id,
        cvd: ex.cvd,
        volume: ex.volume24h,
        buy_volume: ex.buyVolume,
        sell_volume: ex.sellVolume,
        price: ex.price || xrpPrice,
        baseline: ex.baseline
      }));

    if (cvdRecords.length > 0) {
      const { error: historyError } = await supabase
        .from('cvd_history')
        .insert(cvdRecords);

      if (historyError) {
        console.error('Error saving CVD history:', historyError);
        return res.status(500).json({ error: 'Failed to save CVD history' });
      }

      // Update latest CVD for each exchange
      for (const ex of exchanges.filter(e => e.status === 'success')) {
        const { error: latestError } = await supabase
          .from('cvd_latest')
          .upsert({
            exchange: ex.id,
            cvd: ex.cvd,
            volume: ex.volume24h,
            buy_volume: ex.buyVolume,
            sell_volume: ex.sellVolume,
            price: ex.price || xrpPrice,
            baseline: ex.baseline,
            updated_at: new Date().toISOString()
          });

        if (latestError) {
          console.error(`Error updating latest for ${ex.id}:`, latestError);
        }
      }
    }

    // Save XRP price history
    if (xrpPrice && xrpPrice > 0) {
      const { error: priceError } = await supabase
        .from('xrp_price_history')
        .insert({
          price: xrpPrice
        });

      if (priceError) {
        console.error('Error saving price history:', priceError);
      }
    }

    return res.status(200).json({ success: true, saved: cvdRecords.length });

  } catch (error) {
    console.error('Save CVD error:', error);
    return res.status(500).json({ error: error.message });
  }
}
