// wave277, 02/11/26: LinkedIn Community Management (moved from social-connect v2.1). The scopes come from the registry
// (six since wave277); the login lasts 60 days and is reconnected by hand when it lapses.
import { type Adapter, type Ctx, checked, form, iso, must } from './types.ts';

const ACL = 'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED';
const headers = (tok: string) => ({ Authorization: 'Bearer ' + tok, 'Linkedin-Version': '202609', 'X-Restli-Protocol-Version': '2.0.0' });

export const linkedin: Adapter = {
  authorizeUrl(p, id, redirect, state) {
    return 'https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + encodeURIComponent(state) + '&scope=' + encodeURIComponent(p.scopes.join(' '));
  },
  async finish(_p, c, code, redirect, by, ctx: Ctx) {
    const t = await form(ctx, 'https://www.linkedin.com/oauth/v2/accessToken', { grant_type: 'authorization_code', code, redirect_uri: redirect, client_id: c.id, client_secret: c.secret });
    const acl = await (await ctx.fetch(ACL, { headers: headers(String(t.access_token)) })).json();
    const org = String(((acl.elements || [])[0] || {}).organization || '');
    await ctx.vaultSet('SOCIAL_LINKEDIN_TOKEN', String(t.access_token), 'wave225: the LinkedIn Community Management login (60 days; reconnect when it lapses)');
    if (t.refresh_token) await ctx.vaultSet('SOCIAL_LINKEDIN_REFRESH', String(t.refresh_token), 'wave225: LinkedIn refresh token (365 days)');
    const now = ctx.now();
    return {
      label: org ? 'the Page ' + org.split(':').pop() : 'LinkedIn (no Page admin role found)',
      conn: { status: 'connected', mode: 'direct', org_urn: org, account_id: org, name: 'Welfare Avenue (LinkedIn)', scopes_granted: String(t.scope || '').split(/[\s,]+/).filter(Boolean), connected_by: by, connected_at: iso(now), expires_at: iso(now + Number(t.expires_in || 5184000) * 1000), last_error: null, state: null },
    };
  },
  async health(_p, _conn, ctx) {
    const tok = await ctx.getSecret('SOCIAL_LINKEDIN_TOKEN');
    await must(ctx, ACL, { headers: headers(tok) });
    return checked(ctx);
  },
};
