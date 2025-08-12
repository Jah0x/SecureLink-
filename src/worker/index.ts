/* eslint-disable */
// @ts-nocheck
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import Database from 'better-sqlite3'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'

const app = new Hono()

// ---------- utils/env ----------
const AUTH_BASE = process.env.AUTH_BASE_URL
const AUTH_MODE = process.env.AUTH_MODE || (AUTH_BASE ? 'proxy' : 'internal')

const PATH_REGISTER = process.env.AUTH_PATH_REGISTER || '/users/register'
const PATH_LOGIN    = process.env.AUTH_PATH_LOGIN    || '/users/login'
const PATH_ME       = process.env.AUTH_PATH_ME       || '/users/me'
const PATH_LOGOUT   = process.env.AUTH_PATH_LOGOUT   || '/users/logout'

const SESSION_COOKIE_NAME   = process.env.SESSION_COOKIE_NAME || 'session_token'
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN || '.zerologsvpn.com'
const SESSION_COOKIE_SECURE = String(process.env.SESSION_COOKIE_SECURE || 'true') === 'true'
const SESSION_COOKIE_SAMESITE = (process.env.SESSION_COOKIE_SAMESITE || 'None') as 'Lax'|'Strict'|'None'
const SESSION_COOKIE_MAXAGE = Number(process.env.SESSION_COOKIE_MAXAGE || 60*60*24*30)

const SESSION_SECRET = process.env.SESSION_SECRET || 'dev_secret'

function authUrl(path: string) {
  if (!AUTH_BASE) throw new Error('AUTH_BASE_URL is not set')
  return new URL(path, AUTH_BASE)
}

let db
if (AUTH_MODE === 'internal') {
  fsSync.mkdirSync('/app/data', { recursive: true })
  db = new Database('/app/data/auth.db')
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME
  )`)
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

// ---------- auth proxy ----------
app.post('/api/auth/register', async (c) => {
  try {
    const payload = await c.req.json()
    if (AUTH_MODE === 'proxy') {
      const r = await fetch(authUrl(PATH_REGISTER), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const txt = await r.text()
      let token: string | undefined
      try {
        const j = JSON.parse(txt)
        token = j.token || j.accessToken || j.sessionToken
      } catch {}
      if (token) setSessionCookie(c, token)
      return new Response(txt, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    }
    const { email, password } = payload || {}
    if (!email || !password) return c.json({ error: 'invalid_input' }, 400)
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) return c.json({ error: 'user_exists' }, 400)
    const hash = await argon2.hash(password, { type: argon2.argon2id })
    db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)').run(email, hash)
    const token = jwt.sign({ email }, SESSION_SECRET, { algorithm: 'HS256' })
    setSessionCookie(c, token)
    return c.json({ ok: true })
  } catch (e:any) {
    console.error('register error', e)
    return c.json({ error: 'register_failed' }, 502)
  }
})

app.post('/api/auth/login', async (c) => {
  try {
    const payload = await c.req.json()
    if (AUTH_MODE === 'proxy') {
      const r = await fetch(authUrl(PATH_LOGIN), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const txt = await r.text()
      let token: string | undefined
      try { const j = JSON.parse(txt); token = j.token || j.accessToken || j.sessionToken } catch {}
      if (token) setSessionCookie(c, token)
      return new Response(txt, { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    }
    const { email, password } = payload || {}
    if (!email || !password) return c.json({ error: 'invalid_input' }, 400)
    const row = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email)
    if (!row) return c.json({ error: 'invalid_credentials' }, 401)
    const ok = await argon2.verify(row.password_hash, password)
    if (!ok) return c.json({ error: 'invalid_credentials' }, 401)
    const token = jwt.sign({ email }, SESSION_SECRET, { algorithm: 'HS256' })
    setSessionCookie(c, token)
    return c.json({ ok: true })
  } catch (e:any) {
    console.error('login error', e)
    return c.json({ error: 'login_failed' }, 502)
  }
})

app.post('/api/auth/logout', async (c) => {
  try {
    if (AUTH_MODE === 'proxy') {
      const r = await fetch(authUrl(PATH_LOGOUT), { method: 'POST' })
      deleteCookie(c, SESSION_COOKIE_NAME, { domain: SESSION_COOKIE_DOMAIN, path: '/' })
      return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { domain: SESSION_COOKIE_DOMAIN, path: '/' })
    return c.json({ ok: true })
  } catch (e:any) {
    console.error('logout error', e)
    deleteCookie(c, SESSION_COOKIE_NAME, { domain: SESSION_COOKIE_DOMAIN, path: '/' })
    return c.json({ ok: true })
  }
})

app.get('/api/users/me', async (c) => {
  try {
    if (AUTH_MODE === 'proxy') {
      const token = getCookie(c, SESSION_COOKIE_NAME)
      const h = new Headers()
      if (token) h.set('authorization', `Bearer ${token}`)
      const r = await fetch(authUrl(PATH_ME), {
        headers: h,
      })
      return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    }
    const token = getCookie(c, SESSION_COOKIE_NAME)
    if (!token) return c.json({ error: 'unauthorized' }, 401)
    try {
      const data: any = jwt.verify(token, SESSION_SECRET)
      return c.json({ email: data.email })
    } catch {
      return c.json({ error: 'unauthorized' }, 401)
    }
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
