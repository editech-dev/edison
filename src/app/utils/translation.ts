import { GoogleGenAI } from '@google/genai';
import { resolveGeminiApiKey } from './runtime-env';

const geminiApiKey = resolveGeminiApiKey();

let ai: GoogleGenAI | null = null;
if (geminiApiKey) {
  // The `-latest` model aliases are served by v1beta; SDK 3 defaults to v1.
  ai = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { apiVersion: 'v1beta' } });
} else {
  console.warn("GEMINI_API_KEY is not defined in translation utility");
}

// Helper to pause execution (useful for rate limits)
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wrapper to call Gemini API with exponential backoff retries (maximum 3 retries)
async function callGeminiWithRetry(prompt: string, maxTokens?: number, requireComplete = false): Promise<string> {
  if (!ai) throw new Error("GoogleGenAI client is not initialized");
  
  let attempt = 0;
  let delayTime = 2000; // Start with a 2-second delay

  while (attempt < 4) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: prompt,
        config: {
          temperature: 0.15,
          maxOutputTokens: maxTokens,
        }
      });
      const finishReason = response.candidates?.[0]?.finishReason;
      if (requireComplete && finishReason && finishReason !== 'STOP') {
        // Truncated (MAX_TOKENS) or blocked output must never be stored as a translation.
        throw new Error(`Gemini returned an incomplete response (finishReason: ${finishReason})`);
      }
      if (response.text) return response.text;
      throw new Error("Empty response received from Gemini");
    } catch (error: any) {
      attempt++;
      // Check for rate limit indicators (e.g. 429 status)
      const isRateLimit = error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota exceeded') || error.message?.includes('Resource has been exhausted');
      
      if (isRateLimit && attempt < 4) {
        console.warn(`[Gemini API Rate Limit] Attempt ${attempt} failed. Retrying in ${delayTime}ms...`);
        await delay(delayTime);
        delayTime *= 2.5; // Exponential backoff factor
      } else {
        throw error; // Re-throw other errors or final retry failure
      }
    }
  }
  throw new Error("Gemini API call failed after multiple retries");
}

/**
 * Detects whether the given text is primarily in Spanish ('es') or English ('en').
 * Throws when Gemini is unavailable, so callers never persist a guessed language.
 */
export async function detectLanguage(text: string): Promise<'es' | 'en'> {
  const prompt = `Analyze the following text and determine if it is in Spanish or English. Response must be ONLY 'es' or 'en' (no markdown, no punctuation, no extra text):\n\n${text.substring(0, 1000)}`;
  const result = await callGeminiWithRetry(prompt, 5);
  const lang = result.trim().toLowerCase();
  return lang === 'es' ? 'es' : 'en';
}

/**
 * Translates the given text to the target language ('es' or 'en').
 * Preserves all formatting, markdown syntax, code blocks, HTML tags, and technical terms.
 * Throws when Gemini is unavailable, so callers never persist an untranslated copy as a translation.
 */
export async function translateText(text: string, targetLang: 'es' | 'en'): Promise<string> {
  if (!text || text.trim() === '') return text;
  const sourceLangLabel = targetLang === 'es' ? 'English' : 'Spanish';
  const targetLangLabel = targetLang === 'es' ? 'Spanish' : 'English';
  const prompt = `You are an expert technical translator. Translate the following text from ${sourceLangLabel} to ${targetLangLabel}.
Maintain all technical terms, names, code blocks, HTML tags, markdown structure/formatting, and emojis exactly as they are.
Respond ONLY with the translated text. Do not add any introduction, explanations, or notes:\n\n${text}`;
  return callGeminiWithRetry(prompt, undefined, true);
}
