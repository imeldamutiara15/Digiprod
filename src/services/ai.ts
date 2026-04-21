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
    `- ${e.date}: ${e.description} (${e.category}) Rp${e.amount}`
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

  let budgetContext = "";
  if (frugalMode && budgets && currentExpenses) {
    const expensesByCategory = currentExpenses.reduce((acc, exp) => {
      const category = exp.category;
      acc[category] = (acc[category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    budgetContext = budgets.map(b => {
      const spent = expensesByCategory[b.category] || 0;
      const remaining = b.amount - spent;
      return `${b.category}: Rp${remaining.toLocaleString('id-ID')}/${b.amount.toLocaleString('id-ID')}`;
    }).join(', ');
  }

  const ai = getAi(apiKey.trim());
  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `Input: "${input}"`,
    config: {
      systemInstruction: `Extract expenses. Date: ${currentDate}. Year: ${currentYear}.
Rules:
1. Amount: Convert slang (30k->30000, 1jt->1000000).
2. Category: 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'.
3. Frugal Warning: ${frugalMode ? `Evaluate based on budgets: [${budgetContext}]. If unnecessary/over budget, provide a witty witty short judgy warning in Indonesian.` : '""'}`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
            date: { type: Type.STRING },
            description: { type: Type.STRING },
            frugalWarning: { type: Type.STRING }
          },
          required: ["amount", "category", "date", "description", "frugalWarning"]
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
  const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
  const expensesByCategory = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseText = Object.entries(expensesByCategory)
    .map(([cat, amt]) => `- ${cat}: Rp ${amt}`)
    .join('\n');

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-flash-latest",
    contents: `Optimize user budget: "${input}"
Current Budgets:
${budgetSummary}
Actual Spending:
${expenseText}
Rules: Explain moves briefly in Indonesian. Return new JSON block at the bottom.`,
  });

  for await (const chunk of responseStream) {
    if (chunk.text) yield chunk.text;
  }
}
