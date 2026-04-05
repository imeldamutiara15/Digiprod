import { GoogleGenAI, Type } from "@google/genai";
import { Expense, Budget } from "../types";

export async function testApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const ai = new GoogleGenAI({ apiKey });
    await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Hi",
      config: { maxOutputTokens: 1 }
    });
    return true;
  } catch (error: any) {
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
      throw new Error("QUOTA_EXCEEDED");
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
    throw new Error("QUOTA_EXCEEDED");
  }
  console.error("AI Error:", error);
  return null;
}

export async function parseExpenseInput(
  input: string, 
  apiKey: string, 
  frugalMode: boolean = false,
  budgets?: Budget[],
  currentExpenses?: Expense[]
): Promise<(Omit<Expense, 'id'> & { frugalWarning?: string })[] | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  let budgetContext = "";
  if (frugalMode && budgets && currentExpenses) {
    const expensesByCategory = currentExpenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
    const totalSpent = currentExpenses.reduce((sum, e) => sum + e.amount, 0);
    
    budgetContext = `
    STATUS ANGGARAN SAAT INI:
    - Total Anggaran: Rp ${totalBudget.toLocaleString('id-ID')}
    - Total Pengeluaran: Rp ${totalSpent.toLocaleString('id-ID')}
    - Sisa Keseluruhan: Rp ${(totalBudget - totalSpent).toLocaleString('id-ID')}
    
    Rincian per Kategori:
    ${budgets.map(b => {
      const spent = expensesByCategory[b.category] || 0;
      const remaining = b.amount - spent;
      return `- ${b.category}: Anggaran Rp ${b.amount.toLocaleString('id-ID')}, Terpakai Rp ${spent.toLocaleString('id-ID')}, Sisa Rp ${remaining.toLocaleString('id-ID')}`;
    }).join('\n')}
    `;
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following expense input into a structured format. The input may contain one or multiple expenses (e.g., separated by commas or "and").
      Input: "${input}"
      
      Current Date: ${now.toISOString()}
      Current Year: ${currentYear}
      
      For each expense, extract:
      1. amount: raw number (e.g., 50000 for Rp 50.000 or 50k)
      2. category: one of the valid categories below
      3. date: ISO format (YYYY-MM-DD). Look for date indicators in the input like "tadi", "kemarin", or specific dates like "2 februari" or "10/03". 
         CRITICAL: If a day/month is mentioned without a year (e.g., "3 maret"), you MUST use the current year: ${currentYear}.
         If no date is mentioned at all, use the current date: ${now.toISOString().split('T')[0]}.
      4. description: short description in Indonesian
      
      Valid categories are: 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'.
      
      ${frugalMode ? `CRITICAL FOR FRUGAL MODE: Evaluate if the expense is a "want" (tersier/sekunder) rather than a strict "need" (primer). Examples of "wants": expensive coffee (Starbucks, cafe), games, impulsive shopping, movies. Examples of "needs": groceries, rent, basic transport, electricity.
      If it is a "want" or seems expensive for its category, generate a witty, slightly sarcastic but friendly warning in Indonesian comparing the price to something practical. 
      ${budgetContext ? `You MUST also consider the user's current budget status provided below. If the expense exceeds or dangerously depletes the remaining budget for its category or the overall budget, mention it in the warning!
      ${budgetContext}` : ''}
      Example: "Itu setara dengan 4 porsi makan siang di warteg favoritmu. Sisa anggaran Makananmu tinggal Rp 20.000 lho, yakin?" or "Yakin? Uang segini bisa buat beli beras 5kg lho."
      Put this warning in the 'frugalWarning' field. If it's a basic need and doesn't severely impact the budget, leave 'frugalWarning' empty.` : ''}
      
      Return an array of expense objects.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: {
                type: Type.NUMBER,
                description: "The expense amount",
              },
              category: {
                type: Type.STRING,
                description: "The category of the expense",
                enum: [
                  'Makanan & Minuman',
                  'Transportasi',
                  'Belanja',
                  'Hiburan',
                  'Tagihan & Utilitas',
                  'Kesehatan & Kebugaran',
                  'Perjalanan',
                  'Lainnya'
                ]
              },
              date: {
                type: Type.STRING,
                description: "The date of the expense in ISO format (YYYY-MM-DD)",
              },
              description: {
                type: Type.STRING,
                description: "A short description of the expense",
              },
              frugalWarning: {
                type: Type.STRING,
                description: "Witty warning if the expense is a want and frugal mode is enabled. Empty if not applicable.",
              }
            },
            required: ["amount", "category", "date", "description"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    return handleAiError(error) as any;
  }
}

