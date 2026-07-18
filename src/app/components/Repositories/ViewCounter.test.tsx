import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ViewCounter from './ViewCounter';

describe('ViewCounter Component', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    // Clear cookies
    document.cookie = 'uniqueId=; max-age=0; path=/;';
  });

  it('renders initial views count formatted correctly', () => {
    render(<ViewCounter slug="test-repo" initialViews={1500} />);
    expect(screen.getByText('1.5K')).toBeInTheDocument();
  });

  it('calls fetch to track view when trackView is true', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ views: 1501 }),
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ViewCounter slug="test-repo" initialViews={1500} trackView={true} />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/views/test-repo',
        expect.objectContaining({ method: 'POST' })
      );
      expect(screen.getByText('1.5K')).toBeInTheDocument(); // Displays original or updated
    });
  });

  it('displays a dash when view tracking fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    render(<ViewCounter slug="test-repo" initialViews={1500} trackView={true} />);

    await waitFor(() => {
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });
});
