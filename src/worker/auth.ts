import { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

export const HUNKO_SESSION_TOKEN_COOKIE_NAME = 'hunko_session_token';

export function getOAuthRedirectUrl(
  provider: string,
  dashboardUrl?: string,
  redirectFromQuery?: string
) {
  const base = redirectFromQuery
    ? undefined
    : (dashboardUrl || process.env.NEXT_PUBLIC_API_BASE_URL || "");
  const dashboard = base && /^https?:\/\//.test(base)
    ? base
    : "https://dashboard.zerologsvpn.com";

  const redirect =
    redirectFromQuery || new URL("/thirdparty/callback", dashboard).toString();

  const hankoBase =
    process.env.HUNKO_USERS_SERVICE_API_URL ||
    process.env.NEXT_PUBLIC_HANKO_API_URL ||
    "http://hanko-public.securelink.svc.cluster.local";

  const u = new URL("/thirdparty/authorisationurl", hankoBase);
  u.searchParams.set("thirdPartyId", provider);
  u.searchParams.set("redirectURIOnProviderDashboard", redirect);
  return u.toString();
}

export async function exchangeCodeForSessionToken(code: string, opts: { apiUrl: string; apiKey: string; }) {
  const res = await fetch(`${opts.apiUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': opts.apiKey },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error('Failed to exchange code');
  const data = await res.json();
  return data.sessionToken || data.token;
}

export async function deleteSession(token: string, opts: { apiUrl: string; apiKey: string; }) {
  await fetch(`${opts.apiUrl}/sessions`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'x-api-key': opts.apiKey },
  });
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, HUNKO_SESSION_TOKEN_COOKIE_NAME);
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const res = await fetch(`${c.env.HUNKO_USERS_SERVICE_API_URL}/sessions/me`, {
    headers: { Authorization: `Bearer ${token}`, 'x-api-key': c.env.HUNKO_USERS_SERVICE_API_KEY },
  });
  if (!res.ok) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  const user = await res.json();
  c.set('user', user);
  await next();
};
