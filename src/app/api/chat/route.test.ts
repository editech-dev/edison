// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { STREAM_ERROR_NOTICE, CHAT_UNAVAILABLE_MESSAGE } from '@/app/utils/chat-messages';

// Each generateContentStream() call consumes the next scripted turn.
type Turn = Array<Record<string, unknown>> | Error | { failAfter: Array<Record<string, unknown>>; error: Error };
const turns: Turn[] = [];
const generateContentStream = vi.fn(async (request: { contents: unknown; model: string }) => {
  // Snapshot what was sent, since the route keeps mutating the same array.
  requests.push(structuredClone(request.contents));
  models.push(request.model);
  const turn = turns.shift();
  if (!turn) throw new Error('no scripted turn');
  if (turn instanceof Error) throw turn;
  return (async function* () {
    if (Array.isArray(turn)) {
      for (const chunk of turn) yield chunk;
      return;
    }
    for (const chunk of turn.failAfter) yield chunk;
    throw turn.error;
  })();
});
const requests: unknown[] = [];
const models: string[] = [];

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContentStream };
  },
}));

vi.mock('@/app/utils/chatbot_tools', () => ({
  chatbotToolDeclarations: [],
  executeChatbotTool: vi.fn(async () => ({ repository: 'vortex-one', views: 7 })),
}));

const text = (t: string) => ({ text: t, candidates: [{ content: { role: 'model', parts: [{ text: t }] } }] });
const toolCall = {
  functionCalls: [{ id: 'call-1', name: 'getProjectViews', args: { repoName: 'vortex-one' } }],
  candidates: [
    {
      content: {
        role: 'model',
        parts: [{ functionCall: { id: 'call-1', name: 'getProjectViews', args: { repoName: 'vortex-one' } }, thoughtSignature: 'sig' }],
      },
    },
  ],
};

const ask = async (content = 'Hola') => {
  const { POST } = await import('./route');
  const response = await POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content }], systemInstruction: 'Habla de Edison en tercera persona.' }),
    })
  );
  return { response, body: await response.text() };
};

describe('POST /api/chat', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    turns.length = 0;
    requests.length = 0;
    models.length = 0;
    process.env.GEMINI_API_KEY = 'gemini-test';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs a tool and sends its result back as a `user` turn (never `tool`), keeping the model parts', async () => {
    turns.push([toolCall], [text('Edison tiene '), text('7 vistas en vortex-one.')]);

    const { response, body } = await ask('¿Cuántas vistas tiene vortex-one?');

    expect(response.status).toBe(200);
    expect(body).toBe('Edison tiene 7 vistas en vortex-one.');
    const second = requests[1] as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(second.map((c) => c.role)).toEqual(['user', 'model', 'user']);
    expect(second[1].parts[0]).toMatchObject({ thoughtSignature: 'sig' });
    expect(second[2].parts[0]).toMatchObject({
      functionResponse: { id: 'call-1', name: 'getProjectViews', response: { views: 7 } },
    });
    expect(models.every((m) => m === 'gemini-flash-lite-latest')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries once on a transient error (503) before the answer starts', async () => {
    turns.push(Object.assign(new Error('UNAVAILABLE'), { status: 503 }), [text('Edison responde.')]);

    const { response, body } = await ask();

    expect(response.status).toBe(200);
    expect(body).toBe('Edison responde.');
    expect(generateContentStream).toHaveBeenCalledTimes(2);
  });

  it('answers 503 with a readable message when the retry also fails, never an empty stream', async () => {
    turns.push(Object.assign(new Error('UNAVAILABLE'), { status: 503 }), Object.assign(new Error('UNAVAILABLE'), { status: 503 }));

    const { response, body } = await ask();

    expect(response.status).toBe(503);
    expect(JSON.parse(body)).toEqual({ error: CHAT_UNAVAILABLE_MESSAGE });
  });

  it('does not retry non-transient errors (e.g. an invalid key)', async () => {
    turns.push(Object.assign(new Error('API key not valid'), { status: 400 }));

    const { response } = await ask();

    expect(response.status).toBe(503);
    expect(generateContentStream).toHaveBeenCalledTimes(1);
  });

  it('treats an empty answer as a failure instead of an empty bubble', async () => {
    turns.push([], []);

    const { response } = await ask();
    expect(response.status).toBe(503);
  });

  it('never calls any other provider (no OpenRouter)', async () => {
    turns.push(new Error('boom'));
    await ask();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ends a partial answer with a visible notice instead of an empty or cut bubble', async () => {
    turns.push({ failAfter: [text('Edison trabaja con ')], error: new Error('stream broke') });

    const { response, body } = await ask();

    expect(response.status).toBe(200);
    expect(body).toBe(`Edison trabaja con ${STREAM_ERROR_NOTICE}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed body', async () => {
    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost/api/chat', { method: 'POST', body: '{"messages": "x"}' }));
    expect(response.status).toBe(400);
  });
});
