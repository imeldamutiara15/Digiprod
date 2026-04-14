import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Expense, Budget } from "../types";

export async function testApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const ai = new GoogleGenAI({ apiKey });
    // Try primary model first
    try {
      await ai.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: "Hi",
        config: { 
          maxOutputTokens: 1,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });
      return true;
    } catch (e: any) {
      const errStr = String(e).toLowerCase();
      // If model not found or access denied, try fallback
      if (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403')) {
        await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: "Hi",
          config: { maxOutputTokens: 1 }
        });
        return true;
      }
      throw e;
    }
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
  
  // Log the full error for debugging
  console.error("Detailed AI Error:", error);
  
  return null;
}

let cachedAi: GoogleGenAI | null = null;
let cachedKey: string | null = null;
let useFallbackModel = false;

function getAi(apiKey: string) {
  if (cachedAi && cachedKey === apiKey) return cachedAi;
  cachedAi = new GoogleGenAI({ apiKey });
  cachedKey = apiKey;
  return cachedAi;
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
      acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    budgetContext = budgets.map(b => `${b.category}:${b.amount - (expensesByCategory[b.category] || 0)}`).join('|');
  }

  const ai = getAi(apiKey);
  const systemInstruction = `Extract expenses. Date:${currentDate}. Year:${currentYear}.
Rules:
- amount: number (50k/rb->50000, 1jt->1000000).
- category: 'Makanan & Minuman'|'Transportasi'|'Belanja'|'Hiburan'|'Tagihan & Utilitas'|'Kesehatan & Kebugaran'|'Perjalanan'|'Lainnya'.
- date: YYYY-MM-DD.
- description: ID.
- frugalWarning: ${frugalMode ? `If "want", witty warning. Context: ${budgetContext}` : '""'}`;

  const responseSchema = {
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
  };

  try {
    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3.1-flash-lite-preview";
    const config: any = {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0,
    };

    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Input: "${input}"`,
      config
    });

    const text = response.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      console.warn("Primary model failed, switching to fallback gemini-1.5-flash");
      useFallbackModel = true;
      return parseExpenseInput(input, apiKey, frugalMode, budgets, currentExpenses);
    }
    return handleAiError(error) as any;
  }
}

export async function getFinancialInsights(expenses: Expense[], budgets: Budget[], apiKey: string): Promise<string | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  if (expenses.length === 0) return "Belum ada data pengeluaran untuk dianalisis.";

  try {
    const ai = getAi(apiKey);
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const config: any = {};
    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: `Analyze the following financial data for this month and provide 3-4 concise, actionable insights or advice in Indonesian. 
      Focus on spending patterns, potential savings, and budget warnings (comparing actual spending vs budgets).
      
      Budgets (Anggaran):
      ${budgetSummary}
      
      Actual Expenses:
      ${summary}
      
      Format the response as a clean bulleted list in Markdown. Use the "•" symbol for each bullet point.`,
      config
    });

    return response.text || null;
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      useFallbackModel = true;
      return getFinancialInsights(expenses, budgets, apiKey);
    }
    return handleAiError(error) as any;
  }
}

export async function queryFinancialAI(input: string, expenses: Expense[], budgets: Budget[], selectedMonth: string, apiKey: string): Promise<string | null> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = getAi(apiKey);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Format expenses for the AI
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const config: any = {};
    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const response = await ai.models.generateContent({
      model: modelName,
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
      config
    });

    return response.text || null;
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      useFallbackModel = true;
      return queryFinancialAI(input, expenses, budgets, selectedMonth, apiKey);
    }
    return handleAiError(error) as any;
  }
}

export async function* getFinancialInsightsStream(expenses: Expense[], budgets: Budget[], apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  if (expenses.length === 0) {
    yield "Belum ada data pengeluaran untuk dianalisis.";
    return;
  }

  try {
    const ai = getAi(apiKey);
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const config: any = {};
    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: `Analyze the following financial data for this month and provide 3-4 concise, actionable insights or advice in Indonesian. 
      Focus on spending patterns, potential savings, and budget warnings (comparing actual spending vs budgets).
      
      Budgets (Anggaran):
      ${budgetSummary}
      
      Actual Expenses:
      ${summary}
      
      Format the response as a clean bulleted list in Markdown. Use the "•" symbol for each bullet point.`,
      config
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      useFallbackModel = true;
      // Note: Generators are harder to retry inline, so we just throw and let the UI handle it or next call will use fallback
      handleAiError(error);
      throw error;
    }
    handleAiError(error);
    throw error;
  }
}

export async function* queryFinancialAIStream(input: string, expenses: Expense[], budgets: Budget[], selectedMonth: string, apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = getAi(apiKey);
    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Format expenses for the AI
    const summary = expenses.map(e => `- ${e.date}: ${e.description} (${e.category}) Rp ${e.amount}`).join('\n');
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    
    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const config: any = {};
    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
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
      config
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      useFallbackModel = true;
      handleAiError(error);
      throw error;
    }
    handleAiError(error);
    throw error;
  }
}

export async function* getBudgetOptimizationStream(input: string, budgets: any[], expenses: Expense[], apiKey: string): AsyncGenerator<string, void, unknown> {
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  try {
    const ai = getAi(apiKey);
    const budgetSummary = budgets.map(b => `- ${b.category}: Rp ${b.amount}`).join('\n');
    const expenseSummary = expenses.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    
    const expenseText = Object.entries(expenseSummary)
      .map(([cat, amt]) => `- ${cat}: Rp ${amt}`)
      .join('\n');

    const modelName = useFallbackModel ? "gemini-1.5-flash" : "gemini-3-flash-preview";
    const config: any = {};
    if (!useFallbackModel) {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
    }

    const responseStream = await ai.models.generateContentStream({
      model: modelName,
      contents: `User Request: "${input}"
      
      Current Budgets:
      ${budgetSummary}
      
      Actual Spending:
      ${expenseText}
      
      Rules:
      1. Jawab dengan 1-2 kalimat penjelasan singkat dalam bahasa Indonesia di AWAL.
      2. Prioritaskan kebutuhan primer, kurangi sekunder. Bulatkan ke 50.000 terdekat.
      3. Di bagian paling bawah, berikan blok JSON berisi anggaran baru untuk SEMUA kategori.
      
      Contoh:
      Anggaran Hiburan dipotong untuk hemat 500rb.
      \`\`\`json
      {
        "Makanan & Minuman": 1500000,
        "Hiburan": 0
      }
      \`\`\``,
      config
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error: any) {
    const errStr = String(error).toLowerCase();
    if (!useFallbackModel && (errStr.includes('not found') || errStr.includes('404') || errStr.includes('permission') || errStr.includes('403'))) {
      useFallbackModel = true;
      handleAiError(error);
      throw error;
    }
    handleAiError(error);
    throw error;
  }
}
