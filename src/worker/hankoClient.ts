declare const process: { env: Record<string, string | undefined> };

interface Env {
  HUNKO_USERS_SERVICE_API_URL: string;
  HUNKO_USERS_SERVICE_API_KEY: string;
  HUNKO_SESSION_TOKEN_COOKIE_NAME?: string;
}

class HankoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBase(env: Env) {
  return (
    env.HUNKO_USERS_SERVICE_API_URL ||
    process.env.HUNKO_USERS_SERVICE_API_URL ||
    'http://hanko-public.securelink.svc.cluster.local'
  );
}

async function hankoFetch(env: Env, path: string, init: RequestInit = {}) {
  const res = await fetch(`${getBase(env)}${path}`, {
    headers: {
      'x-api-key': env.HUNKO_USERS_SERVICE_API_KEY,
      ...(init.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('Hanko request failed', path, res.status, text);
    throw new HankoError(res.status, text);
  }
  return res;
}

export async function exchangeCode(env: Env, code: string) {
  const res = await hankoFetch(env, '/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
}

export async function me(env: Env, token: string) {
  const res = await hankoFetch(env, '/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function logout(env: Env, token?: string) {
  if (!token) return;
  await hankoFetch(env, '/sessions', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAuthorisationUrl(env: Env, provider: string, redirect: string) {
  const url = `/thirdparty/authorisationurl?thirdPartyId=${provider}&redirectURIOnProviderDashboard=${encodeURIComponent(redirect)}`;
  const res = await hankoFetch(env, url);
  return res.json();
}
