import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages, systemInstruction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    // --- GEMINI ATTEMPT WITH NEW SDK ---
    try {
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not defined");

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const historyForPrompt = messages.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: historyForPrompt,
        config: {
          temperature: 0.1,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 2048,
          systemInstruction: systemInstruction,
        }
      });

      const assistantResponse = result.text;
      return NextResponse.json({ response: assistantResponse });

    } catch (geminiError: any) {
      console.error('Gemini call failed, attempting OpenRouterFallback:', geminiError.message || geminiError);

      // --- OPENROUTER FALLBACK ---
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
          throw new Error("No OPENROUTER_API_KEY is available for fallback.");
      }

      const openRouterMessages = [
        { role: 'system', content: systemInstruction },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash", 
          messages: openRouterMessages,
          temperature: 0.1,
          top_p: 0.95
        })
      });

      if (!response.ok) {
         throw new Error(`OpenRouter Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      const assistantResponse = data.choices && data.choices[0]?.message?.content;
      
      return NextResponse.json({ response: assistantResponse });
    }

  } catch (error: any) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error processing chat message' },
      { status: 500 }
    );
  }
}
