// wave277, 02/11/26: TikTok (moved from social-connect v2.1; same requests). Access tokens last a day, the refresh token a year.
import { type Adapter, type Any, checked, clientOf, DAY, form, iso, must } from './types.ts';

const API = 'https://open.tiktokapis.com/v2';
// the connection lasts as long as the refresh token (TikTok sends refresh_expires_in; a year when it does not)
const lasts = (t: Any, now: number) => iso(now + (Number(t.refresh_expires_in) > 0 ? Number(t.refresh_expires_in) * 1000 : 365 * DAY));

export const tiktok: Adapter = {
  authorizeUrl(p, id, redirect, state) {
    return 'https://www.tiktok.com/v2/auth/authorize/?client_key=' + encodeURIComponent(id) + '&scope=' + p.scopes.join(',') + '&response_type=code&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + encodeURIComponent(state);
  },
  async finish(_p, c, code, redirect, by, ctx) {
    const t = await form(ctx, API + '/oauth/token/', { client_key: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: redirect });
    const scope = String(t.scope || 'user.info.basic,video.upload');
    const fields = 'open_id,display_name,avatar_url' + (scope.indexOf('user.info.profile') >= 0 ? ',username' : '');
    const u = await (await ctx.fetch(API + '/user/info/?fields=' + fields, { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    const user = (u.data && u.data.user) || {};
    const now = ctx.now();
    await ctx.vaultSet('SOCIAL_TIKTOK_TOKEN', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, open_id: t.open_id, scope, expires_at: now + Number(t.expires_in || 86400) * 1000 }), 'wave225/231: the TikTok login for the Content Studio (drafts to the inbox, and the analytics)');
    const label = (user.display_name || 'TikTok') + (user.username ? ' (@' + user.username + ')' : '');
    return {
      label,
      conn: { status: 'connected', open_id: t.open_id || '', account_id: t.open_id || '', name: label, username: user.username || null, handle: user.username ? '@' + user.username : '', scopes: scope, scopes_granted: scope.split(',').filter(Boolean), connected_by: by, connected_at: iso(now), expires_at: lasts(t, now), last_error: null, state: null },
    };
  },
  // refresh first, as tiktok-pull does (the new login goes back into the vault), then read the account
  async health(p, _conn, ctx) {
    const t = JSON.parse(await ctx.getSecret('SOCIAL_TIKTOK_TOKEN'));
    const c = await clientOf(ctx, p.key); if (!c) throw new Error('the app keys are missing');
    if (!t || !t.refresh_token) throw new Error('no TikTok refresh token: connect TikTok again');
    const b = await must(ctx, API + '/oauth/token/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_key: c.id, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: t.refresh_token }).toString() });
    if (!b.access_token) throw new Error('TikTok refresh refused: ' + JSON.stringify(b).slice(0, 160));
    const now = ctx.now();
    const next = { ...t, access_token: b.access_token, refresh_token: b.refresh_token || t.refresh_token, expires_at: now + Number(b.expires_in || 86400) * 1000, scope: b.scope || t.scope };
    await ctx.vaultSet('SOCIAL_TIKTOK_TOKEN', JSON.stringify(next), 'wave225/231: TikTok login for the Content Studio (social-connect; refreshed by social-publish and tiktok-pull)');
    await must(ctx, API + '/user/info/?fields=open_id', { headers: { Authorization: 'Bearer ' + b.access_token } });
    return { ...checked(ctx), ...(Number(b.refresh_expires_in) > 0 ? { expires_at: lasts(b, now) } : {}) };
  },
};
