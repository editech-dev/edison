import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET } from './route';
import { getChat } from '@/app/utils/redis';

vi.mock('@/app/utils/redis', () => ({
  getChat: vi.fn(),
}));

const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/chats/abc', { headers });
const params = { params: Promise.resolve({ id: 'abc' }) };

describe('GET /api/chats/[id]', () => {
  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
  });

  it('fails closed with 401 when ADMIN_API_TOKEN is not configured, without reading Redis', async () => {
    const response = await GET(request({ authorization: 'Bearer anything' }), params);
    expect(response.status).toBe(401);
    expect(getChat).not.toHaveBeenCalled();
  });

  it('returns 401 for a wrong token', async () => {
    process.env.ADMIN_API_TOKEN = 'test-token';
    const response = await GET(request({ authorization: 'Bearer wrong-token' }), params);
    expect(response.status).toBe(401);
    expect(getChat).not.toHaveBeenCalled();
  });

  it('returns the chat for the right token', async () => {
    process.env.ADMIN_API_TOKEN = 'test-token';
    vi.mocked(getChat).mockResolvedValue({ messages: [] });
    const response = await GET(request({ authorization: 'Bearer test-token' }), params);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ messages: [] });
  });

  it('returns 404 when the chat does not exist', async () => {
    process.env.ADMIN_API_TOKEN = 'test-token';
    vi.mocked(getChat).mockResolvedValue(null);
    const response = await GET(request({ authorization: 'Bearer test-token' }), params);
    expect(response.status).toBe(404);
  });
});
