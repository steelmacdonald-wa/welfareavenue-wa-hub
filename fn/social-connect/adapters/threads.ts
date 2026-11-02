// wave277, 02/11/26: Threads (moved from social-connect v2.1; same requests). Tokens last 60 days; refreshed weekly.
import { type Adapter, checked, DAY, form, iso, must } from './types.ts';

export const threads: Adapter = {
  authorizeUrl(p, id, redirect, state) {
    return 'https://threads.net/oauth/authorize?client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(redirect) + '&scope=' + p.scopes.join(',') + '&response_type=code&state=' + encodeURIComponent(state);
  },
  async finish(_p, c, code, redirect, by, ctx) {
    const short = await form(ctx, 'https://graph.threads.net/oauth/access_token', { client_id: c.id, client_secret: c.secret, grant_type: 'authorization_code', redirect_uri: redirect, code });
    const ll = await (await ctx.fetch('https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=' + encodeURIComponent(c.secret) + '&access_token=' + encodeURIComponent(short.access_token))).json();
    const tok = String(ll.access_token || short.access_token);
    const me = await (await ctx.fetch('https://graph.threads.net/v1.0/me?fields=id,username,name&access_token=' + encodeURIComponent(tok))).json();
    await ctx.vaultSet('SOCIAL_THREADS_TOKEN', tok, 'wave225: the Threads login for the Content Studio (60 days, refreshed weekly by social-connect)');
    const now = ctx.now(), user_id = String(me.id || short.user_id || '');
    return {
      label: '@' + (me.username || ''),
      conn: { status: 'connected', user_id, username: me.username || '', name: me.name || me.username || 'Threads', handle: me.username ? '@' + me.username : '', account_id: user_id, connected_by: by, connected_at: iso(now), refreshed_at: iso(now), expires_at: iso(now + 60 * DAY), last_error: null, state: null },
    };
  },
  async refresh(_p, conn, ctx) {
    const now = ctx.now();
    if (now - new Date(String(conn.refreshed_at || 0)).getTime() <= 7 * DAY) return {};
    const th = await ctx.getSecret('SOCIAL_THREADS_TOKEN');
    const r = await (await ctx.fetch('https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=' + encodeURIComponent(th))).json();
    if (!r.access_token) throw new Error('refresh failed: ' + JSON.stringify(r.error || r).slice(0, 160));
    await ctx.vaultSet('SOCIAL_THREADS_TOKEN', String(r.access_token), 'wave225: the Threads login (refreshed)');
    return { refreshed_at: iso(now), expires_at: iso(now + 60 * DAY), last_error: null };
  },
  async health(_p, _conn, ctx) {
    const tok = await ctx.getSecret('SOCIAL_THREADS_TOKEN');
    await must(ctx, 'https://graph.threads.net/v1.0/me?fields=id&access_token=' + encodeURIComponent(tok));
    return checked(ctx);
  },
};
