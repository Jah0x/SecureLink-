/* eslint-disable */
// @ts-nocheck
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { db } from '@/db/client'
import { users, plans, planFeatures, affiliates, affiliateClicks, affiliateLinks, affiliateStats } from '@/db/schema'
import { seedFirstAdmin } from '@/db/seedAdmin'
import { eq, inArray, desc, sql, and, gte, lte } from 'drizzle-orm'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator'
import { migrate as migrateSqlite } from 'drizzle-orm/better-sqlite3/migrator'

const app = new Hono()

app.onError((err, c) => {
  console.error('API error', {
    method: c.req.method,
    url: c.req.url,
    stack: err.stack,
  })
  return c.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, 500)
})

const DB_URL = process.env.DB || ''
if (DB_URL.startsWith('postgres')) {
  await migratePg(db, { migrationsFolder: './drizzle' })
} else {
  await migrateSqlite(db, { migrationsFolder: './drizzle' })
}

await seedFirstAdmin()

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
const FEATURE_REFERRALS = String(process.env.FEATURE_REFERRALS || 'true') === 'true'

function authUrl(path: string) {
  if (!AUTH_BASE) throw new Error('AUTH_BASE_URL is not set')
  return new URL(path, AUTH_BASE)
}

if (AUTH_MODE === 'internal') {
  fsSync.mkdirSync('/app/data', { recursive: true })
  if (ADMIN_EMAILS.length) {
    await db
      .update(users)
      .set({ role: 'admin' })
      .where(inArray(users.email, ADMIN_EMAILS))
  }
  if (FIRST_USER_ADMIN) {
    const regular = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'user'))
    if (regular.length === 1) {
      await db
        .update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, regular[0].id))
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
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing.length) return c.json({ error: 'user_exists' }, 400)
    const hash = await argon2.hash(password, { type: argon2.argon2id })
    const inserted = await db
      .insert(users)
      .values({ email, passwordHash: hash })
      .returning({ id: users.id, role: users.role, email: users.email })
    const user = inserted[0]
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
    const rows = await db
      .select({ id: users.id, passwordHash: users.passwordHash, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    const row = rows[0]
    if (!row) return c.json({ error: 'invalid_credentials' }, 401)
    const ok = await argon2.verify(row.passwordHash, password)
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
  async function genAffCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    while (true) {
      const len = 6 + Math.floor(Math.random() * 3)
      let code = ''
      for (let i = 0; i < len; i++) code += chars[Math.floor(Math.random() * chars.length)]
      const exists = await db
        .select({ id: affiliates.id })
        .from(affiliates)
        .where(eq(affiliates.code, code))
        .limit(1)
      if (!exists.length) return code
    }
  }

  app.get('/api/users/me', requireAuth, async (c) => {
    const user: any = c.get('user')
    const rows = await db
      .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, user.sub))
      .limit(1)
    const row = rows[0]
    if (!row) return c.json({ error: 'unauthorized' }, 401)
    return c.json(row)
  })

  app.get('/api/admin/ping', requireAuth, requireAdmin, (c) => c.json({ ok: true }))

  app.get('/api/admin/users', requireAuth, requireAdmin, async (c) => {
    const rows = await db
      .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt))
    return c.json(rows)
  })

  app.post('/api/admin/users', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json()
    const { email, password, role = 'user' } = body || {}
    if (!email || !password) return c.json({ error: 'invalid_input' }, 400)
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing.length) return c.json({ error: 'user_exists' }, 400)
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const inserted = await db
      .insert(users)
      .values({ email, passwordHash, role })
      .returning({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
    return c.json(inserted[0], 201)
  })

  app.get('/api/plans', async (c) => {
    const rows = await db
      .select()
      .from(plans)
      .where(eq(plans.active, true))
      .orderBy(desc(plans.id))
    return c.json(rows)
  })

  app.get('/api/admin/plans', requireAuth, requireAdmin, async (c) => {
    const offset = Number(c.req.query('offset') || '0')
    const limit = Number(c.req.query('limit') || '50')
    const q = (c.req.query('active') || 'all').toLowerCase()
    let condition
    if (['1', 'true', 'active'].includes(q)) condition = eq(plans.active, true)
    else if (['0', 'false', 'inactive'].includes(q)) condition = eq(plans.active, false)
    let query = db.select().from(plans)
    if (condition) query = query.where(condition)
    const rows = await query.orderBy(desc(plans.id)).limit(limit).offset(offset)
    return c.json(rows)
  })

  app.get('/api/admin/plans/:id', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    const plan = rows[0]
    if (!plan) return c.json({ error: 'not_found' }, 404)
    return c.json(plan)
  })

  app.post('/api/admin/plans', requireAuth, requireAdmin, async (c) => {
    const body = await c.req.json()
    const { name, price_cents, active = true } = body || {}
    if (!name || name.length < 1 || name.length > 100) {
      return c.json({ error: 'invalid_name', field: 'name' }, 400)
    }
    if (!Number.isInteger(price_cents) || price_cents <= 0) {
      return c.json({ error: 'invalid_price', field: 'price_cents' }, 400)
    }
    const inserted = await db
      .insert(plans)
      .values({ name, priceCents: price_cents, active })
      .returning()
    return c.json(inserted[0], 201)
  })

  app.put('/api/admin/plans/:id', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const updates: any = {}
    if (body.name !== undefined) {
      if (!body.name || body.name.length < 1 || body.name.length > 100) {
        return c.json({ error: 'invalid_name', field: 'name' }, 400)
      }
      updates.name = body.name
    }
    if (body.price_cents !== undefined) {
      if (!Number.isInteger(body.price_cents) || body.price_cents <= 0) {
        return c.json({ error: 'invalid_price', field: 'price_cents' }, 400)
      }
      updates.priceCents = body.price_cents
    }
    if (body.active !== undefined) {
      updates.active = !!body.active
    }
    if (Object.keys(updates).length) {
      await db.update(plans).set(updates).where(eq(plans.id, id))
    }
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    const plan = rows[0]
    if (!plan) return c.json({ error: 'not_found' }, 404)
    return c.json(plan)
  })

  app.delete('/api/admin/plans/:id', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    await db.update(plans).set({ active: false }).where(eq(plans.id, id))
    return c.json({ ok: true })
  })

  app.post('/api/admin/plans/:id/activate', requireAuth, requireAdmin, async (c) => {
    const id = Number(c.req.param('id'))
    await db.update(plans).set({ active: true }).where(eq(plans.id, id))
    return c.json({ ok: true })
  })

  if (FEATURE_REFERRALS) {
    app.get('/api/admin/affiliates', requireAuth, requireAdmin, async (c) => {
      const rows = await db.select().from(affiliates).orderBy(desc(affiliates.id))
      return c.json(rows)
    })

    app.get('/r/:code', async (c) => {
      const code = c.req.param('code')
      const rows = await db.select().from(affiliates).where(eq(affiliates.code, code)).limit(1)
      const row = rows[0]
      if (row) {
        await db.insert(affiliateClicks).values({ affiliateId: row.id })
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

    app.get('/api/aff/me', requireAuth, async (c) => {
      const user: any = c.get('user')
      let rows = await db.select().from(affiliates).where(eq(affiliates.ownerUserId, user.sub)).limit(1)
      let aff = rows[0]
      if (!aff) {
        const code = await genAffCode()
        const inserted = await db
          .insert(affiliates)
          .values({ ownerUserId: user.sub, code })
          .returning()
        aff = inserted[0]
      }
      const clicksRes = await db
        .select({ cnt: sql<number>`count(*)` })
        .from(affiliateClicks)
        .where(eq(affiliateClicks.affiliateId, aff.id))
      const clicks = clicksRes[0]?.cnt || 0
      return c.json({
        code: aff.code,
        share_url: `https://dashboard.zerologsvpn.com/r/${aff.code}`,
        stats: { clicks, signups: 0, earnings_cents: 0 },
      })
    })

    app.get('/api/aff/stats', requireAuth, async (c) => {
      const user: any = c.get('user')
      const fromStr = c.req.query('from')
      const toStr = c.req.query('to')
      const offset = Number(c.req.query('offset') || '0')
      const limit = Number(c.req.query('limit') || '30')
      const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 1000 * 60 * 60 * 24 * 30)
      const to = toStr ? new Date(toStr) : new Date()
      const affRows = await db
        .select()
        .from(affiliates)
        .where(eq(affiliates.ownerUserId, user.sub))
        .limit(1)
      const aff = affRows[0]
      if (!aff) return c.json([])
      const rows = await db
        .select({
          day: sql`date(${affiliateStats.createdAt})`,
          earnings: sql<number>`sum(${affiliateStats.earningsCents})`,
        })
        .from(affiliateStats)
        .where(
          and(
            eq(affiliateStats.refId, aff.id),
            gte(affiliateStats.createdAt, from),
            lte(affiliateStats.createdAt, to)
          )
        )
        .groupBy(sql`date(${affiliateStats.createdAt})`)
        .orderBy(sql`date(${affiliateStats.createdAt})`)
        .limit(limit)
        .offset(offset)
      return c.json(rows)
    })
  }
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
