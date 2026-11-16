import { GET } from './route';
import { listChats } from '@/app/utils/redis';
import { describe, it, expect, vi } from 'vitest';

// Mock the redis utilities module
vi.mock('@/app/utils/redis', () => ({
  listChats: vi.fn(),
}));

describe('GET /api/chats', () => {
  it('returns 200 and listed chats on successful retrieval', async () => {
    const mockChats = [
      { id: 'chat-1', timestamp: '2026-07-18T12:00:00Z', preview: 'First message' },
      { id: 'chat-2', timestamp: '2026-07-18T13:00:00Z', preview: 'Second message' },
    ];
    vi.mocked(listChats).mockResolvedValue(mockChats);

    // Mock Request object with authorization header matching ADMIN_API_TOKEN configuration
    const req = new Request('http://localhost:3000/api/chats', {
      headers: {
        'authorization': 'Bearer test-token'
      }
    });

    // Temporarily set the ADMIN_API_TOKEN
    process.env.ADMIN_API_TOKEN = 'test-token';

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ chats: mockChats });
    expect(listChats).toHaveBeenCalledTimes(1);
    
    delete process.env.ADMIN_API_TOKEN;
  });

  it('returns 401 when admin token fails verification', async () => {
    const req = new Request('http://localhost:3000/api/chats', {
      headers: {
        'authorization': 'Bearer bad-token'
      }
    });

    process.env.ADMIN_API_TOKEN = 'test-token';

    const response = await GET(req);
    expect(response.status).toBe(401);
    
    delete process.env.ADMIN_API_TOKEN;
  });

  it('returns 500 when listChats throws an exception', async () => {
    vi.mocked(listChats).mockRejectedValue(new Error('Redis connection lost'));
    process.env.ADMIN_API_TOKEN = 'test-token';

    const req = new Request('http://localhost:3000/api/chats', {
      headers: { authorization: 'Bearer test-token' },
    });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal Server Error' });
    delete process.env.ADMIN_API_TOKEN;
  });

  it('fails closed with 401 when ADMIN_API_TOKEN is not configured, without reading Redis', async () => {
    delete process.env.ADMIN_API_TOKEN;

    const cases: Record<string, string>[] = [{}, { authorization: 'Bearer ' }, { authorization: 'Bearer undefined' }];
    for (const headers of cases) {
      const response = await GET(new Request('http://localhost:3000/api/chats', { headers }));
      expect(response.status).toBe(401);
    }
    expect(listChats).not.toHaveBeenCalled();
  });

  it('returns 401 without an authorization header when the token is configured', async () => {
    process.env.ADMIN_API_TOKEN = 'test-token';

    const response = await GET(new Request('http://localhost:3000/api/chats'));
    expect(response.status).toBe(401);
    expect(listChats).not.toHaveBeenCalled();
    delete process.env.ADMIN_API_TOKEN;
  });
});
