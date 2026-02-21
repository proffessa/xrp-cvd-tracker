// api/cron-collect-cvd.js - Collects data every 30 seconds
import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60, // Max 60 seconds
};

export default async function handler(req, res) {
  // Verify this is a cron job (security)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase environment variables not configured' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const exchanges = [
      'binance', 'upbit', 'kucoin', 'kraken', 'coinbase',
      'bitfinex', 'bitstamp', 'gate', 'okx', 'bybit'
    ];

    let xrpPrice = 0;
    const results = [];

    // Fetch data from all exchanges
    for (const exchangeId of exchanges) {
      try {
        const baseUrl = process.env.VERCEL_URL 
          ? `https://${process.env.VERCEL_URL}` 
          : 'https://xrp-cvd-tracker.vercel.app';
        
        const response = await fetch(`${baseUrl}/api/exchange?exchange=${exchangeId}`);
        
        if (!response.ok) {
          console.error(`Failed to fetch ${exchangeId}: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Get baseline from database
        const { data: latestData } = await supabase
          .from('cvd_latest')
          .select('baseline, cvd')
          .eq('exchange', exchangeId)
          .single();

        let baseline = latestData?.baseline;

        // If no baseline, set it now
        if (!baseline) {
          baseline = data.buyVolume - data.sellVolume;
        }

        // Calculate CVD
        const currentDelta = data.buyVolume - data.sellVolume;
        const cvd = currentDelta - baseline;

        // Save to history
        await supabase.from('cvd_history').insert({
          exchange: exchangeId,
          cvd: cvd,
          volume: data.volume,
          buy_volume: data.buyVolume,
          sell_volume: data.sellVolume,
          price: data.price
        });

        // Update latest
        await supabase.from('cvd_latest').upsert({
          exchange: exchangeId,
          cvd: cvd,
          volume: data.volume,
          buy_volume: data.buyVolume,
          sell_volume: data.sellVolume,
          price: data.price,
          baseline: baseline,
          updated_at: new Date().toISOString()
        });

        if (data.price > 0) {
          xrpPrice = data.price;
        }

        results.push({
          exchange: exchangeId,
          cvd: cvd,
          status: 'success'
        });

      } catch (error) {
        console.error(`Error processing ${exchangeId}:`, error.message);
        results.push({
          exchange: exchangeId,
          status: 'error',
          error: error.message
        });
      }
    }

    // Save XRP price
    if (xrpPrice > 0) {
      await supabase.from('xrp_price_history').insert({
        price: xrpPrice
      });
    }

    console.log(`✅ Cron completed: ${results.filter(r => r.status === 'success').length}/${exchanges.length} exchanges`);

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results: results,
      xrpPrice: xrpPrice
    });

  } catch (error) {
    console.error('Cron error:', error);
    return res.status(500).json({ error: error.message });
  }
}
