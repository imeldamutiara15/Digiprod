import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Expense, Budget } from "../types";

export async function testApiKey(apiKey: string): Promise<boolean> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) return false;
  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "test"
    });
    return !!response.text;
  } catch (error: any) {
    let errorStr = '';
    if (error instanceof Error) {
      errorStr = error.message;
    } else {
      errorStr = String(error);
    }
    errorStr = errorStr.toLowerCase();
    
    // Detailed error detection
    if (errorStr.includes('429') || (errorStr.includes('quota') && !errorStr.includes('model'))) {
      throw new Error("QUOTA_EXCEEDED");
    }
    if (errorStr.includes('404') || errorStr.includes('not found') || errorStr.includes('model')) {
      throw new Error("MODEL_NOT_FOUND");
    }
    if (errorStr.includes('403') || errorStr.includes('permission') || errorStr.includes('key_invalid') || errorStr.includes('invalid_key')) {
      throw new Error("INVALID_KEY");
    }
    console.error("API Key test failed:", error);
    return false;
  }
}

function handleAiError(error: any) {
  let errorStr = '';
  if (error instanceof Error) {
    errorStr = error.message;
  } else if (typeof error === 'object' && error !== null) {
    try { errorStr = JSON.stringify(error); } catch (e) { errorStr = String(error); }
  } else {
    errorStr = String(error);
  }
  errorStr = errorStr.toLowerCase();
  
  if (errorStr.includes('429') || errorStr.includes('quota') || errorStr.includes('exhausted')) {
    // Specifically check for RPM vs RPD
    if (errorStr.includes('minute') || errorStr.includes('limit reached')) {
      throw new Error("RATE_LIMIT_RPM");
    }
    throw new Error("QUOTA_EXCEEDED");
  }

  if (errorStr.includes('404') || errorStr.includes('not found') || errorStr.includes('model')) {
    throw new Error("MODEL_NOT_FOUND");
  }

  console.error("AI Error:", error);
  return null;
}

let cachedAi: GoogleGenAI | null = null;
let cachedKey: string | null = null;

function getAi(apiKey: string) {
  if (cachedAi && cachedKey === apiKey) return cachedAi;
  cachedAi = new GoogleGenAI({ apiKey });
  cachedKey = apiKey;
  return cachedAi;
}

// Helper to format expenses
function getFullSummary(expenses: Expense[]): string {
  // Filter for current year (YTD) as requested by user
  const currentYear = new Date().getFullYear();
  const ytdExpenses = expenses.filter(e => {
    try {
      const expYear = new Date(e.date).getFullYear();
      return expYear === currentYear;
    } catch {
      return false;
    }
  });

  return ytdExpenses.map(e => 
    `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount.toLocaleString('id-ID')}`
  ).join('\n');
}

