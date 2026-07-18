import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { chatbotToolDeclarations, executeChatbotTool } from '@/app/utils/chatbot_tools';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { messages, systemInstruction } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    // --- GEMINI ATTEMPT WITH NEW SDK & DYNAMIC TOOLS ---
    try {
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not defined");

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      
      // Convert messages to Google Gen AI multi-turn contents format
      const contents: any[] = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      let loopCount = 0;
      const maxLoops = 5;

      while (loopCount < maxLoops) {
        const result = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: contents,
          config: {
            temperature: 0.15,
            topP: 0.95,
            topK: 64,
            maxOutputTokens: 2048,
            systemInstruction: systemInstruction,
            tools: [{ functionDeclarations: chatbotToolDeclarations }]
          }
        });

        const functionCalls = result.functionCalls;
        if (!functionCalls || functionCalls.length === 0) {
          // No tools to execute, return the final model response
          const assistantResponse = result.text;
          return NextResponse.json({ response: assistantResponse });
        }

        // Store model's function call intent in history
        contents.push({
          role: 'model',
          parts: functionCalls.map(call => ({
            functionCall: {
              name: call.name,
              args: call.args
            }
          }))
        });

        // Execute function calls requested by the model
        const toolResponseParts = [];
        for (const call of functionCalls) {
          if (!call.name) continue;
          console.log(`[Chatbot Skill Execution] Executing tool "${call.name}" with arguments:`, call.args);
          try {
            const toolResult = await executeChatbotTool(call.name, call.args);
            toolResponseParts.push({
              functionResponse: {
                name: call.name,
                response: toolResult
              }
            });
          } catch (toolError: any) {
            console.error(`[Chatbot Skill Error] Failed to execute tool "${call.name}":`, toolError.message || toolError);
            toolResponseParts.push({
              functionResponse: {
                name: call.name,
                response: { error: toolError.message || "Failed to execute tool." }
              }
            });
          }
        }

        // Store function results in history for the next turn
        contents.push({
          role: 'tool',
          parts: toolResponseParts
        });

        loopCount++;
      }

      throw new Error("Chatbot exceeded maximum tool calling loops without a final response.");

    } catch (geminiError: any) {
      console.error('Gemini call failed, attempting OpenRouterFallback:', geminiError.message || geminiError);

      // --- OPENROUTER FALLBACK ---
      const openRouterApiKey = process.env.OPENROUTER_API_KEY;
      if (!openRouterApiKey) {
          throw new Error(`Primary Gemini failed and no OPENROUTER_API_KEY is available. Reason: ${geminiError.message}`);
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
          model: "google/gemini-3.5-flash", 
          messages: openRouterMessages,
          temperature: 0.15,
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
