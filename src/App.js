import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';

const XRPCVDTracker = () => {
  const [exchanges, setExchanges] = useState([
    { name: 'Binance', id: 'binance', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#F3BA2F' },
    { name: 'Upbit', id: 'upbit', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#1E40AF' },
    { name: 'KuCoin', id: 'kucoin', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#24AE8F' },
    { name: 'WhiteBit', id: 'whitebit', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#00C896' },
    { name: 'Huobi', id: 'huobi', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#2EADF0' },
    { name: 'Gate.io', id: 'gate', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#17E3A5' },
    { name: 'Bithumb', id: 'bithumb', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#0055FF' },
    { name: 'Coinbase', id: 'coinbase', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#0052FF' },
    { name: 'Kraken', id: 'kraken', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#5741D9' },
    { name: 'Bitget', id: 'bitget', cvd: 0, volume24h: 0, buyVolume: 0, sellVolume: 0, trend: 0, color: '#00F0FF' }
  ]);
  
  const [historicalData, setHistoricalData] = useState([]);
  const [xrpPrice, setXrpPrice] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);

  // Simüle edilmiş CVD verileri - Gerçek API entegrasyonu için bu fonksiyon değiştirilmelidir
  const generateRealisticCVD = (exchange) => {
    // Her borsa için farklı karakteristikler
    const baseVolumes = {
      'binance': 150000000,
      'upbit': 50000000,
      'kucoin': 38000000,
      'whitebit': 35000000,
      'huobi': 29000000,
      'gate': 28000000,
      'bithumb': 22000000,
      'coinbase': 20000000,
      'kraken': 15000000,
      'bitget': 12000000
    };

    const baseVolume = baseVolumes[exchange.id] || 10000000;
    const volumeVariation = (Math.random() - 0.5) * baseVolume * 0.15;
    const totalVolume = baseVolume + volumeVariation;
    
    // Alım/satım dengesini simüle et (gerçek piyasa koşullarına göre)
    const buyPressure = 0.45 + (Math.random() * 0.1); // %45-55 arası
    const buyVolume = totalVolume * buyPressure;
    const sellVolume = totalVolume - buyVolume;
    
    // CVD = Kümülatif (Alım Hacmi - Satım Hacmi)
    const delta = buyVolume - sellVolume;
    const previousCVD = exchange.cvd || 0;
    const newCVD = previousCVD + delta;
    
    return {
      cvd: newCVD,
      volume24h: totalVolume,
      buyVolume: buyVolume,
      sellVolume: sellVolume,
      trend: delta
    };
  };

  const updateData = async () => {
    setIsLoading(true);
    
    try {
      // Gerçek API çağrısı burada yapılabilir
      // Örnek: const response = await fetch('API_URL');
      
      // XRP fiyatını simüle et
      const mockPrice = 1.62 + (Math.random() - 0.5) * 0.2;
      setXrpPrice(mockPrice);
      
      // Her borsa için CVD güncelle
      const updatedExchanges = exchanges.map(exchange => {
        const newData = generateRealisticCVD(exchange);
        return {
          ...exchange,
          ...newData
        };
      });
      
      setExchanges(updatedExchanges);
      
      // Tarihsel veri kaydet
      const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      setHistoricalData(prev => {
        const newData = [...prev, {
          time: timestamp,
          ...updatedExchanges.reduce((acc, ex) => {
            acc[ex.name] = ex.cvd / 1000000; // Milyon cinsinden
            return acc;
          }, {})
        }];
        
        // Son 20 veri noktasını tut
        return newData.slice(-20);
      });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Veri güncellenirken hata:', error);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    updateData();
    const interval = setInterval(updateData, 10000); // Her 10 saniyede güncelle
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const totalCVD = exchanges.reduce((sum, ex) => sum + ex.cvd, 0);
  const avgCVD = totalCVD / exchanges.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-blue-500/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Activity className="w-10 h-10 text-blue-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">XRP CVD Takipçisi</h1>
                <p className="text-blue-300 text-sm">Top 10 Borsa - Anlık Kumülatif Hacim Delta</p>
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
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">XRP Fiyatı</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(xrpPrice)}</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Toplam CVD</div>
              <div className="text-2xl font-bold text-white">{formatNumber(totalCVD)} XRP</div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-1">Son Güncelleme</div>
              <div className="text-lg font-semibold text-white">
                {lastUpdate.toLocaleTimeString('tr-TR')}
              </div>
            </div>
          </div>
        </div>

        {/* CVD Grafik */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-blue-500/20">
          <h2 className="text-xl font-bold text-white mb-4">CVD Zaman Serisi (Milyon XRP)</h2>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px' }}
                labelStyle={{ color: '#cbd5e1' }}
              />
              <Legend />
              {exchanges.slice(0, 5).map(ex => (
                <Line 
                  key={ex.id}
                  type="monotone" 
                  dataKey={ex.name} 
                  stroke={ex.color}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Borsa Kartları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {exchanges.map((exchange) => {
            const cvdValue = exchange.cvd;
            const isPositive = exchange.trend >= 0;
            const buyPercentage = (exchange.buyVolume / exchange.volume24h) * 100;
            
            return (
              <div 
                key={exchange.id}
                className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-5 border border-blue-500/20 hover:border-blue-500/40 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: exchange.color }}
                    />
                    <h3 className="text-lg font-bold text-white">{exchange.name}</h3>
                  </div>
                  <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    <span className="text-sm font-semibold">
                      {isPositive ? '+' : ''}{formatNumber(exchange.trend)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="text-blue-400 text-xs mb-1">CVD</div>
                    <div className={`text-xl font-bold ${cvdValue >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {cvdValue >= 0 ? '+' : ''}{formatNumber(cvdValue)}
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
                    <span className="text-green-400">{buyPercentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-green-500 h-full transition-all duration-500"
                      style={{ width: `${buyPercentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-red-400">Satım: {formatNumber(exchange.sellVolume)}</span>
                    <span className="text-red-400">{(100 - buyPercentage).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CVD Bar Chart */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20">
          <h2 className="text-xl font-bold text-white mb-4">Borsa Bazında CVD Karşılaştırması</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={exchanges.map(ex => ({ 
              name: ex.name, 
              CVD: ex.cvd / 1000000,
              color: ex.color 
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" angle={-45} textAnchor="end" height={100} />
              <YAxis stroke="#94a3b8" label={{ value: 'Milyon XRP', angle: -90, position: 'insideLeft', fill: '#94a3b8' }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #3b82f6', borderRadius: '8px' }}
                labelStyle={{ color: '#cbd5e1' }}
                formatter={(value) => [`${value.toFixed(2)}M XRP`, 'CVD']}
              />
              <Bar dataKey="CVD" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Footer Bilgi */}
        <div className="mt-6 bg-slate-800/50 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
          <div className="text-blue-400 text-sm">
            <p className="mb-2">
              <strong>CVD (Cumulative Volume Delta) Nedir?</strong> Kümülatif hacim delta, belirli bir süre boyunca alım ve satım hacimleri arasındaki farkın toplamıdır.
            </p>
            <p>
              • Pozitif CVD → Alım baskısı daha güçlü (Yükseliş eğilimi)<br/>
              • Negatif CVD → Satım baskısı daha güçlü (Düşüş eğilimi)<br/>
              • Veriler her 10 saniyede otomatik güncellenir
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default XRPCVDTracker;
