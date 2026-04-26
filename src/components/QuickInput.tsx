import React, { useState } from 'react';
import { Send, Loader2, Sparkles, Coins, AlertCircle, Check, X } from 'lucide-react';
import { parseExpenseInput, streamFrugalWarning } from '../services/ai';
import { useFinance } from '../context/FinanceContext';
import { Expense } from '../types';

export const QuickInput: React.FC = () => {
  const [input, setInput] = useState('');
  const [isFrugalMode, setIsFrugalMode] = useState(false);
  const [processingTasks, setProcessingTasks] = useState<{ id: string; text: string }[]>([]);
  const [pendingExpenses, setPendingExpenses] = useState<(Omit<Expense, 'id'> & { frugalWarning?: string; originalText?: string })[] | null>(null);
  const [feedback, setFeedback] = useState<{ 
    message: string; 
    type: 'success' | 'error';
    action?: { label: string; onClick: () => void };
  } | null>(null);
  const { addExpense, apiKey, selectedMonth, setSelectedMonth, budgets, filteredExpenses } = useFinance();

  const handleSaveExpenses = (expensesToSave: (Omit<Expense, 'id'> & { originalText?: string })[]) => {
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
    
    setPendingExpenses(null);
    if (!expenseMonth || expenseMonth === selectedMonth) {
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!apiKey) {
      setFeedback({ message: "Silakan masukkan API Key Gemini Anda di menu Pengaturan.", type: 'error' });
      return;
    }

    const currentInput = input;
    const taskId = Math.random().toString(36).substring(7);
    
    setInput(''); // Clear input immediately for "instant" feel
    setProcessingTasks(prev => [...prev, { id: taskId, text: currentInput }]);
    setFeedback(null);

    try {
      const parsedExpenses = await parseExpenseInput(currentInput, apiKey, isFrugalMode, budgets, filteredExpenses);
      
      // Remove from processing queue
      setProcessingTasks(prev => prev.filter(t => t.id !== taskId));

      if (parsedExpenses && parsedExpenses.length > 0) {
        if (isFrugalMode) {
          // Initialize pending expenses with empty warnings
          const initialPending = parsedExpenses.map(e => ({ ...e, frugalWarning: '...', originalText: currentInput }));
          setPendingExpenses(initialPending);

          // Stream warnings for each expense
          parsedExpenses.forEach((expense, index) => {
            (async () => {
              try {
                let firstChunk = true;
                const stream = streamFrugalWarning(expense as Expense, apiKey, budgets, filteredExpenses);
                for await (const chunk of stream) {
                  setPendingExpenses(prev => {
                    if (!prev) return prev;
                    const updated = [...prev];
                    if (firstChunk) {
                      updated[index] = { ...updated[index], frugalWarning: chunk };
                      firstChunk = false;
                    } else {
                      updated[index] = { ...updated[index], frugalWarning: (updated[index].frugalWarning || '') + chunk };
                    }
                    return updated;
                  });
                }
              } catch (err) {
                console.error("Error streaming frugal warning", err);
              }
            })();
          });
        } else {
          handleSaveExpenses(parsedExpenses);
        }
      } else {
        setFeedback({ message: `Gagal memahami: "${currentInput}"`, type: 'error' });
      }
    } catch (error: any) {
      setProcessingTasks(prev => prev.filter(t => t.id !== taskId));
      if (error?.message === 'MODEL_NOT_FOUND') {
        setFeedback({ message: "Model AI tidak tersedia. Hubungi admin.", type: 'error' });
      } else if (error?.message === 'RATE_LIMIT_RPM') {
        setFeedback({ message: "Terlalu banyak permintaan. Tunggu 1 menit.", type: 'error' });
      } else if (error?.message === 'QUOTA_EXCEEDED') {
        setFeedback({ message: "Kuota harian habis. Tunggu besok.", type: 'error' });
      } else {
        console.error("Failed to parse expense", error);
        setFeedback({ message: "Terjadi kesalahan AI.", type: 'error' });
      }
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl shadow-sm border border-indigo-100 p-3 md:p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
        <Sparkles className="w-12 h-12 text-indigo-600" />
      </div>
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <h2 className="text-xs font-bold text-indigo-900">Pencatat Pengeluaran AI</h2>
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

      {/* Processing Tasks (Optimistic UI) */}
      {processingTasks.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {processingTasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-medium animate-pulse border border-indigo-100">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Memproses: "{task.text}"</span>
            </div>
          ))}
        </div>
      )}

      {pendingExpenses ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Peringatan Mode Hemat</p>
              {pendingExpenses.map((exp, idx) => (
                <div key={idx} className="text-xs text-amber-900 leading-relaxed">
                  <span className="font-bold">{exp.description} (Rp {exp.amount.toLocaleString('id-ID')}): </span>
                  {exp.frugalWarning ? (
                    <span className="italic relative">
                      "{exp.frugalWarning}"
                      {exp.frugalWarning.endsWith('...') && (
                        <span className="inline-block w-1 h-3 bg-amber-400 animate-pulse ml-0.5" />
                      )}
                    </span>
                  ) : (
                    <span className="opacity-50">Menganalisa...</span>
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
        <form onSubmit={handleSubmit} className="relative z-10">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="cth., Kopi 50k atau Makan 100k kemarin..."
            className="w-full pl-3 pr-10 py-2.5 bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-xs md:text-sm text-gray-700 placeholder-gray-400 shadow-sm"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      )}
    </div>
  );
};
