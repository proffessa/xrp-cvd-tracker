import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush, Cell } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Activity, AlertCircle, Database } from 'lucide-react';

const EXCHANGES_CONFIG = [
  { name: 'Binance',  id: 'binance',  color: '#FF0000' },
  { name: 'Upbit',    id: 'upbit',    color: '#0000FF' },
  { name: 'KuCoin',   id: 'kucoin',   color: '#00FF00' },
  { name: 'Kraken',   id: 'kraken',   color: '#FFFF00' },
  { name: 'Coinbase', id: 'coinbase', color: '#8000FF' },
  { name: 'Bitfinex', id: 'bitfinex', color: '#FF8000' },
  { name: 'Bitstamp', id: 'bitstamp', color: '#00FFFF' },
  { name: 'Gate.io',  id: 'gate',     color: '#FF00FF' },
  { name: 'OKX',      id: 'okx',      color: '#654321' },
  { name: 'Bybit',    id: 'bybit',    color: '#888888' },
];

// Period selector options (label shown in UI, value sent to API)
const PERIODS = [
  { label: '1S',   value: '1h' },
  { label: '6S',   value: '6h' },
  { label: '1G',   value: '1d' },
  { label: '1H',   value: '1w' },
  { label: '1A',   value: '1m' },
  { label: '3A',   value: '3m' },
  { label: 'Tümü', value: 'all' },
];

