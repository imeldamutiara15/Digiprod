import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Expense, Budget, FinanceState, Category, RecurringExpense } from '../types';

interface FinanceContextType {
  expenses: Expense[];
  filteredExpenses: Expense[];
  budgets: Budget[]; // This will be the budgets for the selected month
  recurringExpenses: RecurringExpense[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  addExpense: (expense: Omit<Expense, 'id'>) => void;
  deleteExpense: (id: string) => void;
  updateBudget: (budget: Omit<Budget, 'month'>) => void;
  addRecurringExpense: (expense: Omit<RecurringExpense, 'id'>) => void;
  deleteRecurringExpense: (id: string) => void;
  toggleRecurringExpense: (id: string) => void;
  importData: (data: { expenses?: Expense[]; budgets?: Budget[]; recurringExpenses?: RecurringExpense[] }) => void;
  clearAllData: () => void;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

const defaultCategories: Category[] = [
  'Makanan & Minuman',
  'Transportasi',
  'Belanja',
  'Hiburan',
  'Tagihan & Utilitas',
  'Kesehatan & Kebugaran',
  'Perjalanan',
  'Lainnya',
];

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem('finance_expenses_v3');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse expenses from localStorage', e);
      return [];
    }
  });

  const [allBudgets, setAllBudgets] = useState<Budget[]>(() => {
    try {
      const saved = localStorage.getItem('finance_budgets_v2');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse budgets from localStorage', e);
      return [];
    }
  });

  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>(() => {
    try {
      const saved = localStorage.getItem('finance_recurring_v1');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse recurring expenses from localStorage', e);
      return [];
    }
  });

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [apiKey, setApiKey] = useState(() => {
    return localStorage.getItem('gemini_api_key') || '';
  });

  useEffect(() => {
    localStorage.setItem('finance_expenses_v3', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('finance_budgets_v2', JSON.stringify(allBudgets));
  }, [allBudgets]);

  useEffect(() => {
    localStorage.setItem('finance_recurring_v1', JSON.stringify(recurringExpenses));
  }, [recurringExpenses]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  // Process recurring expenses
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    let hasUpdates = false;
    const newExpenses: Expense[] = [];

    const updatedRecurring = recurringExpenses.map(req => {
      if (!req.active) return req;

      let currentDueDate = req.nextDueDate;
      let updatedReq = { ...req };

      let safetyCounter = 0;
      while (currentDueDate <= today && safetyCounter < 100) {
        newExpenses.push({
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
          amount: req.amount,
          category: req.category,
          description: req.description + ' (Rutin)',
          date: currentDueDate
        });

        const dateObj = new Date(currentDueDate);
        if (req.frequency === 'Harian') dateObj.setDate(dateObj.getDate() + 1);
        else if (req.frequency === 'Mingguan') dateObj.setDate(dateObj.getDate() + 7);
        else if (req.frequency === 'Bulanan') dateObj.setMonth(dateObj.getMonth() + 1);
        else if (req.frequency === 'Tahunan') dateObj.setFullYear(dateObj.getFullYear() + 1);

        currentDueDate = dateObj.toISOString().split('T')[0];
        updatedReq.nextDueDate = currentDueDate;
        hasUpdates = true;
        safetyCounter++;
      }
      return updatedReq;
    });

    if (hasUpdates) {
      setRecurringExpenses(updatedRecurring);
      setExpenses(prev => {
        const combined = [...newExpenses, ...prev];
        return combined.sort((a, b) => b.date.localeCompare(a.date));
      });
    }
  }, [recurringExpenses]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => e.date.startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const budgets = useMemo(() => {
    const currentMonthBudgets = allBudgets.filter(b => b.month === selectedMonth);
    
    if (currentMonthBudgets.length > 0) {
      return currentMonthBudgets;
    }

    // Fallback logic: find the most recent month that has budgets
    const sortedMonths = Array.from(new Set(allBudgets.map(b => b.month))).sort().reverse();
    const lastMonthWithBudget = sortedMonths.find(m => m < selectedMonth);

    if (lastMonthWithBudget) {
      return allBudgets.filter(b => b.month === lastMonthWithBudget).map(b => ({
        ...b,
        month: selectedMonth
      }));
    }

    // Default budgets if no previous month found
    return defaultCategories.map(category => ({
      category,
      amount: 1000000, // Default 1jt
      month: selectedMonth
    }));
  }, [allBudgets, selectedMonth]);

  const addExpense = (expense: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expense,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
    };
    setExpenses((prev) => [newExpense, ...prev]);
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const updateBudget = (budget: Omit<Budget, 'month'>) => {
    setAllBudgets((prev) => {
      const otherBudgets = prev.filter(b => !(b.category === budget.category && b.month === selectedMonth));
      return [...otherBudgets, { ...budget, month: selectedMonth }];
    });
  };

  const addRecurringExpense = (expense: Omit<RecurringExpense, 'id'>) => {
    const newReq: RecurringExpense = {
      ...expense,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
    };
    setRecurringExpenses(prev => [...prev, newReq]);
  };

  const deleteRecurringExpense = (id: string) => {
    setRecurringExpenses(prev => prev.filter(req => req.id !== id));
  };

  const toggleRecurringExpense = (id: string) => {
    setRecurringExpenses(prev => prev.map(req => 
      req.id === id ? { ...req, active: !req.active } : req
    ));
  };
  
  const importData = (data: { expenses?: Expense[]; budgets?: Budget[]; recurringExpenses?: RecurringExpense[] }) => {
    if (data.expenses) setExpenses(data.expenses);
    if (data.budgets) setAllBudgets(data.budgets);
    if (data.recurringExpenses) setRecurringExpenses(data.recurringExpenses);
  };

  const clearAllData = () => {
    setExpenses([]);
    setAllBudgets([]);
    setRecurringExpenses([]);
    localStorage.removeItem('finance_expenses_v3');
    localStorage.removeItem('finance_budgets_v2');
    localStorage.removeItem('finance_recurring_v1');
  };

  return (
    <FinanceContext.Provider value={{ 
      expenses, 
      filteredExpenses,
      budgets, 
      recurringExpenses,
      selectedMonth,
      setSelectedMonth,
      apiKey,
      setApiKey,
      addExpense, 
      deleteExpense, 
      updateBudget,
      addRecurringExpense,
      deleteRecurringExpense,
      toggleRecurringExpense,
      importData,
      clearAllData
    }}>
      {children}
    </FinanceContext.Provider>
  );
};

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (context === undefined) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return context;
};
