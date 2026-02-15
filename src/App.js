import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Activity, AlertCircle } from 'lucide-react';

const XRPCVDTracker = () => {
  const [exchanges, setExchanges] = useState([
    { name: 'Binance', id: 'binance', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#F3BA2F', status: 'loading', baseline: null },
    { name: 'Upbit', id: 'upbit', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#1E40AF', status: 'loading', baseline: null },
    { name: 'KuCoin', id: 'kucoin', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#24AE8F', status: 'loading', baseline: null },
    { name: 'Kraken', id: 'kraken', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#5741D9', status: 'loading', baseline: null },
    { name: 'Coinbase', id: 'coinbase', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#0052FF', status: 'loading', baseline: null },
    { name: 'Bitfinex', id: 'bitfinex', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#16B157', status: 'loading', baseline: null },
    { name: 'Bitstamp', id: 'bitstamp', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#00AB66', status: 'loading', baseline: null },
    { name: 'Gate.io', id: 'gate', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#17E3A5', status: 'loading', baseline: null },
    { name: 'OKX', id: 'okx', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#1A1A1A', status: 'loading', baseline: null },
    { name: 'Bybit', id: 'bybit', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#F7A600', status: 'loading', baseline: null }
  ]);
  
  const [historicalData, setHistoricalData] = useState([]);
  const [xrpPrice, setXrpPrice] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [initialized, setInitialized] = useState(false);

  // Vercel Serverless API'den veri çek
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
      console.error(`Error fetching ${exchangeId}:`, error);
      throw error;
    }
  };

  const updateData = useCallback(async () => {
    setIsLoading(true);
    const newErrors = [];
    
    try {
      // XRP fiyatını Binance'den al
      try {
        const binancePrice = await fetchExchangeData('binance');
        setXrpPrice(binancePrice.price);
      } catch (error) {
        newErrors.push(`Fiyat: ${error.message}`);
      }

      // Her borsa için veri çek
      const updatedExchanges = await Promise.all(
        exchanges.map(async (exchange) => {
          try {
            const data = await fetchExchangeData(exchange.id);

            // İlk çalıştırmada baseline ayarla (sıfır noktası)
            let baseline = exchange.baseline;
            if (baseline === null) {
              // İlk veri - bu noktayı sıfır kabul et
              baseline = data.buyVolume - data.sellVolume;
            }

            // CVD = Mevcut delta - Baseline (böylece 0'dan başlar)
            const currentDelta = data.buyVolume - data.sellVolume;
            const cvdFromBaseline = currentDelta - baseline;

            // Trend = Bir önceki güncellemeye göre değişim
            const trend = cvdFromBaseline - (exchange.cvd || 0);

            return {
              ...exchange,
              cvd: cvdFromBaseline,
              volume24h: data.volume,
              buyVolume: data.buyVolume,
              sellVolume: data.sellVolume,
              trend: trend,
              baseline: baseline,
              buyRatio: data.buyRatio || (data.buyVolume / data.volume),
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
      
      if (!initialized) {
        setInitialized(true);
      }

      // Tarihsel veri kaydet
      const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setHistoricalData(prev => {
        const newData = [...prev, {
          time: timestamp,
          ...updatedExchanges.reduce((acc, ex) => {
            if (ex.status === 'success') {
              acc[ex.name] = ex.cvd / 1000000; // Milyon cinsinden
            }
            return acc;
          }, {})
        }];
        
        // Son 40 veri noktasını tut (daha uzun grafik için)
        return newData.slice(-40);
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Veri güncellenirken hata:', error);
      newErrors.push('Genel güncelleme hatası');
      setErrors(newErrors);
    }
    
    setIsLoading(false);
  }, [exchanges, initialized]);

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 30000); // Her 30 saniyede güncelle
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
                <p className="text-blue-300 text-sm">🔴 CANLI - Gerçek Borsa API Verileri</p>
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
          
          {/* Error Display */}
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
              <div className="text-blue-400 text-sm mb-1">Toplam CVD</div>
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

        {/* CVD Grafik */}
        {historicalData.length > 1 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-blue-500/20">
            <h2 className="text-xl font-bold text-white mb-4">CVD Zaman Serisi (Milyon XRP) - Başlangıç: 0</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#94a3b8" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px' }}
                  labelStyle={{ color: '#cbd5e1' }}
                  formatter={(value) => `${value.toFixed(2)}M XRP`}
                />
                <Legend />
                {successfulExchanges.map(ex => (
                  <Line 
                    key={ex.id}
                    type="monotone" 
                    dataKey={ex.name} 
                    stroke={ex.color}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Borsa Kartları */}
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
                        <div className="text-blue-400 text-xs mb-1">CVD (0'dan itibaren)</div>
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
            <h2 className="text-xl font-bold text-white mb-4">Borsa Bazında CVD (Başlangıç: 0)</h2>
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
                  formatter={(value) => [`${value >= 0 ? '+' : ''}${value.toFixed(2)}M XRP`, 'CVD']}
                />
                <Bar dataKey="CVD" radius={[8, 8, 0, 0]}>
                  {successfulExchanges.map((entry, index) => (
                    <rect key={`cell-${index}`} fill={entry.cvd >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer Bilgi */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
          <div className="text-blue-400 text-sm space-y-2">
            <p>
              <strong>🔴 CANLI VERİ:</strong> Vercel Serverless Functions üzerinden gerçek borsa API'lerinden anlık veri çekilmektedir.
            </p>
            <p>
              <strong>CVD Hesaplama:</strong> Her borsa için alım-satım dengesi gerçek trades verisinden hesaplanır. 
              Uygulama açıldığı an sıfır (0) kabul edilir ve buradan itibaren değişimler takip edilir.
            </p>
            <p className="text-xs text-blue-300">
              • Pozitif CVD (+) = Alım baskısı güçlü (Yükseliş eğilimi)<br/>
              • Negatif CVD (-) = Satım baskısı güçlü (Düşüş eğilimi)<br/>
              • Veriler 30 saniyede bir otomatik güncellenir<br/>
              • Grafik son 40 veri noktasını gösterir (~20 dakika)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XRPCVDTracker;
