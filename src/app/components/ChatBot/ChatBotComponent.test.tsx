import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBotComponent from './ChatBootComponent';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CHAT_UNAVAILABLE_MESSAGE } from '@/app/utils/chat-messages';

describe('ChatBotComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url === '/api/agent-context') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ systemInstruction: 'Test instructions' }),
        });
      }
      return Promise.reject(new Error('Unknown url'));
    }));
  });

  it('renders chat toggle button initially', () => {
    render(<ChatBotComponent />);
    const toggleButton = screen.getByLabelText('Open chat assistant');
    expect(toggleButton).toBeInTheDocument();
  });

  it('opens chat window when toggle button is clicked', async () => {
    render(<ChatBotComponent />);
    const toggleButton = screen.getByLabelText('Open chat assistant');
    fireEvent.click(toggleButton);

    await waitFor(() => {
      const chatContainer = screen.getByRole('dialog', { name: 'Chat assistant' });
      expect(chatContainer).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
    });
  });

  describe('sending messages', () => {
    const chatResponses: Array<() => Response> = [];

    beforeEach(() => {
      chatResponses.length = 0;
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
        if (url === '/api/agent-context') {
          return Promise.resolve({ ok: true, json: async () => ({ systemInstruction: 'Test instructions' }) });
        }
        if (url === '/api/chat') return Promise.resolve(chatResponses.shift()!());
        if (url === '/api/log-chat') return Promise.resolve(new Response('{}'));
        return Promise.reject(new Error('Unknown url'));
      }));
    });

    afterEach(() => {
      delete (window as unknown as { ai?: unknown }).ai;
    });

    const send = async (text: string, open = true) => {
      if (open) fireEvent.click(screen.getByLabelText('Open chat assistant'));
      const input = await screen.findByPlaceholderText('Type your message...');
      // Wait until the system prompt is loaded, otherwise the widget answers "Initializing system...".
      await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/agent-context'));
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(input, { target: { value: text } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    };

    it('answers with the cloud model when Gemini Nano fails while answering', async () => {
      // The session is created fine (so the widget stays in Local mode) but prompting fails.
      const promptStreaming = vi.fn(() => (async function* () {
        throw new Error('Nano could not answer');
      })());
      const create = vi.fn().mockResolvedValue({ promptStreaming, destroy: vi.fn() });
      (window as unknown as { ai: unknown }).ai = {
        languageModel: { capabilities: async () => ({ available: 'readily' }), create },
      };
      chatResponses.push(() => new Response('Edison es desarrollador.'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ChatBotComponent />);
      fireEvent.click(screen.getByLabelText('Open chat assistant'));
      const localRadio = await screen.findByRole('radio', { name: /local ai/i });
      fireEvent.click(localRadio);
      await waitFor(() => expect(localRadio).toHaveAttribute('aria-checked', 'true'));
      await send('Hola', false);

      expect(await screen.findByText('Edison es desarrollador.')).toBeInTheDocument();
      expect(promptStreaming).toHaveBeenCalled();
      expect(screen.queryByText(/Local AI mode is not supported/)).not.toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith('/api/chat', expect.anything());
    });

    it('shows a readable message instead of an empty bubble when the server is unavailable', async () => {
      chatResponses.push(() => Response.json({ error: CHAT_UNAVAILABLE_MESSAGE }, { status: 503 }));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ChatBotComponent />);
      await send('Hola');

      expect(await screen.findByText(`Error: ${CHAT_UNAVAILABLE_MESSAGE}`)).toBeInTheDocument();
    });
  });
});
