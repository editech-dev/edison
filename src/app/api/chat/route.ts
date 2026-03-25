import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages, systemInstruction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Formato de mensajes inválido' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    // --- GEMINI ATTEMPT ---
    try {
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY no encontrada");

      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const geminiModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

      const historyForPrompt = messages.map(msg =>
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n');

      const result = await geminiModel.generateContent({
        contents: [{ role: "user", parts: [{ text: historyForPrompt }] }],
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 2048,
        },
        systemInstruction: systemInstruction
      });

      const assistantResponse = result.response.text();
      return NextResponse.json({ response: assistantResponse });

    } catch (geminiError: any) {
      console.error('Gemini Falló, intentando OpenRouterFallback:', geminiError.message || geminiError);

      // --- OPENROUTER FALLBACK ---
      const openRouterApiKey = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
          throw new Error("No hay OPENROUTER_API_KEY disponible para el fallback.");
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
         throw new Error(`Error en OpenRouter: ${response.statusText}`);
      }
      
      const data = await response.json();
      const assistantResponse = data.choices && data.choices[0]?.message?.content;
      
      return NextResponse.json({ response: assistantResponse });
    }

  } catch (error: any) {
    console.error('Error procesando chat:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno procesando mensaje de chat' },
      { status: 500 }
    );
  }
}
