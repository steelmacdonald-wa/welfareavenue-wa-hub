// wave277, 02/11/26: connection health, computed on read so wave225 records with no health field still show correctly.
import type { Conn } from './adapters/types.ts';

export const DAY = 86400000;
export const EXPIRING_DAYS = 7;
const t = (v: unknown) => (v ? new Date(String(v)).getTime() : NaN);

export function healthOf(conn: Conn, now: number): Conn['health'] {
  if (!conn || conn.status !== 'connected') return 'not_connected';
  const exp = t(conn.expires_at);
  if (!isNaN(exp) && exp <= now) return 'expired';
  if (!isNaN(exp) && exp - now <= EXPIRING_DAYS * DAY) return 'expiring';
  if (conn.last_error && t(conn.last_checked_at) > (isNaN(t(conn.connected_at)) ? 0 : t(conn.connected_at))) return 'error';
  return 'ok';
}

// a stored record in the Conn shape: handle and account_id filled from the wave225 field names, health computed, no state
export function toConn(key: string, raw: Record<string, unknown> | undefined, now: number): Conn {
  const v: Conn = { ...(raw || {}) };
  delete v.state;
  if (v.account_id === undefined) {
    const id = key === 'threads' ? v.user_id : key === 'youtube' ? v.channel_id : key === 'tiktok' ? v.open_id : key === 'linkedin' ? v.org_urn : undefined;
    if (id) v.account_id = String(id);
  }
  if (v.handle === undefined && v.username) v.handle = '@' + String(v.username);
  v.health = healthOf(v, now);
  return v;
}
