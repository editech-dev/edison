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

    // --- GEMINI ATTEMPT WITH NEW SDK & DYNAMIC TOOLS (STREAMING) ---
    try {
      if (!geminiApiKey) throw new Error("GEMINI_API_KEY is not defined");

      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      
      // Convert messages to Google Gen AI multi-turn contents format
      const contents: any[] = messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let loopCount = 0;
          const maxLoops = 5;

          try {
            while (loopCount < maxLoops) {
              const resultStream = await ai.models.generateContentStream({
                model: 'gemini-flash-latest',
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

              let isFunctionCall = false;
              let functionCalls: any[] = [];

              for await (const chunk of resultStream) {
                if (chunk.functionCalls && chunk.functionCalls.length > 0) {
                  isFunctionCall = true;
                  functionCalls = chunk.functionCalls;
                  break; // Stop streaming, process function calls
                }
                const text = chunk.text;
                if (text) {
                  controller.enqueue(encoder.encode(text));
                }
              }

              if (isFunctionCall) {
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
              } else {
                // Done generating final response
                controller.close();
                return;
              }
            }

            throw new Error("Chatbot exceeded maximum tool calling loops without a final response.");
          } catch (err) {
            controller.error(err);
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        }
      });

    } catch (geminiError: any) {
      console.error('Gemini call failed, attempting OpenRouterFallback:', geminiError.message || geminiError);

      // --- OPENROUTER FALLBACK (STREAMING) ---
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
          model: "google/gemini-flash-latest", 
          messages: openRouterMessages,
          temperature: 0.15,
          top_p: 0.95,
          stream: true
        })
      });

      if (!response.ok) {
         throw new Error(`OpenRouter Error: ${response.statusText}`);
      }
      
      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const decoder = new TextDecoder();
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          let buffer = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';

              for (const line of lines) {
                const cleanLine = line.trim();
                if (cleanLine === '') continue;
                if (cleanLine.startsWith('data: ')) {
                  const dataStr = cleanLine.substring(6);
                  if (dataStr === '[DONE]') {
                    break;
                  }
                  try {
                    const parsed = JSON.parse(dataStr);
                    const content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      controller.enqueue(encoder.encode(content));
                    }
                  } catch (e) {
                    // Ignore JSON parse errors for incomplete chunks
                  }
                }
              }
            }
          } catch (err) {
            controller.error(err);
          } finally {
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        }
      });
    }

  } catch (error: any) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { error: error.message || 'Internal error processing chat message' },
      { status: 500 }
    );
  }
}
