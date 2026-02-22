-- Run this in Supabase SQL Editor to create the futures_history table
CREATE TABLE IF NOT EXISTS futures_history (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp     timestamptz DEFAULT now(),
  exchange      text NOT NULL,
  cvd_delta     float8 DEFAULT 0,
  open_interest float8 DEFAULT 0,
  long_vol      float8 DEFAULT 0,
  short_vol     float8 DEFAULT 0,
  price         float8 DEFAULT 0
);

CREATE INDEX IF NOT EXISTS futures_history_exchange_timestamp_idx
  ON futures_history (exchange, timestamp DESC);
