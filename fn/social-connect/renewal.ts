// wave277, 02/11/26: the weekly renewal (check) and the expiry warning (warn), moved out of index.ts so they can be tested.
// check renews (refresh only) and checks one platform; a failure marks it in error and never stops the others.
// warn tells the publishers about a login that lapses within 7 days (once a week per platform) through notify.
import type { Adapter, Any, Conn, Ctx, Platform as P } from './adapters/types.ts';
import { DAY, EXPIRING_DAYS, healthOf, msg } from './health.ts';

export type RenewCtx = {
  adapters: Record<string, Adapter>;
  actx: Ctx;
  conns(): Promise<Record<string, Any>>;
  setConn(platform: string, patch: Record<string, Any>, by: string): Promise<void>;
  publishers(): Promise<string[]>;
  getSecret(n: string): Promise<string>;
  fetch: typeof fetch;
  now(): number;
  supabaseUrl: string;
  anonKey: string;
};

const iso = (t: number) => new Date(t).toISOString();
export const CONNECTIONS_LINK = 'https://hub.welfareavenue.com/#studio/connections';

export async function check(rc: RenewCtx, p: P, conn: Conn, renew: boolean, by: string): Promise<string> {
  const a = rc.adapters[p.key];
  let r: Partial<Conn> = {};
  try {
    // a renewal is saved before the check, so a failed check never loses it (the vault already holds the new token)
    if (renew && a.refresh) { r = await a.refresh(p, conn, rc.actx); if (Object.keys(r).length) await rc.setConn(p.key, r, by); }
    const h = await a.health(p, { ...conn, ...r }, rc.actx);
    const patch = { ...r, ...h };
    await rc.setConn(p.key, { ...patch, health: healthOf({ ...conn, ...patch }, rc.now()) }, by);
    return p.key + ' ok';
  } catch (e) {
    try { await rc.setConn(p.key, { health: 'error', last_error: msg(e).slice(0, 200), last_checked_at: iso(rc.now()) }, by); } catch (_) { /* the next platform still runs */ }
    return p.key + ' failed';
  }
}

export function warnText(label: string, n: number): string {
  return label + ' connection expires in ' + n + (n === 1 ? ' day' : ' days') + '. Reconnect it on the Connections page so posts keep going out. <' + CONNECTIONS_LINK + '|Open Connections>';
}

export async function warn(rc: RenewCtx, oauth: P[]): Promise<string[]> {
  const c = await rc.conns(), now = rc.now(), out: string[] = [];
  let to: string[] | null = null;
  for (const p of oauth) {
    const v = c[p.key];
    if (!v || healthOf(v, now) !== 'expiring') continue;
    if (v.warned_at && now - new Date(v.warned_at).getTime() < EXPIRING_DAYS * DAY) continue;
    try {
      if (!to) to = await rc.publishers();
      const n = Math.max(1, Math.ceil((new Date(v.expires_at).getTime() - now) / DAY));
      const r = await rc.fetch(rc.supabaseUrl + '/functions/v1/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wa-secret': await rc.getSecret('WA_TRIGGER_SECRET'), Authorization: 'Bearer ' + rc.anonKey },
        body: JSON.stringify({ event: 'connection_expiring', to, title: p.label + ' connection expires in ' + n + (n === 1 ? ' day' : ' days'), text: warnText(p.label, n), url: '/#studio/connections', tag: 'studio-conn-' + p.key }),
      });
      if (!r.ok) throw new Error('notify HTTP ' + r.status);
      await rc.setConn(p.key, { warned_at: iso(now) }, 'refresh');
      out.push(p.key + ' warned');
    } catch (e) { console.log('social-connect warn ' + p.key + ': ' + msg(e)); out.push(p.key + ' warning failed'); }
  }
  return out;
}
