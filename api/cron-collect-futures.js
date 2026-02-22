// api/cron-collect-futures.js - Collects futures data periodically
import { createClient } from '@supabase/supabase-js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  const exchanges = ['binance', 'bybit', 'okx'];
  const baseUrl = process.env.SITE_URL || 'https://xrp-cvd-tracker.vercel.app';
  const results = [];

  for (const exchangeId of exchanges) {
    try {
      const response = await fetch(`${baseUrl}/api/futures-exchange?exchange=${exchangeId}`);
      if (!response.ok) {
        console.error(`Failed to fetch futures ${exchangeId}: ${response.status}`);
        results.push({ exchange: exchangeId, status: 'error', error: `HTTP ${response.status}` });
        continue;
      }
      const data = await response.json();

      const { data: prevRow } = await supabase
        .from('futures_history')
        .select('long_vol, short_vol')
        .eq('exchange', exchangeId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      const cvdDelta = prevRow
        ? (data.longVol - data.shortVol) - (prevRow.long_vol - prevRow.short_vol)
        : 0;

      const { error: insertError } = await supabase.from('futures_history').insert({
        exchange: exchangeId,
        cvd_delta: cvdDelta,
        open_interest: data.openInterest,
        long_vol: data.longVol,
        short_vol: data.shortVol,
        price: data.price
      });

      if (insertError) throw new Error(`Supabase insert error: ${insertError.message}`);

      results.push({ exchange: exchangeId, cvd_delta: cvdDelta, status: 'success' });
    } catch (error) {
      results.push({ exchange: exchangeId, status: 'error', error: error.message });
    }
  }

  return res.status(200).json({ success: true, timestamp: new Date().toISOString(), results });
}