export async function parseExpenseInput(
  input: string, 
  apiKey: string, 
  frugalMode: boolean = false,
  budgets?: Budget[],
  currentExpenses?: Expense[]
): Promise<(Omit<Expense, 'id'> & { frugalWarning?: string })[] | null> {
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentDate = now.toISOString().split('T')[0];

  const ai = getAi(apiKey.trim());
  
  // For the extraction, we don't necessarily NEED the budget context anymore 
  // if we're going to stream warnings separately, but let's keep it for now 
  // to ensure category alignment.
  
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `EXTRACT DATA from: "${input}"
Date: ${currentDate}, Year: ${currentYear}`,
    config: {
      systemInstruction: `Extract expenses. Rules:
1. Amount: Convert slang (30k->30000).
2. Category: 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'.
3. Output: JSON Array.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            date: { type: Type.STRING },
            description: { type: Type.STRING }
          },
          required: ["amount", "category", "date", "description"]
        }
      },
      temperature: 0
    }
  });

  const text = response.text;
  if (!text) return null;
  const parsed = JSON.parse(text);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export async function* streamFrugalWarning(
  expense: Omit<Expense, 'id'>,
  apiKey: string,
  budgets: Budget[],
  currentExpenses: Expense[]
): AsyncGenerator<string, void, unknown> {
  const ai = getAi(apiKey.trim());
  
  const expensesByCategory = currentExpenses.reduce((acc, exp) => {
    const category = exp.category;
    acc[category] = (acc[category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);
  
  const budget = budgets.find(b => b.category === expense.category);
  let context = "";
  if (budget) {
    let spent = expensesByCategory[budget.category] || 0;
    if (budget.category === 'Tagihan & Utilitas') {
      spent = Math.max(spent, budget.amount);
    }
    const available = budget.amount - spent;
    context = `Category: ${budget.category}, Current Budget Limit: Rp ${budget.amount.toLocaleString('id-ID')}, Already Spent: Rp ${spent.toLocaleString('id-ID')}, Available NOW: Rp ${available.toLocaleString('id-ID')}`;
  } else {
    context = `Category: ${expense.category}, No formal budget set. Treat with caution.`;
  }

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-flash-latest",
    contents: `New Expense Attempt: ${expense.description} (Rp ${expense.amount.toLocaleString('id-ID')})
Context: ${context}`,
    config: {
      systemInstruction: `You are a brutally honest, funny, and judgy financial assistant (Indonesian).
Evaluate the new expense against the "Available NOW" balance provided.

Rules:
1. Be witty and slightly "judgy" about the purchase in Indonesian.
2. Calculate exactly: [New Remaining = Available NOW - New Expense Amount].
3. MUST state the final remaining balance clearly at the end (e.g., "Sisa anggaran kamu: Rp 440.000").
4. ALWAYS format all currency with Indonesian dot separators (e.g., Rp 60.000).
5. If the new balance is negative, be extra sassy about them going over budget.`,
      temperature: 0.7
    }
  });

  for await (const chunk of responseStream) {
    if (chunk.text) yield chunk.text;
  }
}

export async function getFinancialInsights(expenses: Expense[], budgets: Budget[], apiKey: string): Promise<string | null> {
  if (!apiKey) throw new Error("API_KEY_MISSING");
  if (expenses.length === 0) return "Belum ada data pengeluaran untuk dianalisis.";

  const ai = getAi(apiKey.trim());
  const summary = getFullSummary(expenses);
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `Analyze:
Budgets:
${budgetSummary}
Expenses:
${summary}
Task: Give 3-4 actionable financial insights in Indonesian. Format: Markdown bullets with double spacing.`,
  });
  return response.text || null;
}

export async function queryFinancialAI(input: string, expenses: Expense[], budgets: Budget[], selectedMonth: string, apiKey: string): Promise<string | null> {
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = getAi(apiKey.trim());
  const now = new Date();
  const currentYear = now.getFullYear();
  const summary = getFullSummary(expenses);
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
  
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `Assistant context: Today ${now.toISOString().split('T')[0]}, Year ${currentYear}, UI Month ${selectedMonth}.
Budgets: ${budgetSummary}
Expenses: ${summary}
User: "${input}"`
  });
  return response.text || null;
}

export async function* getFinancialInsightsStream(expenses: Expense[], budgets: Budget[], apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) throw new Error("API_KEY_MISSING");
  if (expenses.length === 0) {
    yield "Belum ada data pengeluaran untuk dianalisis.";
    return;
  }

  const ai = getAi(apiKey.trim());
  const summary = getFullSummary(expenses);
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-flash-latest",
    contents: `Analyze data and give 3-4 insights in Indonesian. 
Format all currency/money values with Indonesian thousands separators (e.g., Rp 60.000).
Budgets:
${budgetSummary}
Expenses:
${summary}`,
  });

  for await (const chunk of responseStream) {
    if (chunk.text) yield chunk.text;
  }
}

export async function* queryFinancialAIStream(input: string, expenses: Expense[], budgets: Budget[], selectedMonth: string, apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = getAi(apiKey.trim());
  const now = new Date();
  const currentYear = now.getFullYear();
  const summary = getFullSummary(expenses);
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-flash-latest",
    contents: `Assistant for: Today ${now.toISOString().split('T')[0]}, Year ${currentYear}, UI Month ${selectedMonth}.
Format all currency/money values with Indonesian thousands separators (e.g., Rp 60.000).
Budgets: ${budgetSummary}
Expenses: ${summary}
User: "${input}"`,
  });

  for await (const chunk of responseStream) {
    if (chunk.text) yield chunk.text;
  }
}

export async function* getBudgetOptimizationStream(input: string, budgets: Budget[], expenses: Expense[], apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) throw new Error("API_KEY_MISSING");

  const ai = getAi(apiKey.trim());
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount.toLocaleString('id-ID')}`).join('\n');
  const expensesByCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseText = Object.entries(expensesByCategory)
    .map(([cat, amt]) => `- ${cat}: Rp ${amt.toLocaleString('id-ID')}`)
    .join('\n');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-flash-latest",
    contents: `USER GOAL: "${input}"
CURRENT BUDGETS:
${budgetSummary}

ACTUAL SPENDING THIS MONTH:
${expenseText}`,
    config: {
      systemInstruction: `You are a Smart Financial Optimization Assistant (Indonesian).
Your goal is to help users reallocate their budget based on their goals and current spending habits.

Rules:
1. Persona: Professional yet friendly financial advisor. Bahasa Indonesia.
2. Structure: 
   - Start with a clear strategic analysis of why you are proposing these changes.
   - Explain which categories were cut and why (e.g. based on low usage or high waste).
   - Address the user's specific GOAL mentioned in the input.
   - DO NOT just list the new amounts in text format; focus on the reasoning.
   - ALWAYS end with a JSON block in markdown backticks representing the NEW full budget for ALL categories.
3. Format: All currency in text must use Indonesian thousands separators (e.g., Rp 60.000).
4. JSON: The keys MUST exactly match the categories: 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'. 
   Output all 8 categories in the JSON even if unchanged.`,
      temperature: 0.7
    }
  });

  for await (const chunk of responseStream) {
    if (chunk.text) yield chunk.text;
  }
}
