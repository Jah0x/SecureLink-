import { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

declare const process: { env: Record<string, string | undefined> };

export const HUNKO_SESSION_TOKEN_COOKIE_NAME =
  process.env.HUNKO_SESSION_TOKEN_COOKIE_NAME || 'hunko_session_token';

export function parseOrigin(req: Request) {
  const host = req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const origin =
    (host ? `${proto}://${host}` : undefined) ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://dashboard.zerologsvpn.com';
  return { proto, host, origin };
}

export function getOAuthRedirectUrl(
  provider: string,
  dashboardOrigin?: string,
  redirectFromQuery?: string
) {
  const origin =
    dashboardOrigin ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://dashboard.zerologsvpn.com';

  let redirect: string;
  try {
    redirect = redirectFromQuery
      ? new URL(redirectFromQuery, origin).toString()
      : new URL('/thirdparty/callback', origin).toString();
  } catch {
    redirect = new URL('/thirdparty/callback', origin).toString();
  }

  const hankoBase =
    process.env.HUNKO_USERS_SERVICE_API_URL ||
    process.env.NEXT_PUBLIC_HANKO_API_URL ||
    'http://hanko-public.securelink.svc.cluster.local';

  return `${hankoBase}/thirdparty/authorisationurl?thirdPartyId=${provider}&redirectURIOnProviderDashboard=${encodeURIComponent(
    redirect
  )}`;
}

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  const cookieName = c.env.HUNKO_SESSION_TOKEN_COOKIE_NAME || HUNKO_SESSION_TOKEN_COOKIE_NAME;
  const token = getCookie(c, cookieName);
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
