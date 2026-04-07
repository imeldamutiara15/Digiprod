import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Category } from '../types';
import { formatCurrency } from '../lib/utils';
import { Settings2, Save, X, Calendar, Sparkles, Loader2, Check, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { getBudgetOptimizationStream } from '../services/ai';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';

export const Budgets: React.FC = () => {
  const { filteredExpenses, budgets, updateBudget, selectedMonth, apiKey } = useFinance();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, number>>({});
  
  const [aiMessage, setAiMessage] = useState<string>('');
  const [aiProposedBudgets, setAiProposedBudgets] = useState<Record<string, number> | null>(null);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState('');

  const formattedMonth = format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: id });

  const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);

  const handleAiInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isGenerating) return;

    if (!apiKey) {
      alert("Silakan masukkan API Key Gemini di menu Pengaturan.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setAiMessage('');
    setAiProposedBudgets(null);
    
    try {
      const stream = await getBudgetOptimizationStream(aiInput, budgets, filteredExpenses, apiKey);
      setAiInput('');
      let fullText = '';
      
      for await (const chunk of stream) {
        fullText += chunk;
        
        // Extract text before any JSON block for streaming display
        let textPart = fullText;
        const jsonMatchIndex = fullText.indexOf('```json');
        const fallbackMatchIndex = fullText.indexOf('```\n{');
        
        if (jsonMatchIndex !== -1) {
          textPart = fullText.substring(0, jsonMatchIndex);
        } else if (fallbackMatchIndex !== -1) {
          textPart = fullText.substring(0, fallbackMatchIndex);
        }
        
        setAiMessage(textPart.trim());
      }
      
      // Parse the JSON block after stream finishes
      let parsedBudgets = null;
      const jsonMatch = fullText.match(/```(?:json)?\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          parsedBudgets = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error("Failed to parse JSON from AI", e);
        }
      } else {
         // Fallback if AI didn't use markdown code blocks
         const bracketMatch = fullText.match(/\{[\s\S]*\}/);
         if (bracketMatch) {
           try {
             parsedBudgets = JSON.parse(bracketMatch[0]);
           } catch(e) {}
         }
      }
      
      if (parsedBudgets) {
        setAiProposedBudgets(parsedBudgets);
      } else {
        setError("Gagal membaca format anggaran dari AI.");
      }
    } catch (error: any) {
      if (error?.message === 'QUOTA_EXCEEDED') {
        setError("Token gratis harian Anda telah habis. Harap tunggu hingga besok (waktu reset) atau gunakan API Key berbayar.");
      } else {
        console.error(error);
        setError("Gagal mendapatkan optimasi AI.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const applyOptimization = () => {
    if (!aiProposedBudgets) return;
    
    Object.entries(aiProposedBudgets).forEach(([category, amount]) => {
      updateBudget({ category: category as Category, amount });
    });
    setAiMessage('');
    setAiProposedBudgets(null);
  };

  const closeAiPanel = () => {
    setAiMessage('');
    setAiProposedBudgets(null);
  };

  const handleEditClick = () => {
    const currentValues: Record<string, number> = {};
    budgets.forEach(b => {
      currentValues[b.category] = b.amount;
    });
    setEditValues(currentValues);
    setIsEditing(true);
  };

  const handleSave = () => {
    Object.entries(editValues).forEach(([category, amount]) => {
      updateBudget({ category: category as Category, amount });
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleInputChange = (category: string, value: string) => {
    const numValue = parseInt(value, 10);
    setEditValues(prev => ({
      ...prev,
      [category]: isNaN(numValue) ? 0 : numValue
    }));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">Total Keseluruhan</p>
          <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(totalBudget)}</p>
        </div>
        
        {!isEditing ? (
          <button 
            onClick={handleEditClick}
            className="flex items-center justify-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-4 py-2 rounded-xl transition-colors"
          >
            <Settings2 className="w-4 h-4" />
            Atur Manual
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleCancel}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-700 bg-gray-100 px-4 py-2 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
              Batal
            </button>
            <button 
              onClick={handleSave}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl transition-colors"
            >
              <Save className="w-4 h-4" />
              Simpan
            </button>
          </div>
        )}
      </div>

      <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Sparkles className="w-16 h-16 text-indigo-600" />
        </div>
        <div className="relative z-10">
          <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Asisten AI
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleAiInputSubmit} className="relative">
            <input
              type="text"
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Contoh: 'Bantu saya hemat 500rb bulan ini' atau 'Sesuaikan anggaran untuk liburan'"
              className="w-full pl-3.5 pr-10 py-2.5 sm:pl-4 sm:pr-12 sm:py-3 bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm placeholder:text-gray-400 shadow-sm"
              disabled={isGenerating}
            />
            <button
              type="submit"
              disabled={!aiInput.trim() || isGenerating}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30"
            >
              {isGenerating ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </form>
          <p className="text-[10px] text-indigo-500/80 mt-2 font-medium">
            Ketikkan target Anda, AI akan menyesuaikan alokasi tiap kategori secara otomatis.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {(aiMessage || aiProposedBudgets) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl p-5 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
              <Sparkles className="w-12 h-12 text-indigo-600" />
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-gray-900">Rekomendasi Optimasi Anggaran</h3>
              </div>
              <button 
                onClick={closeAiPanel}
                className="p-1 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            
            {aiMessage && (
              <div className="prose prose-sm max-w-none text-gray-700 mb-5 p-4 bg-white/60 rounded-xl border border-indigo-50/50 shadow-sm text-xs sm:text-sm">
                <Markdown>{aiMessage}</Markdown>
              </div>
            )}
            
            {aiProposedBudgets && (
              <>
                <div className="space-y-3 mb-5">
                  {Object.entries(aiProposedBudgets).map(([category, amount]) => {
                    return (
                      <div key={category} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 font-medium">{category}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-indigo-700 font-bold">{formatCurrency(amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={applyOptimization}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold text-sm shadow-md active:scale-[0.98]"
                >
                  <Check className="w-4 h-4" />
                  Terapkan Perubahan Anggaran
                </button>
              </>
            )}
            {isGenerating && !aiMessage && !aiProposedBudgets && (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {budgets.map((budget) => {
          const spent = expensesByCategory[budget.category] || 0;
          const isOverBudget = spent > budget.amount;
          const percentage = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : (spent > 0 ? 100 : 0);

          if (isEditing) {
            return (
              <div key={budget.category} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100 min-w-0">
                <span className="font-medium text-gray-800 truncate">{budget.category}</span>
                <div className="relative w-full sm:w-64 shrink-0">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">Rp</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editValues[budget.category] || ''}
                      onChange={(e) => handleInputChange(budget.category, e.target.value)}
                      className="pl-10 pr-4 py-2.5 w-full bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-900"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 text-right font-medium">
                    {formatCurrency(editValues[budget.category] || 0)}
                  </p>
                </div>
              </div>
            );
          }

          return (
            <div key={budget.category} className="min-w-0">
              <div className="flex justify-between items-end mb-2 gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-gray-800 truncate block">{budget.category}</span>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">
                    {formatCurrency(spent)} dari {formatCurrency(budget.amount)}
                  </p>
                </div>
                <span className={`text-sm font-semibold shrink-0 ${isOverBudget ? 'text-red-500' : 'text-gray-700'}`}>
                  {isOverBudget ? 'Melebihi Anggaran' : `${percentage.toFixed(0)}%`}
                </span>
              </div>
              <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget ? 'bg-red-500' : percentage > 80 ? 'bg-yellow-400' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
