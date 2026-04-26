import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { TrendingDown, TrendingUp, Coins } from 'lucide-react';
import { formatCurrency } from '../lib/utils';

export const Dashboard: React.FC = () => {
  const { filteredExpenses, budgets } = useFinance();

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  
  // Treat "Tagihan & Utilitas" budget as spent/protected
  const expensesByCategory = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const adjustedExpenses = budgets.reduce((sum, b) => {
    if (b.category === 'Tagihan & Utilitas') {
      const spent = expensesByCategory[b.category] || 0;
      return sum + Math.max(spent, b.amount);
    }
    return sum + (expensesByCategory[b.category] || 0);
  }, 0);

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const remaining = totalBudget - adjustedExpenses;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pengeluaran</h3>
          <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center">
            <TrendingDown className="w-3.5 h-3.5 text-red-500" />
          </div>
        </div>
        <p className="text-xl md:text-2xl font-bold text-gray-900">{formatCurrency(totalExpenses)}</p>
      </div>

      <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wider">Sisa Anggaran</h3>
          <div className="w-7 h-7 rounded-full bg-green-50 flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-green-500" />
          </div>
        </div>
        <p className={`text-xl md:text-2xl font-bold ${remaining < 0 ? 'text-red-500' : 'text-gray-900'}`}>
          {formatCurrency(remaining)}
        </p>
      </div>
    </div>
  );
};
