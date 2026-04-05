import React, { useState } from 'react';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { QuickInput } from './components/QuickInput';
import { ExpenseList } from './components/ExpenseList';
import { Insights } from './components/Insights';
import { Budgets } from './components/Budgets';
import { Recurring } from './components/Recurring';
import { Settings as SettingsView } from './components/Settings';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, AlertCircle, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';

const MonthSelector = () => {
  const { selectedMonth, setSelectedMonth } = useFinance();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.showPicker();
    }
  };

  const navigateMonth = (direction: number) => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1);
    date.setMonth(date.getMonth() + direction);
    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  return (
    <div className="flex items-center gap-1">
      <button 
        onClick={() => navigateMonth(-1)}
        className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
        title="Bulan Sebelumnya"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <div 
        onClick={handleClick}
        className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 md:px-3 py-1.5 md:py-2 shadow-sm hover:border-indigo-300 transition-colors focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 cursor-pointer shrink-0"
      >
        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
        <input 
          ref={inputRef}
          type="month" 
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-transparent border-none focus:outline-none text-[10px] md:text-xs font-medium text-gray-700 cursor-pointer w-20 md:w-24 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
        />
      </div>

      <button 
        onClick={() => navigateMonth(1)}
        className="p-1.5 md:p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
        title="Bulan Selanjutnya"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

const FINANCIAL_QUOTES = [
  "Hemat pangkal kaya.",
  "Catat setiap pengeluaran.",
  "Kendalikan uangmu.",
  "Investasi diri sendiri.",
  "Disiplin keuangan.",
  "Hemat itu hebat.",
  "Atur anggaranmu.",
  "Simpan untuk masa depan.",
  "Cerdas finansial.",
  "Kebebasan finansial."
];

function AppContent() {
  const [activeTab, setActiveTab] = useState('beranda');
  const { apiKey } = useFinance();
  const [quote, setQuote] = useState(() => FINANCIAL_QUOTES[Math.floor(Math.random() * FINANCIAL_QUOTES.length)]);

  React.useEffect(() => {
    if (activeTab === 'beranda') {
      setQuote(FINANCIAL_QUOTES[Math.floor(Math.random() * FINANCIAL_QUOTES.length)]);
    }
  }, [activeTab]);

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'beranda' && (
            <div className="space-y-4">
              {!apiKey && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-amber-900">API Key Belum Diatur</p>
                      <p className="text-xs text-amber-700">
                        Fitur AI memerlukan API Key Gemini. Silakan masukkan di menu Pengaturan.
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm whitespace-nowrap"
                  >
                    Atur Sekarang <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}

              <div className="flex items-center justify-between gap-2 md:gap-4">
                <div className="min-w-0">
                  <h1 className="text-base md:text-xl font-bold text-gray-900 truncate">{quote}</h1>
                  <p className="text-[10px] md:text-xs text-gray-500">Ringkasan keuangan Anda bulan ini.</p>
                </div>
                <MonthSelector />
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                <Dashboard />
                <div className="sticky top-16 md:top-4 z-10 bg-gray-50/80 backdrop-blur-sm py-1">
                  <QuickInput />
                </div>
              </div>
              
              <div className="pt-1">
                <div className="max-h-[400px] md:max-h-[500px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
                  <ExpenseList limit={20} hideHeader={true} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-4 sm:space-y-6 w-full overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-0.5 sm:mb-2">Wawasan Keuangan</h1>
                  <p className="text-[10px] sm:text-sm text-gray-500">Analisis pola pengeluaran Anda.</p>
                </div>
                <div className="flex justify-start sm:justify-end">
                  <MonthSelector />
                </div>
              </div>
              <Insights />
            </div>
          )}

          {activeTab === 'budgets' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Anggaran</h1>
                  <p className="text-gray-500">Pantau pengeluaran Anda terhadap target.</p>
                </div>
                <MonthSelector />
              </div>
              <Budgets />
            </div>
          )}

          {activeTab === 'recurring' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Pengeluaran Rutin</h1>
                <p className="text-gray-500">Kelola tagihan dan langganan Anda.</p>
              </div>
              <Recurring />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Pengaturan</h1>
                <p className="text-gray-500">Kelola preferensi dan API Key Anda.</p>
              </div>
              <SettingsView />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Layout>
  );
}

export default function App() {
  return (
    <FinanceProvider>
      <AppContent />
    </FinanceProvider>
  );
}
