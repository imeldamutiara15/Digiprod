import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { Expense, Budget } from "../types";

export async function testApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) return false;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: "Hi",
      config: { 
        maxOutputTokens: 10,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      }
    });
    return !!response.text;
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

let cachedAi: GoogleGenAI | null = null;
let cachedKey: string | null = null;

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

  try {
    const ai = getAi(apiKey);
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: `Input: "${input}"`,
      config: {
        systemInstruction: `Extract expenses from user input. 
Current Date: ${currentDate}. Current Year: ${currentYear}.

Rules:
1. **Amount**: Convert Indonesian currency slang to numbers. 
   Examples: "30k", "30rb", "30 rb", "30 ribu" -> 30000; "1jt", "1 juta" -> 1000000; "500" (if context is IDR) -> 500.
2. **Category**: Assign to the most relevant category: 'Makanan & Minuman', 'Transportasi', 'Belanja', 'Hiburan', 'Tagihan & Utilitas', 'Kesehatan & Kebugaran', 'Perjalanan', 'Lainnya'. If unsure, use 'Lainnya'.
3. **Date**: Use YYYY-MM-DD. Today is ${currentDate}. Default to today if no date mentioned.
4. **Description**: Capitalize the first letter. Keep it concise.
5. **Frugal Warning**: ${frugalMode ? `If the expense is a non-essential "want", provide a short witty warning in Indonesian. Context: ${budgetContext}` : '""'}`,
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
        temperature: 0,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
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
    const ai = getAi(apiKey);
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
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
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
    const ai = getAi(apiKey);
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
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    return response.text || null;
  } catch (error) {
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
    
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following financial data for this month and provide 3-4 concise, actionable insights or advice in Indonesian. 
      Focus on spending patterns, potential savings, and budget warnings (comparing actual spending vs budgets).
      
      Budgets (Anggaran):
      ${budgetSummary}
      
      Actual Expenses:
      ${summary}
      
      Format the response as a clean bulleted list in Markdown. Use the "•" symbol for each bullet point.`,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
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
    
    const responseStream = await ai.models.generateContentStream({
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
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
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

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
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
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW }
      }
    });

    for await (const chunk of responseStream) {
      if (chunk.text) {
        yield chunk.text;
      }
    }
  } catch (error) {
    handleAiError(error);
    throw error;
  }
}
