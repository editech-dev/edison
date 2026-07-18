import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatBotComponent from './ChatBootComponent';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
});
