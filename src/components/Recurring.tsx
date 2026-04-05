import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Category, RecurringFrequency } from '../types';
import { formatCurrency } from '../lib/utils';
import { Repeat, Plus, Trash2, Power, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

const CATEGORIES: Category[] = [
  'Makanan & Minuman',
  'Transportasi',
  'Belanja',
  'Hiburan',
  'Tagihan & Utilitas',
  'Kesehatan & Kebugaran',
  'Perjalanan',
  'Lainnya',
];

const FREQUENCIES: RecurringFrequency[] = ['Harian', 'Mingguan', 'Bulanan', 'Tahunan'];

export const Recurring: React.FC = () => {
  const { recurringExpenses, addRecurringExpense, deleteRecurringExpense, toggleRecurringExpense } = useFinance();
  const [isAdding, setIsAdding] = useState(false);
  
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('Tagihan & Utilitas');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('Bulanan');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description || !startDate) return;

    addRecurringExpense({
      amount: parseInt(amount, 10),
      category,
      description,
      frequency,
      nextDueDate: startDate,
      active: true,
    });

    setAmount('');
    setDescription('');
    setStartDate(new Date().toISOString().split('T')[0]);
    setIsAdding(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Repeat className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pengeluaran Rutin</h2>
              <p className="text-xs text-gray-500">Otomatis catat tagihan dan langganan Anda</p>
            </div>
          </div>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Tambah Baru</span>
          </button>
        </div>

        {isAdding && (
          <form onSubmit={handleSubmit} className="mb-8 p-5 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Tambah Pengeluaran Rutin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Nama/Deskripsi</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="cth. Netflix, Kos, Internet"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Jumlah (Rp)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Frekuensi</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Tanggal Mulai / Jatuh Tempo Berikutnya</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Simpan
              </button>
            </div>
          </form>
        )}

        <div className="space-y-3">
          {recurringExpenses.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
              <Repeat className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 font-medium">Belum ada pengeluaran rutin.</p>
            </div>
          ) : (
            recurringExpenses.map((expense) => (
              <div 
                key={expense.id} 
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-colors ${
                  expense.active ? 'bg-white border-gray-200 shadow-sm' : 'bg-gray-50 border-gray-200 opacity-75'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold truncate ${expense.active ? 'text-gray-900' : 'text-gray-500 line-through'}`}>
                      {expense.description}
                    </h3>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full whitespace-nowrap">
                      {expense.frequency}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span className="font-medium">{expense.category}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Jatuh tempo: {format(parseISO(expense.nextDueDate), 'dd MMM yyyy', { locale: id })}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between sm:justify-end gap-4 sm:w-auto w-full">
                  <div className={`font-bold text-lg ${expense.active ? 'text-gray-900' : 'text-gray-400'}`}>
                    {formatCurrency(expense.amount)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleRecurringExpense(expense.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        expense.active 
                          ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                      title={expense.active ? "Nonaktifkan" : "Aktifkan"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Hapus pengeluaran rutin ini?')) {
                          deleteRecurringExpense(expense.id);
                        }
                      }}
                      className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
