// wave277, 02/11/26: YouTube (moved from social-connect v2.1; same requests). The refresh token does not expire.
import { type Adapter, checked, clientOf, form, iso, must } from './types.ts';

export const youtube: Adapter = {
  authorizeUrl(p, id, redirect, state) {
    return 'https://accounts.google.com/o/oauth2/v2/auth?client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(redirect) + '&response_type=code&access_type=offline&prompt=consent&include_granted_scopes=true&scope=' + encodeURIComponent(p.scopes.join(' ')) + '&state=' + encodeURIComponent(state);
  },
  async finish(_p, c, code, redirect, by, ctx) {
    const t = await form(ctx, 'https://oauth2.googleapis.com/token', { client_id: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: redirect });
    if (!t.refresh_token) throw new Error('Google sent no refresh token: remove the app at myaccount.google.com/permissions and connect again');
    const ch = await (await ctx.fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
    const item = (ch.items || [])[0] || {};
    await ctx.vaultSet('SOCIAL_YOUTUBE_REFRESH', String(t.refresh_token), 'wave225: the YouTube login for the Content Studio (refresh token)');
    const title = (item.snippet && item.snippet.title) || '';
    return {
      label: title || 'the channel',
      conn: { status: 'connected', channel_id: item.id || '', account_id: item.id || '', name: title || 'YouTube', handle: (item.snippet && item.snippet.customUrl) || '', connected_by: by, connected_at: iso(ctx.now()), last_error: null, state: null },
    };
  },
  // a token refresh proves the login still works; the access token it returns is not kept
  async health(p, _conn, ctx) {
    const c = await clientOf(ctx, p.key); if (!c) throw new Error('the app keys are missing');
    const rt = await ctx.getSecret('SOCIAL_YOUTUBE_REFRESH');
    await must(ctx, 'https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: rt }).toString() });
    return checked(ctx);
  },
};
