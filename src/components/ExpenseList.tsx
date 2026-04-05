import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Trash2, ShoppingBag, Coffee, Car, Film, Zap, Heart, Plane, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Category } from '../types';
import { formatCurrency } from '../lib/utils';

const categoryIcons: Record<Category, React.ElementType> = {
  'Makanan & Minuman': Coffee,
  'Transportasi': Car,
  'Belanja': ShoppingBag,
  'Hiburan': Film,
  'Tagihan & Utilitas': Zap,
  'Kesehatan & Kebugaran': Heart,
  'Perjalanan': Plane,
  'Lainnya': MoreHorizontal,
};

const categoryColors: Record<Category, string> = {
  'Makanan & Minuman': 'bg-orange-100 text-orange-600',
  'Transportasi': 'bg-blue-100 text-blue-600',
  'Belanja': 'bg-pink-100 text-pink-600',
  'Hiburan': 'bg-purple-100 text-purple-600',
  'Tagihan & Utilitas': 'bg-yellow-100 text-yellow-600',
  'Kesehatan & Kebugaran': 'bg-green-100 text-green-600',
  'Perjalanan': 'bg-teal-100 text-teal-600',
  'Lainnya': 'bg-gray-100 text-gray-600',
};

type SortKey = 'date' | 'amount' | 'description';
type SortOrder = 'asc' | 'desc';

export const ExpenseList: React.FC<{ limit?: number; hideHeader?: boolean }> = ({ limit, hideHeader }) => {
  const { filteredExpenses, deleteExpense } = useFinance();
  const [sortKey, setSortKey] = React.useState<SortKey>('date');
  const [sortOrder, setSortOrder] = React.useState<SortOrder>('desc');

  const sortedExpenses = React.useMemo(() => {
    return [...filteredExpenses].sort((a, b) => {
      let comparison = 0;
      if (sortKey === 'date') {
        comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortKey === 'description') {
        comparison = (a.description || '').localeCompare(b.description || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredExpenses, sortKey, sortOrder]);

  const displayExpenses = limit ? sortedExpenses.slice(0, limit) : sortedExpenses;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  if (filteredExpenses.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShoppingBag className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Belum ada pengeluaran</h3>
        <p className="text-gray-500 text-sm">Catat pengeluaran pertama Anda untuk bulan ini.</p>
      </div>
    );
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {!hideHeader ? (
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
          <h2 className="text-lg font-semibold text-gray-800">Pengeluaran Terakhir</h2>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => toggleSort('date')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortKey === 'date' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              Tanggal <SortIcon k="date" />
            </button>
            <button 
              onClick={() => toggleSort('amount')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortKey === 'amount' ? 'bg-indigo-100 text-indigo-700' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              Jumlah <SortIcon k="amount" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 border-b border-gray-50 flex justify-end items-center gap-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Sort:</span>
          <button 
            onClick={() => toggleSort('date')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${sortKey === 'date' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Tgl <SortIcon k="date" />
          </button>
          <button 
            onClick={() => toggleSort('amount')}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${sortKey === 'amount' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Rp <SortIcon k="amount" />
          </button>
        </div>
      )}
      <div className="divide-y divide-gray-50">
        {displayExpenses.map((expense) => {
          const Icon = categoryIcons[expense.category] || MoreHorizontal;
          const colorClass = categoryColors[expense.category] || categoryColors['Lainnya'];
          
          return (
            <div key={expense.id} className="px-4 md:px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors group min-w-0">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{expense.description}</p>
                  <div className="flex items-center gap-2 text-xs md:text-sm text-gray-500 mt-0.5">
                    <span className="truncate">{expense.category}</span>
                    <span className="shrink-0">•</span>
                    <span className="shrink-0">
                      {(() => {
                        try {
                          const d = new Date(expense.date);
                          return isNaN(d.getTime()) ? 'Invalid Date' : format(d, 'd MMM', { locale: id });
                        } catch (e) {
                          return 'Invalid Date';
                        }
                      })()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 md:gap-4 shrink-0 ml-2">
                <span className="font-semibold text-gray-900 text-sm md:text-base whitespace-nowrap">
                  {formatCurrency(expense.amount)}
                </span>
                <button
                  onClick={() => deleteExpense(expense.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg md:opacity-0 md:group-hover:opacity-100 transition-all"
                  aria-label="Hapus pengeluaran"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
