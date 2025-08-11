/* eslint-disable */
// @ts-nocheck
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'

const app = new Hono()

// ---------- utils/env ----------
const AUTH_BASE = process.env.HUNKO_USERS_SERVICE_API_URL!
const API_KEY   = process.env.HUNKO_USERS_SERVICE_API_KEY || ''

const PATH_AUTH_URL = process.env.AUTH_PATH_AUTHORISATION_URL || '/auth/authorisationurl'
const PATH_REGISTER = process.env.AUTH_PATH_REGISTER || '/api/auth/register'
const PATH_LOGIN    = process.env.AUTH_PATH_LOGIN    || '/api/auth/login'
const PATH_ME       = process.env.AUTH_PATH_ME       || '/api/users/me'
const PATH_LOGOUT   = process.env.AUTH_PATH_LOGOUT   || '/api/auth/logout'

const SESSION_COOKIE_NAME   = process.env.SESSION_COOKIE_NAME || 'hunko_session_token'
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN || '.zerologsvpn.com'
const SESSION_COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || 'true') === 'true'
const SESSION_COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || 'None') as 'Lax'|'Strict'|'None'
const SESSION_COOKIE_MAXAGE = Number(process.env.SESSION_COOKIE_MAXAGE || 60*60*24*30)

function authUrl(path: string) {
  const u = new URL(path, AUTH_BASE)
  return u
}
function withApiKey(h: Headers = new Headers()) {
  if (API_KEY) h.set('x-api-key', API_KEY)
  return h
}
function setSessionCookie(c: any, token: string, maxAge = SESSION_COOKIE_MAXAGE) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
    domain: SESSION_COOKIE_DOMAIN,
    path: '/',
    maxAge,
  })
}

// ---------- health ----------
app.get('/healthz', (c) => c.json({ status: 'ok' }))

// ---------- OAuth helper ----------
app.get('/thirdparty/:provider/redirect_url', async (c) => {
  try {
    const provider = c.req.param('provider')
    const redirect = c.req.query('redirect_url')
    if (!redirect) return c.json({ error: 'redirect_url required' }, 400)

    const u = authUrl(PATH_AUTH_URL)
    u.searchParams.set('thirdPartyId', provider)
    u.searchParams.set('redirectURIOnProviderDashboard', redirect)

    const r = await fetch(u, { headers: withApiKey() })
    const body = await r.text()
    return new Response(body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
  } catch (e:any) {
    console.error('oauth helper error', e)
    return c.json({ error: 'oauth_helper_failed' }, 502)
  }
})

// ---------- auth proxy ----------
app.post('/api/auth/register', async (c) => {
  try {
    const payload = await c.req.json()
    const r = await fetch(authUrl(PATH_REGISTER), {
      method: 'POST',
      headers: withApiKey(new Headers({ 'content-type': 'application/json' })),
      body: JSON.stringify(payload),
    })
    const txt = await r.text()

    // попытка достать токен из JSON {token|accessToken|sessionToken}
    let token: string | undefined
    try {
      const j = JSON.parse(txt)
      token = j.token || j.accessToken || j.sessionToken
    } catch {}
    if (token) setSessionCookie(c, token)

    // если апстрим прислал Set-Cookie — просто прокинь (НЕ всегда возможно на хостинге; опционально можно переписать домен)
    const resp = new Response(txt, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    return resp
  } catch (e:any) {
    console.error('register error', e)
    return c.json({ error: 'register_failed' }, 502)
  }
})

app.post('/api/auth/login', async (c) => {
  try {
    const payload = await c.req.json()
    const r = await fetch(authUrl(PATH_LOGIN), {
      method: 'POST',
      headers: withApiKey(new Headers({ 'content-type': 'application/json' })),
      body: JSON.stringify(payload),
    })
    const txt = await r.text()
    let token: string | undefined
    try { const j = JSON.parse(txt); token = j.token || j.accessToken || j.sessionToken } catch {}
    if (token) setSessionCookie(c, token)
    return new Response(txt, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
  } catch (e:any) {
    console.error('login error', e)
    return c.json({ error: 'login_failed' }, 502)
  }
})

app.post('/api/auth/logout', async (c) => {
  try {
    const r = await fetch(authUrl(PATH_LOGOUT), { method: 'POST', headers: withApiKey() })
    // гасим свою куку
    deleteCookie(c, SESSION_COOKIE_NAME, { domain: SESSION_COOKIE_DOMAIN, path: '/' })
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
  } catch (e:any) {
    console.error('logout error', e)
    deleteCookie(c, SESSION_COOKIE_NAME, { domain: SESSION_COOKIE_DOMAIN, path: '/' })
    return c.json({ ok: true })
  }
})

app.get('/api/users/me', async (c) => {
  try {
    const token = getCookie(c, SESSION_COOKIE_NAME)
    const h = withApiKey()
    // если апстрим ждёт токен как Bearer — отправим и так, и как cookie (на всякий)
    if (token) h.set('authorization', `Bearer ${token}`)
    const r = await fetch(authUrl(PATH_ME), {
      headers: h,
    })
    return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
  } catch (e:any) {
    console.error('me error', e)
    return c.json({ error: 'me_failed' }, 502)
  }
})

// ---------- STATIC + SPA ----------
// autodetect build dir
const hasClient = fsSync.existsSync('./dist/client/index.html')
const ASSETS_ROOT = hasClient ? './dist/client' : './dist'
const INDEX_PATH  = hasClient ? './dist/client/index.html' : './dist/index.html'

// assets
app.use('/assets/*', serveStatic({ root: ASSETS_ROOT }))

// root
app.get('/', async (c) => c.html(await fs.readFile(INDEX_PATH, 'utf8')))

// fallback — последним
app.get('*', serveStatic({ path: INDEX_PATH }))

export default app