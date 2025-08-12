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
  db.exec('CREATE INDEX IF NOT EXISTS idx_plans_active ON plans(is_active)')

  db.exec(`CREATE TABLE IF NOT EXISTS affiliates (
    user_id    INTEGER UNIQUE NOT NULL,
    code       TEXT    UNIQUE NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS affiliate_events (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    code         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK(type IN ('click','signup','purchase')),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    ip           TEXT,
    ua           TEXT,
    created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  if (!cols.includes('ref_code')) {
    db.exec("ALTER TABLE users ADD COLUMN ref_code TEXT")
  }

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
    const aff = getCookie(c, 'aff_code')
    if (aff) {
      db.prepare('UPDATE users SET ref_code=? WHERE id=?').run(aff, user.id)
      db.prepare('INSERT INTO affiliate_events (code, type) VALUES (?, ? )').run(aff, 'signup')
    }
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
  function genAffCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    while (true) {
      const len = 6 + Math.floor(Math.random() * 3)
      let code = ''
      for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)]
      const exists = db.prepare('SELECT 1 FROM affiliates WHERE code=?').get(code)
      if (!exists) return code
    }
  }

  app.get('/api/users/me', requireAuth, (c) => {
    const user: any = c.get('user')
    const row = db
      .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
      .get(user.sub)
    if (!row) return c.json({ error: 'unauthorized' }, 401)
    return c.json(row)
  })

  app.get('/api/admin/ping', requireAuth, requireAdmin, (c) => c.json({ ok: true }))

  app.get('/api/admin/users', requireAuth, requireAdmin, (c) => {
    const rows = db
      .prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at DESC')
      .all()
    return c.json(rows)
  })

  app.get('/api/plans', (c) => {
    const rows = db
      .prepare(
        'SELECT id, name, price_cents, period_days, traffic_limit_gb, features, is_active, created_at FROM plans WHERE is_active=1 ORDER BY created_at DESC'
      )
      .all()
    const plans = rows.map((r: any) => ({
      ...r,
      features: r.features ? JSON.parse(r.features) : [],
      is_active: Boolean(r.is_active),
    }))
    return c.json(plans)
  })

  app.get('/api/admin/plans', requireAuth, requireAdmin, (c) => {
    const offset = Number(c.req.query('offset') || '0')
    const limit = Number(c.req.query('limit') || '50')
    const q = (c.req.query('active') || 'all').toLowerCase()
    let where = ''
    if (['1', 'true', 'active'].includes(q)) where = 'WHERE is_active=1'
    else if (['0', 'false', 'inactive'].includes(q)) where = 'WHERE is_active=0'
    const rows = db
      .prepare(`SELECT * FROM plans ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .all(limit, offset)
    const plans = rows.map((r: any) => ({
      ...r,
      features: r.features ? JSON.parse(r.features) : [],
      is_active: Boolean(r.is_active),
    }))
    return c.json(plans)
  })

  app.get('/api/admin/plans/:id', requireAuth, requireAdmin, (c) => {
    const id = Number(c.req.param('id'))
    const row = db.prepare('SELECT * FROM plans WHERE id=?').get(id)
    if (!row) return c.json({ error: 'not_found' }, 404)
    const plan = {
      ...row,
      features: row.features ? JSON.parse(row.features) : [],
      is_active: Boolean(row.is_active),
    }
    return c.json(plan)
  })

  app.post('/api/admin/plans', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json()
    const {
      name,
      price_cents,
      period_days,
      traffic_limit_gb = null,
      features,
      is_active = true,
    } = body || {}
    if (!name || name.length < 1 || name.length > 100) {
      return c.json({ error: 'invalid_name', field: 'name' }, 400)
    }
    if (!Number.isInteger(price_cents) || price_cents <= 0) {
      return c.json({ error: 'invalid_price', field: 'price_cents' }, 400)
    }
    if (!Number.isInteger(period_days) || period_days < 1) {
      return c.json({ error: 'invalid_period', field: 'period_days' }, 400)
    }
    if (traffic_limit_gb != null && (!Number.isInteger(traffic_limit_gb) || traffic_limit_gb < 0)) {
      return c.json({ error: 'invalid_traffic', field: 'traffic_limit_gb' }, 400)
    }
    if (features != null && !Array.isArray(features)) {
      return c.json({ error: 'invalid_features', field: 'features' }, 400)
    }
    const info = db
      .prepare(
        'INSERT INTO plans (name, price_cents, period_days, traffic_limit_gb, features, is_active) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(
        name,
        price_cents,
        period_days,
        traffic_limit_gb,
        features ? JSON.stringify(features) : null,
        is_active ? 1 : 0
      )
    const row = db.prepare('SELECT * FROM plans WHERE id=?').get(info.lastInsertRowid)
    const plan = {
      ...row,
      features: row.features ? JSON.parse(row.features) : [],
      is_active: Boolean(row.is_active),
    }
    return c.json(plan, 201)
  })

  app.put('/api/admin/plans/:id', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    const existing = db.prepare('SELECT * FROM plans WHERE id=?').get(id)
    if (!existing) return c.json({ error: 'not_found' }, 404)
    const body = await c.req.json()
    const updates: string[] = []
    const params: any[] = []

    if (body.name !== undefined) {
      if (!body.name || body.name.length < 1 || body.name.length > 100) {
        return c.json({ error: 'invalid_name', field: 'name' }, 400)
      }
      updates.push('name=?')
      params.push(body.name)
    }
    if (body.price_cents !== undefined) {
      if (!Number.isInteger(body.price_cents) || body.price_cents <= 0) {
        return c.json({ error: 'invalid_price', field: 'price_cents' }, 400)
      }
      updates.push('price_cents=?')
      params.push(body.price_cents)
    }
    if (body.period_days !== undefined) {
      if (!Number.isInteger(body.period_days) || body.period_days < 1) {
        return c.json({ error: 'invalid_period', field: 'period_days' }, 400)
      }
      updates.push('period_days=?')
      params.push(body.period_days)
    }
    if (body.traffic_limit_gb !== undefined) {
      if (body.traffic_limit_gb != null && (!Number.isInteger(body.traffic_limit_gb) || body.traffic_limit_gb < 0)) {
        return c.json({ error: 'invalid_traffic', field: 'traffic_limit_gb' }, 400)
      }
      updates.push('traffic_limit_gb=?')
      params.push(body.traffic_limit_gb ?? null)
    }
    if (body.features !== undefined) {
      if (body.features != null && !Array.isArray(body.features)) {
        return c.json({ error: 'invalid_features', field: 'features' }, 400)
      }
      updates.push('features=?')
      params.push(body.features ? JSON.stringify(body.features) : null)
    }
    if (body.is_active !== undefined) {
      updates.push('is_active=?')
      params.push(body.is_active ? 1 : 0)
    }
    if (updates.length) {
      db.prepare(`UPDATE plans SET ${updates.join(', ')} WHERE id=?`).run(...params, id)
    }
    const row = db.prepare('SELECT * FROM plans WHERE id=?').get(id)
    const plan = {
      ...row,
      features: row.features ? JSON.parse(row.features) : [],
      is_active: Boolean(row.is_active),
    }
    return c.json(plan)
  })

  app.delete('/api/admin/plans/:id', requireAuth, requireAdmin, (c) => {
    const id = Number(c.req.param('id'))
    db.prepare('UPDATE plans SET is_active=0 WHERE id=?').run(id)
    return c.json({ ok: true })
  })

  app.post('/api/admin/plans/:id/activate', requireAuth, requireAdmin, (c) => {
    const id = Number(c.req.param('id'))
    db.prepare('UPDATE plans SET is_active=1 WHERE id=?').run(id)
    return c.json({ ok: true })
  })

  app.get('/r/:code', (c) => {
    const code = c.req.param('code')
    const row = db.prepare('SELECT code FROM affiliates WHERE code=?').get(code)
    if (row) {
      const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''
      const ua = c.req.header('user-agent') || ''
      db.prepare('INSERT INTO affiliate_events (code, type, ip, ua) VALUES (?, ?, ?, ?)').run(code, 'click', ip, ua)
      setCookie(c, 'aff_code', code, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'None',
        secure: true,
      })
      return c.redirect('/register')
    }
    return c.redirect('/pricing')
  })

  app.get('/api/aff/me', requireAuth, (c) => {
    const user: any = c.get('user')
    let row = db.prepare('SELECT code FROM affiliates WHERE user_id=?').get(user.sub)
    if (!row) {
      const code = genAffCode()
      db.prepare('INSERT INTO affiliates (user_id, code) VALUES (?, ?)').run(user.sub, code)
      row = { code }
    }
    const statsRows = db
      .prepare('SELECT type, COUNT(*) as cnt, SUM(amount_cents) as amt FROM affiliate_events WHERE code=? GROUP BY type')
      .all(row.code)
    let clicks = 0,
      signups = 0,
      earnings = 0
    for (const s of statsRows) {
      if (s.type === 'click') clicks = s.cnt
      else if (s.type === 'signup') signups = s.cnt
      else if (s.type === 'purchase') earnings = s.amt || 0
    }
    return c.json({
      code: row.code,
      share_url: `https://dashboard.zerologsvpn.com/r/${row.code}`,
      stats: { clicks, signups, earnings_cents: earnings || 0 },
    })
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
