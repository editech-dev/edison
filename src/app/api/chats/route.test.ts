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

    const req = new Request('http://localhost:3000/api/chats');

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Internal Server Error' });
  });
});
