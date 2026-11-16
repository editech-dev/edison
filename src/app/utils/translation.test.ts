// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const load = async () => {
  vi.resetModules();
  process.env.GEMINI_API_KEY = 'test-key';
  return import('./translation');
};

describe('translateText', () => {
  beforeEach(() => {
    generateContent.mockReset();
  });

  it('returns a complete translation', async () => {
    generateContent.mockResolvedValue({ text: 'Hola mundo', candidates: [{ finishReason: 'STOP' }] });
    const { translateText } = await load();

    expect(await translateText('Hello world', 'es')).toBe('Hola mundo');
  });

  it('rejects a truncated translation instead of returning it as complete', async () => {
    generateContent.mockResolvedValue({ text: 'Hola mun', candidates: [{ finishReason: 'MAX_TOKENS' }] });
    const { translateText } = await load();

    await expect(translateText('Hello world, a long README...', 'es')).rejects.toThrow('incomplete');
  });

  it('propagates Gemini errors so callers keep the previous version', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('UNAVAILABLE'), { status: 503 }));
    const { translateText } = await load();

    await expect(translateText('Hello', 'es')).rejects.toThrow('UNAVAILABLE');
  });
});
