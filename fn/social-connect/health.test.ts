// wave277: health is computed on read, so wave225 records with no health field still show correctly.
import { assertEquals } from 'jsr:@std/assert';
import { healthOf } from './health.ts';

const DAY = 86400000;
const now = Date.parse('2026-11-02T12:00:00Z');
const iso = (t: number) => new Date(t).toISOString();

Deno.test('healthOf: ok, expiring, expired, not_connected', () => {
  assertEquals(healthOf({ status: 'connected' }, now), 'ok');
  assertEquals(healthOf({ status: 'connected', expires_at: iso(now + 6 * DAY) }, now), 'expiring');
  assertEquals(healthOf({ status: 'connected', expires_at: iso(now - DAY) }, now), 'expired');
  assertEquals(healthOf({}, now), 'not_connected');
});

Deno.test('healthOf: error only when the failed check is newer than the connection', () => {
  const connected_at = iso(now - 10 * DAY);
  assertEquals(healthOf({ status: 'connected', connected_at, last_error: 'HTTP 401', last_checked_at: iso(now - DAY) }, now), 'error');
  assertEquals(healthOf({ status: 'connected', connected_at, last_error: 'HTTP 401', last_checked_at: iso(now - 20 * DAY) }, now), 'ok');
  assertEquals(healthOf({ status: 'connected', expires_at: iso(now + 30 * DAY) }, now), 'ok');
  assertEquals(healthOf({ status: 'disconnected', expires_at: iso(now + 30 * DAY) }, now), 'not_connected');
});
