import React, { useState, useEffect } from 'react';
import { useFinance } from '../context/FinanceContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { format, parseISO, getDay } from 'date-fns';
import { id } from 'date-fns/locale';
import { Sparkles, Loader2, Send, X, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { queryFinancialAIStream, getFinancialInsightsStream } from '../services/ai';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

import { Category } from '../types';

const COLORS = ['#f97316', '#3b82f6', '#ec4899', '#a855f7', '#eab308', '#22c55e', '#14b8a6', '#6b7280'];

export const Insights: React.FC = () => {
  const { expenses, filteredExpenses, budgets, apiKey, selectedMonth } = useFinance();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [query, setQuery] = useState('');
  
  const [generalSummary, setGeneralSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [selectedTrendCategory, setSelectedTrendCategory] = useState<Category | 'Semua'>('Semua');

  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 640;

  // Clear AI insights and reset summary when month changes
  React.useEffect(() => {
    setAiInsight(null);
    setGeneralSummary(null);
    setIsSummaryExpanded(false);
    setQuery('');
  }, [selectedMonth]);

  const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({ name, value: value as number }))
    .sort((a, b) => b.value - a.value);

  const dailyExpenses = filteredExpenses
    .filter(e => selectedTrendCategory === 'Semua' || e.category === selectedTrendCategory)
    .reduce((acc, expense) => {
      const dateStr = typeof expense.date === 'string' ? expense.date.split('T')[0] : 'Invalid Date';
      acc[dateStr] = (acc[dateStr] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

  const barData = Object.entries(dailyExpenses)
    .map(([date, amount]) => {
      let formattedDate = 'Invalid Date';
      if (date !== 'Invalid Date') {
        try {
          const d = new Date(date);
          if (!isNaN(d.getTime())) {
            formattedDate = format(d, 'dd MMM', { locale: id });
          }
        } catch (e) {
          console.warn('Invalid date encountered:', date);
        }
      }
      
      return {
        date,
        formattedDate,
        amount: amount as number
      };
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const handleQueryAI = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!apiKey) {
      alert("Silakan masukkan API Key Gemini di menu Pengaturan.");
      return;
    }
    
    if (!query.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    setAiInsight(""); // Reset insight before streaming
    
    try {
      const stream = await queryFinancialAIStream(query.trim(), expenses, budgets, selectedMonth, apiKey);
      setQuery('');
      for await (const chunk of stream) {
        setAiInsight(prev => (prev || "") + chunk);
      }
    } catch (error: any) {
      console.error(error);
      setError("Gagal mendapatkan wawasan AI. Periksa koneksi atau API Key Anda.");
      if (!aiInsight) setAiInsight(null);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleSummary = async () => {
    if (!isSummaryExpanded && !generalSummary) {
      if (!apiKey) {
        alert("Silakan masukkan API Key Gemini di menu Pengaturan.");
        return;
      }
      setIsGeneratingSummary(true);
      setError(null);
      setGeneralSummary(""); // Reset before streaming
      setIsSummaryExpanded(true); // Expand immediately to show typing
      
      try {
        const stream = await getFinancialInsightsStream(filteredExpenses, budgets, apiKey);
        for await (const chunk of stream) {
          setGeneralSummary(prev => (prev || "") + chunk);
        }
      } catch (error: any) {
        console.error(error);
        setError("Gagal mendapatkan ringkasan AI.");
        if (!generalSummary) setGeneralSummary(null);
      } finally {
        setIsGeneratingSummary(false);
      }
    } else {
      setIsSummaryExpanded(!isSummaryExpanded);
    }
  };

  if (pieData.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">Data belum cukup untuk menghasilkan wawasan pada bulan ini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Summary Box (Collapsible) */}
      <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden w-full">
        <button 
          onClick={handleToggleSummary}
          className="w-full flex items-center justify-between p-4 hover:bg-indigo-50/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Lightbulb className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-gray-900">Ringkasan Cerdas</h3>
              <p className="text-[10px] text-gray-500">Analisis otomatis pola pengeluaran Anda.</p>
            </div>
          </div>
          {isGeneratingSummary ? (
            <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
          ) : (
            isSummaryExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <AnimatePresence>
          {isSummaryExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="px-4 pb-5 pt-1 border-t border-indigo-50">
                {generalSummary ? (
                  <div className="prose prose-sm max-w-none text-gray-700 [&_p]:mb-4 last:[&_p]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mb-2">
                    <Markdown>{generalSummary}</Markdown>
                  </div>
                ) : (
                  <div className="py-4 flex justify-center">
                    <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* AI Query Section */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-lg p-4 sm:p-6 overflow-hidden relative text-white w-full">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Sparkles className="w-24 h-24" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-200" />
              <h2 className="text-base sm:text-lg font-bold">Tanya AI Keuangan</h2>
            </div>
            {aiInsight && (
              <button 
                onClick={() => setAiInsight(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="Hapus Jawaban"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl flex items-start gap-2">
              <p className="text-sm text-red-100">{error}</p>
            </div>
          )}

          {aiInsight && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 border border-white/20 shadow-xl relative group"
            >
              <div className="prose prose-sm max-w-none text-gray-800 [&_p]:mb-4 last:[&_p]:mb-0 text-xs sm:text-sm">
                <Markdown>{aiInsight}</Markdown>
              </div>
            </motion.div>
          )}

          <form onSubmit={handleQueryAI} className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tanyakan sesuatu..."
              className="w-full pl-3.5 pr-10 py-2.5 sm:pl-4 sm:pr-12 sm:py-3 bg-white border border-transparent rounded-xl focus:outline-none focus:ring-2 focus:ring-white/30 placeholder-gray-400 text-xs sm:text-sm text-gray-900 transition-all shadow-md"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={isGenerating || !query.trim()}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </form>
          
          {!aiInsight && !query && (
            <p className="mt-2.5 sm:mt-3 text-[10px] sm:text-xs text-indigo-100 opacity-80">
              Contoh: "Berapa total makan saya?", "Kategori apa yang paling boros?"
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 w-full overflow-hidden">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">Pengeluaran berdasarkan Kategori</h2>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? "50%" : "60%"}
                outerRadius={isMobile ? "70%" : "80%"}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={isMobile ? 60 : 36} 
                iconSize={isMobile ? 8 : 10} 
                wrapperStyle={{ fontSize: isMobile ? '10px' : '12px', paddingTop: '10px' }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 w-full overflow-hidden">
        <div className="space-y-4 mb-6 w-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Tren Pengeluaran Harian</h2>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Filter Kategori</div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none w-full">
            {['Semua', 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedTrendCategory(cat as any)}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border shrink-0",
                  selectedTrendCategory === cat
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                    : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: isMobile ? -30 : 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis 
                dataKey="formattedDate" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: isMobile ? 8 : 10, fill: '#6b7280' }} 
                dy={10}
                interval={isMobile ? 'preserveStartEnd' : 0}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: isMobile ? 8 : 10, fill: '#6b7280' }}
                tickFormatter={(value) => typeof value === 'number' ? `${Math.round(value / 1000)}k` : '0k'}
                width={isMobile ? 35 : 45}
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                formatter={(value: number) => [formatCurrency(value), 'Pengeluaran']}
                labelStyle={{ color: '#374151', fontWeight: 500, marginBottom: '4px' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
