import { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

export const HUNKO_SESSION_TOKEN_COOKIE_NAME = 'hunko_session_token';

export async function getOAuthRedirectUrl(
  provider: string,
  opts: { apiUrl: string; apiKey: string; dashboardUrl: string }
) {
  const url = new URL(`${opts.apiUrl}/thirdparty/authorisationurl`);
  url.searchParams.set('thirdPartyId', provider);
  url.searchParams.set(
    'redirectURIOnProviderDashboard',
    `${opts.dashboardUrl}/auth/callback`
  );

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': opts.apiKey },
  });
  if (!res.ok) throw new Error('Failed to get redirect URL');
  const data = await res.json();
  return data.redirectUrl || data.url;
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
