import { timingSafeEqual } from 'crypto';

/**
 * True only when ADMIN_API_TOKEN is configured and the request carries exactly
 * `Authorization: Bearer <token>`. Fails closed: without a configured token nobody is admin.
 * The comparison runs in constant time so response timing does not leak the token.
 */
export function isAdminRequest(req: Request): boolean {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) return false;

  const expected = Buffer.from(`Bearer ${token}`);
  const received = Buffer.from(req.headers.get('authorization') ?? '');
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}