const XRPCVDTracker = () => {
  const [exchanges, setExchanges] = useState(
    EXCHANGES_CONFIG.map(e => ({ ...e, cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, status: 'loading', price: 0 }))
  );

  const [selectedPeriod, setSelectedPeriod] = useState('1d');
  const [historicalData, setHistoricalData] = useState([]);
  const [xrpPrice, setXrpPrice] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [dbConnected, setDbConnected] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [brushIndex, setBrushIndex] = useState({ startIndex: 0, endIndex: 0 });

  const fetchExchangeData = async (exchangeId) => {
    try {
      const response = await fetch(`/api/exchange?exchange=${exchangeId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  };

  const saveCVDData = async (exchangesData, price) => {
    try {
      const response = await fetch('/api/save-cvd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchanges: exchangesData,
          xrpPrice: price
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save data');
      }

      const result = await response.json();
      setDbConnected(true);
      setSavedCount(prev => prev + result.saved);
      return true;
    } catch (error) {
      console.error('Save error:', error);
      setDbConnected(false);
      return false;
    }
  };

  const loadHistoricalData = async (period) => {
    try {
      const response = await fetch(`/api/get-history?period=${period}`);
      if (!response.ok) {
        throw new Error('Failed to load history');
      }

      const { history } = await response.json();

      if (history && history.length > 0) {
        // Determine time-bucket granularity based on period for the X-axis labels
        const getBucketKey = (isoString) => {
          const date = new Date(isoString);
          if (period === '1h' || period === '6h') {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          } else if (period === '1d') {
            return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          } else {
            const dateStr = date.toLocaleDateString('tr-TR', { month: '2-digit', day: '2-digit' });
            const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
            return `${dateStr} ${timeStr}`;
          }
        };

        // Compute cumulative CVD per exchange (records already sorted ascending by timestamp)
        // CVD = Σ (buy_volume - sell_volume) from start of period to each point
        const cumulativeCVD = {};
        const bucketMap = {};

        history.forEach(record => {
          const exId = record.exchange;
          if (cumulativeCVD[exId] === undefined) cumulativeCVD[exId] = 0;
          cumulativeCVD[exId] += (record.buy_volume - record.sell_volume);

          const timeKey = getBucketKey(record.timestamp);
          const ts = new Date(record.timestamp).getTime();

          if (!bucketMap[timeKey]) {
            bucketMap[timeKey] = { time: timeKey, _ts: ts, _priceSum: 0, _priceCount: 0, xrpPrice: 0 };
          }

          const exConfig = EXCHANGES_CONFIG.find(ex => ex.id === exId);
          if (exConfig) {
            // Keep the latest cumulative value for this exchange within the bucket
            bucketMap[timeKey][exConfig.name] = cumulativeCVD[exId] / 1000000;
            // Records are sorted ascending; last record in bucket always has the largest ts
            bucketMap[timeKey]._ts = ts;
            if (record.price && record.price > 0) {
              bucketMap[timeKey]._priceSum += record.price;
              bucketMap[timeKey]._priceCount += 1;
            }
          }
        });

        // Sort by timestamp and clean up internal fields
        const formattedHistory = Object.values(bucketMap)
          .sort((a, b) => a._ts - b._ts)
          .map(({ _ts, _priceSum, _priceCount, ...rest }) => {
            if (_priceCount > 0) {
              rest.xrpPrice = _priceSum / _priceCount;
            }
            return rest;
          });

        setHistoricalData(formattedHistory);
        setDbConnected(true);

        // Update exchange cards with cumulative CVD for the selected period
        setExchanges(prev => prev.map(ex => {
          const newCVD = cumulativeCVD[ex.id];
          if (newCVD !== undefined) {
            return {
              ...ex,
              cvd: newCVD,
              trend: newCVD - (ex.cvd || 0),
              status: ex.status === 'loading' ? 'success' : ex.status
            };
          }
          return ex;
        }));
      } else {
        setHistoricalData([]);
      }
    } catch (error) {
      console.error('Load history error:', error);
      setDbConnected(false);
    }
  };

  const updateData = async () => {
    setIsLoading(true);
    const newErrors = [];
    
    try {
      // Get XRP price
      let currentPrice = xrpPrice;
      try {
        const binancePrice = await fetchExchangeData('binance');
        currentPrice = binancePrice.price;
        setXrpPrice(currentPrice);
      } catch (error) {
        newErrors.push(`Fiyat: ${error.message}`);
      }

      // Fetch raw buy/sell volume data from all exchanges
      const updatedExchanges = await Promise.all(
        exchanges.map(async (exchange) => {
          try {
            const data = await fetchExchangeData(exchange.id);
            return {
              ...exchange,
              volume24h: data.volume,
              buyVolume: data.buyVolume,
              sellVolume: data.sellVolume,
              price: data.price,
              buyRatio: data.buyVolume / data.volume,
              status: 'success'
            };
          } catch (error) {
            newErrors.push(`${exchange.name}: ${error.message}`);
            return {
              ...exchange,
              status: 'error'
            };
          }
        })
      );

      setExchanges(updatedExchanges);
      setErrors(newErrors);

      // Save raw buy/sell volumes to database
      await saveCVDData(updatedExchanges, currentPrice);

      // Reload cumulative CVD from database for the selected period
      await loadHistoricalData(selectedPeriod);

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Update error:', error);
      newErrors.push('Genel güncelleme hatası');
      setErrors(newErrors);
    }
    
    setIsLoading(false);
  };

  const updateDataRef = useRef(null);
  updateDataRef.current = updateData;

  const loadHistoricalDataRef = useRef(null);
  loadHistoricalDataRef.current = loadHistoricalData;

  // Initial load: fetch historical data immediately, then start 30s polling
  useEffect(() => {
    updateDataRef.current();
    const interval = setInterval(() => updateDataRef.current(), 30000);
    return () => clearInterval(interval);
  }, []);

  // Reload cumulative CVD whenever the selected period changes
  useEffect(() => {
    loadHistoricalDataRef.current(selectedPeriod);
  }, [selectedPeriod]);

  // Update brush when data changes
  useEffect(() => {
    // Keep brush showing all data
    setBrushIndex({ startIndex: 0, endIndex: Math.max(0, historicalData.length - 1) });
  }, [lastUpdate, historicalData.length]);

  const formatNumber = (num) => {
    if (Math.abs(num) >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (Math.abs(num) >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(num);
  };

  const totalCVD = exchanges.reduce((sum, ex) => sum + (ex.status === 'success' ? ex.cvd : 0), 0);
  const successfulExchanges = exchanges.filter(ex => ex.status === 'success');
  const positiveCVD = exchanges.filter(ex => ex.status === 'success' && ex.cvd > 0).length;
  const negativeCVD = exchanges.filter(ex => ex.status === 'success' && ex.cvd < 0).length;
  const selectedPeriodLabel = PERIODS.find(p => p.value === selectedPeriod)?.label || '';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Activity className="w-10 h-10 text-blue-400 animate-pulse" />
              <div>
                <h1 className="text-3xl font-bold text-white">XRP CVD Takipçisi</h1>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-blue-300 text-sm">🔴 CANLI - Gerçek Borsa Verileri</p>
                  {dbConnected && (
                    <div className="flex items-center gap-1 text-green-400 text-xs">
                      <Database className="w-4 h-4" />
                      <span>Veritabanı Bağlı ({savedCount} kayıt)</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={updateData}
              disabled={isLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              Yenile
            </button>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2 mb-4">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setSelectedPeriod(p.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  selectedPeriod === p.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          
          {errors.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-300">
                  <div className="font-semibold mb-1">Bağlantı Hataları:</div>
                  {errors.map((error, idx) => (
                    <div key={idx}>• {error}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">XRP Fiyatı</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(xrpPrice)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Toplam CVD ({selectedPeriodLabel})</div>
              <div className={`text-2xl font-bold ${totalCVD >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {totalCVD >= 0 ? '+' : ''}{formatNumber(totalCVD)}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Piyasa Duygusu</div>
              <div className="flex gap-2 items-center">
                <span className="text-green-400 text-sm">↑{positiveCVD}</span>
                <span className="text-gray-400">/</span>
                <span className="text-red-400 text-sm">↓{negativeCVD}</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">Alım vs Satım</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Durum</div>
              <div className="text-lg font-semibold text-white">
                {lastUpdate.toLocaleTimeString('tr-TR')}
              </div>
              <div className="text-xs text-blue-300 mt-1">
                {successfulExchanges.length}/{exchanges.length} borsa aktif
              </div>
            </div>
          </div>
        </div>

        {/* CVD Chart with XRP Price */}
        {historicalData.length > 1 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-blue-500/20">
            <h2 className="text-xl font-bold text-white mb-4">
              Kümülatif CVD ({selectedPeriodLabel}) - {historicalData.length} veri noktası
            </h2>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                {/* Left Y-axis for CVD - Auto scale */}
                <YAxis 
                  yAxisId="left"
                  stroke="#94a3b8" 
                  label={{ value: 'Kümülatif CVD (Milyon XRP)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                  domain={['auto', 'auto']}
                />
                {/* Right Y-axis for XRP Price - Auto scale from min to max */}
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke="#FFD700"
                  label={{ value: 'XRP Fiyatı ($)', angle: 90, position: 'insideRight', fill: '#FFD700' }}
                  domain={[
                    (dataMin) => parseFloat((dataMin * 0.999).toFixed(3)),
                    (dataMax) => parseFloat((dataMax * 1.001).toFixed(3))
                  ]}
                  tickFormatter={(value) => `$${value.toFixed(3)}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value, name) => {
                    if (name === 'XRP Fiyatı') {
                      return [`$${value.toFixed(3)}`, name];
                    }
                    return [`${value.toFixed(2)}M XRP`, name];
                  }}
                />
                <Legend />
                {/* Interactive Brush for Zoom/Pan */}
                <Brush 
                  dataKey="time" 
                  height={30} 
                  stroke="#3b82f6"
                  fill="#1e293b"
                  startIndex={brushIndex.startIndex}
                  endIndex={brushIndex.endIndex}
                  onChange={(range) => {
                    if (range?.startIndex !== undefined && range?.endIndex !== undefined) {
                      setBrushIndex({ startIndex: range.startIndex, endIndex: range.endIndex });
                    }
                  }}
                />
                {/* CVD Lines - Left Axis */}
                {successfulExchanges.map(ex => (
                  <Line 
                    key={ex.id}
                    yAxisId="left"
                    type="monotone" 
                    dataKey={ex.name} 
                    stroke={ex.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
                {/* XRP Price Line - Right Axis */}
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="xrpPrice" 
                  name="XRP Fiyatı"
                  stroke="#FFD700"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-blue-300 space-y-1">
              <p>• Sol eksen: Kümülatif CVD (Milyon XRP) | Sağ eksen: XRP Fiyatı ($) - Kesikli altın çizgi</p>
              <p>• Alt kısımdaki kaydırıcı ile zaman aralığını seçebilirsiniz (zoom/pan)</p>
              <p>• Her iki eksen de otomatik min-max değerlere göre ölçeklenir</p>
            </div>
          </div>
        )}

        {/* Exchange Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {exchanges.map((exchange) => {
            const cvdValue = exchange.cvd;
            const isPositive = cvdValue >= 0;
            const buyPercentage = exchange.volume24h > 0 ? (exchange.buyVolume / exchange.volume24h) * 100 : 50;
            
            return (
              <div 
                key={exchange.id}
                className={`bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border transition-all ${
                  exchange.status === 'error' 
                    ? 'border-red-500/30 opacity-60' 
                    : 'border-blue-500/20 hover:border-blue-500/40'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: exchange.color }}
                    />
                    <h3 className="text-lg font-bold text-white">{exchange.name}</h3>
                    {exchange.status === 'loading' && (
                      <span className="text-xs text-blue-400 animate-pulse">Yükleniyor...</span>
                    )}
                    {exchange.status === 'error' && (
                      <span className="text-xs text-red-400">❌ Hata</span>
                    )}
                    {exchange.status === 'success' && (
                      <span className="text-xs text-green-400">✓</span>
                    )}
                  </div>
                  {exchange.status === 'success' && (
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      <span className="text-sm font-semibold">
                        {isPositive ? '+' : ''}{formatNumber(exchange.trend)}
                      </span>
                    </div>
                  )}
                </div>
                
                {exchange.status === 'success' && (
                  <>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <div className="text-blue-400 text-xs mb-1">CVD ({selectedPeriodLabel})</div>
                        <div className={`text-xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                          {isPositive ? '+' : ''}{formatNumber(cvdValue)}
                        </div>
                      </div>
                      <div>
                        <div className="text-blue-400 text-xs mb-1">24s Hacim</div>
                        <div className="text-xl font-bold text-white">{formatNumber(exchange.volume24h)}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-green-400">Alım: {formatNumber(exchange.buyVolume)}</span>
                        <span className="text-green-400">{buyPercentage.toFixed(2)}%</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-green-500 to-green-400 h-full transition-all duration-500"
                          style={{ width: `${buyPercentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-red-400">Satım: {formatNumber(exchange.sellVolume)}</span>
                        <span className="text-red-400">{(100 - buyPercentage).toFixed(2)}%</span>
                      </div>
                    </div>
                  </>
                )}
                
                {exchange.status === 'error' && (
                  <div className="text-center text-gray-400 py-4">
                    Bağlantı kurulamadı
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CVD Bar Chart */}
        {successfulExchanges.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20">
            <h2 className="text-xl font-bold text-white mb-4">Borsa Bazında Kümülatif CVD ({selectedPeriodLabel})</h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={successfulExchanges.map(ex => ({ 
                name: ex.name, 
                CVD: ex.cvd / 1000000,
                fill: ex.cvd >= 0 ? '#10b981' : '#ef4444'
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#94a3b8" label={{ value: 'Milyon XRP', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}M XRP`, 'Kümülatif CVD']}
                />
                <Bar dataKey="CVD" radius={[8, 8, 0, 0]}>
                  {successfulExchanges.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cvd >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
          <div className="text-blue-400 text-sm space-y-2">
            <p>
              <strong>🗄️ KALICI VERİ SAKLAMA:</strong> CVD verileri Supabase PostgreSQL veritabanında saklanıyor. 
              {dbConnected ? ' ✅ Bağlı' : ' ❌ Bağlantı yok'}
            </p>
            <p>
              <strong>🔴 CANLI VERİ:</strong> Her borsa kendi API'sinden gerçek veri çekiyor.
              CVD her 30 saniyede güncellenir ve veritabanına kaydedilir.
            </p>
            <p className="text-xs text-blue-300">
              • Kümülatif CVD = seçilen başlangıç tarihinden itibaren Σ(alım - satım) delta'larının toplamı<br/>
              • Yükselen = net alım baskısı, düşen = net satım baskısı<br/>
              • Tarayıcı kapansa bile veri Supabase'den yüklenir, sıfırlanmaz
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XRPCVDTracker;
