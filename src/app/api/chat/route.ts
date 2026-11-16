import { NextResponse } from 'next/server';
import { GoogleGenAI, type Content, type FunctionCall, type Part } from '@google/genai';
import { chatbotToolDeclarations, executeChatbotTool } from '@/app/utils/chatbot_tools';
import { CHAT_UNAVAILABLE_MESSAGE, STREAM_ERROR_NOTICE } from '@/app/utils/chat-messages';
import { resolveGeminiApiKey } from '@/app/utils/runtime-env';

export const dynamic = 'force-dynamic';

// Always the up-to-date Lite alias (same model as the repository translations).
const GEMINI_MODEL = 'gemini-flash-lite-latest';
const MAX_TOOL_LOOPS = 5;
// One retry, after a short pause, for transient errors that happen before the answer starts.
const RETRY_DELAY_MS = 1500;

interface ChatMessage {
  role: string;
  content: string;
}

const STREAM_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

// --- Gemini: yields text chunks; runs tool calls in between turns ---
async function* geminiAnswer(ai: GoogleGenAI, messages: ChatMessage[], systemInstruction: string): AsyncGenerator<string> {
  const contents: Content[] = messages.map((msg) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }],
  }));

  for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        temperature: 0.15,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 2048,
        systemInstruction,
        tools: [{ functionDeclarations: chatbotToolDeclarations }],
      },
    });

    // Keep the model's own parts (including thought signatures, required by Gemini 3 models)
    // so the turn can be sent back unchanged together with the tool results.
    const modelParts: Part[] = [];
    const functionCalls: FunctionCall[] = [];
    for await (const chunk of stream) {
      modelParts.push(...(chunk.candidates?.[0]?.content?.parts ?? []));
      if (chunk.functionCalls?.length) {
        functionCalls.push(...chunk.functionCalls);
        continue;
      }
      if (chunk.text) yield chunk.text;
    }

    if (functionCalls.length === 0) return;

    contents.push({ role: 'model', parts: modelParts });

    const toolResponseParts: Part[] = [];
    for (const call of functionCalls) {
      if (!call.name) continue;
      console.log(`[Chatbot Skill Execution] Executing tool "${call.name}" with arguments:`, call.args);
      let response: Record<string, unknown>;
      try {
        response = (await executeChatbotTool(call.name, call.args)) as Record<string, unknown>;
      } catch (toolError) {
        console.error(`[Chatbot Skill Error] Failed to execute tool "${call.name}":`, errorMessage(toolError));
        response = { error: errorMessage(toolError) || 'Failed to execute tool.' };
      }
      toolResponseParts.push({ functionResponse: { id: call.id, name: call.name, response } });
    }

    // Gemini only accepts the roles `user` and `model`: tool results are sent as a `user` turn.
    contents.push({ role: 'user', parts: toolResponseParts });
  }

  throw new Error('Chatbot exceeded maximum tool calling loops without a final response.');
}

// Waits for the first text chunk before answering, so a failure before the answer begins becomes a
// clean retry or a readable error instead of a broken stream.
async function startAnswer(source: () => AsyncGenerator<string>) {
  const iterator = source();
  const first = await iterator.next();
  if (first.done || !first.value) throw new Error('The model returned an empty answer.');
  return { first: first.value, iterator };
}

const isTransient = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  const message = errorMessage(error);
  return status === 503 || status === 429 || /\b(503|429)\b|UNAVAILABLE|RESOURCE_EXHAUSTED/.test(message);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const toStream = ({ first, iterator }: { first: string; iterator: AsyncGenerator<string> }) => {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(first));
      try {
        for await (const text of iterator) controller.enqueue(encoder.encode(text));
      } catch (error) {
        console.error('Chat stream failed after it started:', errorMessage(error));
        controller.enqueue(encoder.encode(STREAM_ERROR_NOTICE));
      }
      controller.close();
    },
  });
};

export async function POST(req: Request) {
  let body: { messages?: unknown; systemInstruction?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { messages, systemInstruction } = body;
  if (!Array.isArray(messages)) {
    return NextResponse.json({ error: 'Invalid messages format' }, { status: 400 });
  }
  const chatMessages = messages as ChatMessage[];
  const instruction = typeof systemInstruction === 'string' ? systemInstruction : '';

  const geminiApiKey = resolveGeminiApiKey();
  if (!geminiApiKey) {
    console.error('GEMINI_API_KEY is not defined');
    return NextResponse.json({ error: CHAT_UNAVAILABLE_MESSAGE }, { status: 503 });
  }
  // The `-latest` model aliases are served by v1beta; SDK 3 defaults to v1.
  const ai = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { apiVersion: 'v1beta' } });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const answer = await startAnswer(() => geminiAnswer(ai, chatMessages, instruction));
      return new Response(toStream(answer), { headers: STREAM_HEADERS });
    } catch (error) {
      console.error(`Gemini call failed (attempt ${attempt}):`, errorMessage(error));
      if (attempt === 2 || !isTransient(error)) break;
      await delay(RETRY_DELAY_MS);
    }
  }
  return NextResponse.json({ error: CHAT_UNAVAILABLE_MESSAGE }, { status: 503 });
}
