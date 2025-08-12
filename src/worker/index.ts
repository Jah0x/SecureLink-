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
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
const FIRST_USER_ADMIN = String(process.env.FIRST_USER_ADMIN || 'false') === 'true'

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
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME
  )`)

  const cols = db.prepare("PRAGMA table_info(users)").all().map((c: any) => c.name)
  if (!cols.includes('role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)")

  db.exec(`CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    period_days INTEGER NOT NULL,
    traffic_limit_gb INTEGER,
    features TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)

  if (ADMIN_EMAILS.length) {
    const placeholders = ADMIN_EMAILS.map(() => '?').join(',')
    db.prepare(`UPDATE users SET role='admin' WHERE lower(email) IN (${placeholders})`).run(...ADMIN_EMAILS)
  }
  if (FIRST_USER_ADMIN) {
    const users = db.prepare("SELECT id FROM users WHERE role='user'").all()
    if (users.length === 1) {
      db.prepare("UPDATE users SET role='admin' WHERE id=?").run(users[0].id)
    }
  }
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

async function requireAuth(c: any, next: any) {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  try {
    const data = jwt.verify(token, SESSION_SECRET)
    c.set('user', data)
    await next()
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
}

async function requireAdmin(c: any, next: any) {
  const user = c.get('user')
  if (!user || user.role !== 'admin') return c.json({ error: 'forbidden' }, 403)
  await next()
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
    const info = db
      .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .run(email, hash)
    const user = { id: info.lastInsertRowid as number, email, role: 'user' }
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, SESSION_SECRET, {
      algorithm: 'HS256',
    })
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
    const row = db.prepare('SELECT id, password_hash, role FROM users WHERE email = ?').get(email)
    if (!row) return c.json({ error: 'invalid_credentials' }, 401)
    const ok = await argon2.verify(row.password_hash, password)
    if (!ok) return c.json({ error: 'invalid_credentials' }, 401)
    const token = jwt.sign({ sub: row.id, email, role: row.role }, SESSION_SECRET, { algorithm: 'HS256' })
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

if (AUTH_MODE === 'proxy') {
  app.get('/api/users/me', async (c) => {
    try {
      const token = getCookie(c, SESSION_COOKIE_NAME)
      const h = new Headers()
      if (token) h.set('authorization', `Bearer ${token}`)
      const r = await fetch(authUrl(PATH_ME), { headers: h })
      return new Response(await r.text(), {
        status: r.status,
        headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' },
      })
    } catch (e: any) {
      console.error('me error', e)
      return c.json({ error: 'me_failed' }, 502)
    }
  })
} else {
  app.get('/api/users/me', requireAuth, (c) => {
    const user: any = c.get('user')
    const row = db
      .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
      .get(user.sub)
    if (!row) return c.json({ error: 'unauthorized' }, 401)
    return c.json(row)
  })

  app.get('/api/admin/ping', requireAuth, requireAdmin, (c) => c.json({ ok: true }))

  app.get('/api/plans', (c) => {
    const rows = db
      .prepare(
        'SELECT id, name, price_cents, period_days, traffic_limit_gb, features FROM plans WHERE is_active=1'
      )
      .all()
    const plans = rows.map((r: any) => ({ ...r, features: r.features ? JSON.parse(r.features) : [] }))
    return c.json(plans)
  })

  app.get('/api/admin/plans', requireAuth, requireAdmin, (c) => {
    const rows = db.prepare('SELECT * FROM plans').all()
    const plans = rows.map((r: any) => ({ ...r, features: r.features ? JSON.parse(r.features) : [] }))
    return c.json(plans)
  })

  app.post('/api/admin/plans', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json()
    const { name, price_cents, period_days, traffic_limit_gb, features = [], is_active = 1 } = body || {}
    if (!name || !price_cents || price_cents <= 0 || !period_days || period_days < 1) {
      return c.json({ error: 'invalid_input' }, 400)
    }
    if (traffic_limit_gb != null && traffic_limit_gb < 0) {
      return c.json({ error: 'invalid_input' }, 400)
    }
    const info = db
      .prepare(
        'INSERT INTO plans (name, price_cents, period_days, traffic_limit_gb, features, is_active) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(name, price_cents, period_days, traffic_limit_gb ?? null, JSON.stringify(features), is_active ? 1 : 0)
    return c.json({ id: info.lastInsertRowid })
  })

  app.put('/api/admin/plans/:id', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const { name, price_cents, period_days, traffic_limit_gb, features = [], is_active = 1 } = body || {}
    if (!name || !price_cents || price_cents <= 0 || !period_days || period_days < 1) {
      return c.json({ error: 'invalid_input' }, 400)
    }
    if (traffic_limit_gb != null && traffic_limit_gb < 0) {
      return c.json({ error: 'invalid_input' }, 400)
    }
    db.prepare(
      'UPDATE plans SET name=?, price_cents=?, period_days=?, traffic_limit_gb=?, features=?, is_active=? WHERE id=?'
    ).run(
      name,
      price_cents,
      period_days,
      traffic_limit_gb ?? null,
      JSON.stringify(features),
      is_active ? 1 : 0,
      id
    )
    return c.json({ ok: true })
  })

  app.delete('/api/admin/plans/:id', requireAuth, requireAdmin, (c) => {
    const id = Number(c.req.param('id'))
    db.prepare('UPDATE plans SET is_active=0 WHERE id=?').run(id)
    return c.json({ ok: true })
  })
}

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
