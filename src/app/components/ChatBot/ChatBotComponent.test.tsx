import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBotComponent from './ChatBootComponent';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

    const send = async (text: string) => {
      fireEvent.click(screen.getByLabelText('Open chat assistant'));
      const input = await screen.findByPlaceholderText('Type your message...');
      // Wait until the system prompt is loaded, otherwise the widget answers "Initializing system...".
      await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/agent-context'));
      await new Promise((r) => setTimeout(r, 0));
      fireEvent.change(input, { target: { value: text } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    };

    it('shows a readable message instead of an empty bubble when the server is unavailable', async () => {
      chatResponses.push(() => Response.json({ error: CHAT_UNAVAILABLE_MESSAGE }, { status: 503 }));
      vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<ChatBotComponent />);
      await send('Hola');

      expect(await screen.findByText(`Error: ${CHAT_UNAVAILABLE_MESSAGE}`)).toBeInTheDocument();
    });
  });
});