export async function getFinancialInsights(expenses: Expense[], budgets: Budget[], apiKey: string): Promise<string | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  if (expenses.length === 0) return "Belum ada data pengeluaran untuk dianalisis.";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following financial data for this month and provide 3-4 concise, actionable insights or advice in Indonesian. 
      Focus on spending patterns, potential savings, and budget warnings (comparing actual spending vs budgets).
      
      Budgets (Anggaran):
      ${budgetSummary}
      
      Actual Expenses:
      ${summary}
      
      Format the response as a clean bulleted list in Markdown. Use the "•" symbol for each bullet point.`,
    });

    return response.text || null;
  } catch (error) {
    return handleAiError(error) as any;
  }
}

export async function queryFinancialAI(input: string, expenses: Expense[], budgets: Budget[], selectedMonth: string, apiKey: string): Promise<string | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Format expenses for the AI
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a financial assistant. Use the following expense and budget data to answer the user's question.
      
      Context:
      - Current Date: ${now.toISOString().split('T')[0]}
      - Selected Month in UI: ${selectedMonth}
      - Current Year: ${currentYear}
      
      Instructions:
      1. If the user asks about "tahun ini" (this year), "setahun", or any yearly range, analyze ALL provided expenses for the year ${currentYear}.
      2. If the user does NOT specify a time range (like "tahun ini", "bulan lalu", etc.), DEFAULT your analysis to the "Selected Month in UI": ${selectedMonth}.
      3. Compare actual spending against budgets (anggaran) when relevant to provide better context.
      4. Provide a helpful, concise response in Indonesian. Use Markdown for formatting.
      
      Budgets (Anggaran) for ${selectedMonth}:
      ${budgetSummary}
      
      Expenses:
      ${summary}
      
      User Question: "${input}"`,
    });

    return response.text || null;
  } catch (error) {
    return handleAiError(error) as any;
  }
}

export async function getBudgetOptimizationWithInput(input: string, budgets: any[], expenses: Expense[], apiKey: string): Promise<Record<string, number> | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    const expenseSummary = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const expenseText = Object.entries(expenseSummary)
      .map(([cat, amt]) => `- ${cat}: Rp ${amt}`)
      .join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a financial optimization expert. The user has a specific request for their budget.
      
      User Request: "${input}"
      
      Current Budgets:
      ${budgetSummary}
      
      Actual Spending so far:
      ${expenseText}
      
      Rules for optimization:
      1. PRIORITIZE PRIMARY NEEDS: Categories like 'Makanan & Minuman', 'Transportasi', 'Tagihan & Utilitas', and 'Kesehatan & Kebugaran' are essential.
      2. REDUCE SECONDARY NEEDS: Cut from 'Hiburan', 'Belanja', 'Perjalanan', and 'Lainnya' if needed to meet the user's total budget target.
      3. If the user specifies a total budget (e.g., "2 juta"), ensure the SUM of all recommended category budgets matches that total.
      4. Round values to the nearest 50.000.
      
      Return ONLY a JSON object where keys are category names and values are the NEW recommended budget amounts.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: budgets.reduce((acc, b) => {
            acc[b.category] = { type: Type.NUMBER };
            return acc;
          }, {} as any),
          required: budgets.map(b => b.category)
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    return handleAiError(error) as any;
  }
}
