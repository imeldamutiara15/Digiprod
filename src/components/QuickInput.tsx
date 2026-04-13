import React, { useState } from 'react';
import { Send, Loader2, Sparkles, Coins, AlertCircle, Check, X } from 'lucide-react';
import { parseExpenseInput } from '../services/ai';
import { useFinance } from '../context/FinanceContext';
import { Expense } from '../types';

export const QuickInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFrugalMode, setIsFrugalMode] = useState(false);
  const [pendingExpenses, setPendingExpenses] = useState<(Omit<Expense, 'id'> & { frugalWarning?: string })[] | null>(null);
  const [feedback, setFeedback] = useState<{ 
    message: string; 
    type: 'success' | 'error';
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const { addExpense, apiKey, selectedMonth, setSelectedMonth, budgets, filteredExpenses } = useFinance();

  const handleSaveExpenses = (expensesToSave: Omit<Expense, 'id'>[]) => {
    expensesToSave.forEach(expense => addExpense(expense));
    
    const firstDate = expensesToSave[0].date;
    const expenseMonth = typeof firstDate === 'string' ? firstDate.substring(0, 7) : ''; // YYYY-MM
    
    if (expenseMonth && expenseMonth !== selectedMonth) {
      setFeedback({
        message: `Berhasil! Dicatat pada ${firstDate}.`,
        type: 'success',
        action: {
          label: 'Lihat',
          onClick: () => {
            setSelectedMonth(expenseMonth);
            setFeedback(null);
          }
        }
      });
    } else {
      setFeedback({
        message: "Berhasil dicatat!",
        type: 'success'
      });
    }
    
    setInput('');
    setPendingExpenses(null);
    if (!expenseMonth || expenseMonth === selectedMonth) {
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    if (!apiKey) {
      setFeedback({ message: "Silakan masukkan API Key Gemini Anda di menu Pengaturan terlebih dahulu.", type: 'error' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    setPendingExpenses(null);
    try {
      const parsedExpenses = await parseExpenseInput(input, apiKey, isFrugalMode, budgets, filteredExpenses);
      if (parsedExpenses && parsedExpenses.length > 0) {
        const hasWarning = parsedExpenses.some(e => e.frugalWarning);
        
        if (isFrugalMode && hasWarning) {
          setPendingExpenses(parsedExpenses);
        } else {
          handleSaveExpenses(parsedExpenses);
        }
      } else {
        setFeedback({ message: "Tidak dapat memahami pengeluaran. Silakan coba lagi.", type: 'error' });
      }
    } catch (error: any) {
      if (error?.message === 'QUOTA_EXCEEDED') {
        setFeedback({ message: "Token gratis harian Anda telah habis. Harap tunggu hingga besok.", type: 'error' });
      } else {
        console.error("Failed to parse expense", error);
        setFeedback({ message: "Terjadi kesalahan saat memproses permintaan.", type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <h2 className="text-xs font-semibold text-gray-800">Pencatat Pengeluaran AI</h2>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsFrugalMode(!isFrugalMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full transition-all shadow-sm border ${
              isFrugalMode 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
            title="AI akan mengingatkan Anda jika pengeluaran bersifat non-primer"
          >
            <Coins className={`w-3.5 h-3.5 transition-colors ${isFrugalMode ? 'text-emerald-500' : 'text-gray-400'}`} />
            <span className={`text-[10px] font-bold transition-colors ${isFrugalMode ? 'text-emerald-700' : 'text-gray-500'}`}>
              Mode Hemat
            </span>
            <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-300 ml-0.5 ${isFrugalMode ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${isFrugalMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
            </div>
          </button>
          {feedback && !pendingExpenses && (
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${feedback.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {feedback.message}
              </span>
              {feedback.action && (
                <button 
                  onClick={feedback.action.onClick}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full transition-colors"
                >
                  {feedback.action.label}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {pendingExpenses ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              {pendingExpenses.map((exp, idx) => (
                <div key={idx} className="text-xs text-amber-900">
                  <span className="font-bold">{exp.description} (Rp {exp.amount.toLocaleString('id-ID')}): </span>
                  {exp.frugalWarning ? (
                    <span className="italic">"{exp.frugalWarning}"</span>
                  ) : (
                    <span>Tampak seperti kebutuhan primer.</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setPendingExpenses(null)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Batal
            </button>
            <button
              onClick={() => handleSaveExpenses(pendingExpenses)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Tetap Catat
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="cth., Kopi 50k di 2 februari atau Makan 100k kemarin..."
            className="w-full pl-3 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-xs md:text-sm text-gray-700 placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </form>
      )}
    </div>
  );
};
