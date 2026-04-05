export type Category = 
  | 'Makanan & Minuman'
  | 'Transportasi'
  | 'Belanja'
  | 'Hiburan'
  | 'Tagihan & Utilitas'
  | 'Kesehatan & Kebugaran'
  | 'Perjalanan'
  | 'Lainnya';

export type RecurringFrequency = 'Harian' | 'Mingguan' | 'Bulanan' | 'Tahunan';

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  date: string; // ISO string
  description: string;
}

export interface RecurringExpense {
  id: string;
  amount: number;
  category: Category;
  description: string;
  frequency: RecurringFrequency;
  nextDueDate: string; // ISO string YYYY-MM-DD
  active: boolean;
}

export interface Budget {
  category: Category;
  amount: number;
  month: string; // YYYY-MM
}

export interface FinanceState {
  expenses: Expense[];
  budgets: Budget[];
}
