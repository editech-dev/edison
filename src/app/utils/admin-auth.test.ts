// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest';
import { isAdminRequest } from './admin-auth';

const req = (authorization?: string) =>
  new Request('http://localhost/api/chats', authorization ? { headers: { authorization } } : {});

describe('isAdminRequest', () => {
  afterEach(() => {
    delete process.env.ADMIN_API_TOKEN;
  });

  it('is false for everyone when the token is not configured', () => {
    expect(isAdminRequest(req())).toBe(false);
    expect(isAdminRequest(req('Bearer '))).toBe(false);
    expect(isAdminRequest(req('Bearer undefined'))).toBe(false);
  });

  it('accepts only the exact bearer token', () => {
    process.env.ADMIN_API_TOKEN = 's3cret-token';
    expect(isAdminRequest(req('Bearer s3cret-token'))).toBe(true);
    expect(isAdminRequest(req('Bearer s3cret-tokeN'))).toBe(false);
    expect(isAdminRequest(req('bearer s3cret-token'))).toBe(false);
    expect(isAdminRequest(req('s3cret-token'))).toBe(false);
    expect(isAdminRequest(req())).toBe(false);
  });
});
