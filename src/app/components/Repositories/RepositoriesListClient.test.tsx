import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RepositoriesListClient from './RepositoriesListClient';
import type { BilingualRepository } from '@/app/utils/github';

const repo: BilingualRepository = {
  id: 1,
  name: 'alpha',
  html_url: 'https://github.com/owner/alpha',
  description: 'English description',
  language: 'TypeScript',
  stargazers_count: 0,
  updated_at: '2026-11-01T00:00:00Z',
  originalLanguage: 'en',
  en: { description: 'English description', readme: null },
  es: { description: 'Descripción en español', readme: null },
};

describe('RepositoriesListClient language toggle', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ views: 0 })));
    localStorage.clear();
  });

  it('switches between Spanish and English without calling any translation service', async () => {
    render(<RepositoriesListClient repos={[repo]} viewsData={{ alpha: 0 }} />);

    fireEvent.click(screen.getByRole('button', { name: /^ES$/ }));
    expect(await screen.findByText('Descripción en español')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^EN$/ }));
    expect(await screen.findByText('English description')).toBeInTheDocument();

    // Only the view counter may talk to the server; nothing else (no AI, no translation endpoint).
    const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(urls.every((url) => url.startsWith('/api/views/'))).toBe(true);
  });
});
