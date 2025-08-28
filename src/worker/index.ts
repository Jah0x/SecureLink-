/* eslint-disable */
// @ts-nocheck
import { Hono } from 'hono'
import { serveStatic } from '@hono/node-server/serve-static'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { users, plans, subscriptions, affiliates, affiliateClicks, affiliateLinks, affiliateStats } from '../db/schema'
import { eq, inArray, desc, sql, and, gte, lte } from 'drizzle-orm'
import { z } from 'zod'
import { mapPlanRow } from '../server/mappers/plan'
import * as subs from '../lib/subsClient'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import { getDb } from '../db'

let migrated = false
let adminsSynced = false

async function runMigrations(db: any) {
  if (migrated || process.env.MIGRATE_ON_BOOT !== '1') return
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  await migrate(db, { migrationsFolder: './drizzle' })
  const { seedFirstAdmin } = await import('../db/seedAdmin')
  await seedFirstAdmin(db)
  migrated = true
}

async function syncAdmins(db: any) {
  if (adminsSynced || AUTH_MODE !== 'internal') return
  adminsSynced = true
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

const PlanInput = z.object({
  name: z.string().min(1),
  price_cents: z.number().int().nonnegative(),
  periodDays: z.number().int().positive(),
  trafficMb: z.number().int().positive().nullable(),
  active: z.boolean(),
  is_demo: z.boolean().optional(),
})

async function requireDb(c: any, next: any) {
  const db = getDb()
  if (!db) return c.json({ error: 'DB not configured' }, 503)
  await runMigrations(db)
  await syncAdmins(db)
  c.set('db', db)
  await next()
}

const app = new Hono()

app.onError((err, c) => {
  console.error('API error', {
    method: c.req.method,
    url: c.req.url,
    stack: err.stack,
  })
  return c.json({ type: 'about:blank', title: 'Internal Server Error', status: 500, code: 'internal_error' }, 500)
})

// ---------- utils/env ----------
const AUTH_BASE = process.env.AUTH_BASE_URL
const AUTH_MODE = process.env.AUTH_MODE || (AUTH_BASE ? 'proxy' : 'internal')

const PATH_REGISTER = process.env.AUTH_PATH_REGISTER || '/users/register'
const PATH_LOGIN    = process.env.AUTH_PATH_LOGIN    || '/users/login'
const PATH_ME       = process.env.AUTH_PATH_ME       || '/users/me'
const PATH_LOGOUT   = process.env.AUTH_PATH_LOGOUT   || '/users/logout'

const SESSION_COOKIE_NAME   = process.env.SESSION_COOKIE_NAME || 'session_token'
const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN
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

const SESSION_COOKIE_OPTS = SESSION_COOKIE_DOMAIN ? { domain: SESSION_COOKIE_DOMAIN, path: '/' } : { path: '/' }

function setSessionCookie(c: any, token: string, maxAge = SESSION_COOKIE_MAXAGE) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTS,
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: SESSION_COOKIE_SAMESITE,
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
    const db = getDb()
    if (!db) return c.json({ error: 'DB not configured' }, 503)
    await runMigrations(db)
    await syncAdmins(db)
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
    const db = getDb()
    if (!db) return c.json({ error: 'DB not configured' }, 503)
    await runMigrations(db)
    await syncAdmins(db)
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
      deleteCookie(c, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTS)
      return new Response(await r.text(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/json' } })
    }
    deleteCookie(c, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTS)
    return c.json({ ok: true })
  } catch (e:any) {
    console.error('logout error', e)
    deleteCookie(c, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTS)
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
  async function genAffCode(db: any) {
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

  app.get('/api/users/me', requireAuth, requireDb, async (c) => {
    const db = c.get('db')
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

  app.get('/api/admin/ping', requireAuth, requireAdmin, requireDb, (c) => c.json({ ok: true }))

  app.get('/api/admin/users', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const rows = await db
      .select({ id: users.id, email: users.email, role: users.role, createdAt: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt))
    return c.json(rows)
  })

  app.post('/api/admin/users', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
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

  app.get('/api/pricing', requireDb, async (c) => {
    const db = c.get('db')
    const rows = await db
      .select()
      .from(plans)
      .where(eq(plans.is_active, true))
      .orderBy(desc(plans.id))
    return c.json(rows.map(mapPlanRow))
  })

  app.get('/api/admin/plans', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const offset = Number(c.req.query('offset') || '0')
    const limit = Number(c.req.query('limit') || '50')
    const q = (c.req.query('active') || 'all').toLowerCase()
    let condition
    if (['1', 'true', 'active'].includes(q)) condition = eq(plans.is_active, true)
    else if (['0', 'false', 'inactive'].includes(q)) condition = eq(plans.is_active, false)
    let query = db.select().from(plans)
    if (condition) query = query.where(condition)
    const rows = await query.orderBy(desc(plans.id)).limit(limit).offset(offset)
    return c.json(rows.map(mapPlanRow))
  })

  app.get('/api/admin/plans/:id', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const id = Number(c.req.param('id'))
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    const plan = rows[0]
    if (!plan) return c.json({ error: 'not_found' }, 404)
    return c.json(mapPlanRow(plan))
  })

  app.post('/api/admin/plans', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const body = await c.req.json()
    const parsed = PlanInput.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', details: parsed.error.flatten() }, 400)
    }
    const data = parsed.data
    const inserted = await db
      .insert(plans)
      .values({
        name: data.name,
        price_cents: data.is_demo ? 0 : data.price_cents,
        period_days: data.periodDays,
        traffic_mb: data.trafficMb,
        is_active: data.active,
        is_demo: data.is_demo ?? false,
      })
      .returning()
    return c.json(mapPlanRow(inserted[0]), 201)
  })

  app.put('/api/admin/plans/:id', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const id = Number(c.req.param('id'))
    const body = await c.req.json()
    const parsed = PlanInput.partial().safeParse(body)
    if (!parsed.success) {
      return c.json({ error: 'invalid_input', details: parsed.error.flatten() }, 400)
    }
    const data = parsed.data
    const updates: any = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.price_cents !== undefined) updates.price_cents = data.price_cents
    if (data.periodDays !== undefined) updates.period_days = data.periodDays
    if (data.trafficMb !== undefined) updates.traffic_mb = data.trafficMb
    if (data.active !== undefined) updates.is_active = data.active
    if (data.is_demo !== undefined) {
      updates.is_demo = data.is_demo
      if (data.is_demo) updates.price_cents = 0
    }
    if (Object.keys(updates).length) {
      updates.updated_at = new Date()
      await db.update(plans).set(updates).where(eq(plans.id, id))
    }
    const rows = await db.select().from(plans).where(eq(plans.id, id)).limit(1)
    const plan = rows[0]
    if (!plan) return c.json({ error: 'not_found' }, 404)
    return c.json(mapPlanRow(plan))
  })

  app.delete('/api/admin/plans/:id', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const id = Number(c.req.param('id'))
    await db.update(plans).set({ is_active: false, updated_at: new Date() }).where(eq(plans.id, id))
    return c.json({ ok: true })
  })

  app.post('/api/admin/plans/:id/activate', requireAuth, requireAdmin, requireDb, async (c) => {
    const db = c.get('db')
    const id = Number(c.req.param('id'))
    await db.update(plans).set({ is_active: true, updated_at: new Date() }).where(eq(plans.id, id))
    return c.json({ ok: true })
  })

  app.post('/api/demo', requireAuth, requireDb, async (c) => {
    const db = c.get('db')
    const user = c.get('user')
    const demoPlanRows = await db
      .select()
      .from(plans)
      .where(and(eq(plans.is_demo, true), eq(plans.is_active, true)))
      .limit(1)
    const plan = demoPlanRows[0]
    if (!plan) return c.json({ error: 'no_demo_plan' }, 404)
    const existing = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, user.sub), eq(subscriptions.planId, plan.id)))
      .limit(1)
    if (existing.length) return c.json({ error: 'already_used_demo' }, 403)
    const expiresAt = new Date(Date.now() + Number(plan.period_days) * 24 * 3600 * 1000)
    await db.insert(subscriptions).values({ userId: user.sub, planId: plan.id, expiresAt })
    return c.json({ ok: true }, 201)
  })

  if (FEATURE_REFERRALS) {
    app.get('/api/admin/affiliates', requireAuth, requireAdmin, requireDb, async (c) => {
      const db = c.get('db')
      const rows = await db.select().from(affiliates).orderBy(desc(affiliates.id))
      return c.json(rows)
    })

    app.get('/r/:code', requireDb, async (c) => {
      const db = c.get('db')
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

    app.get('/api/aff/me', requireAuth, requireDb, async (c) => {
      const db = c.get('db')
      const user: any = c.get('user')
      let rows = await db.select().from(affiliates).where(eq(affiliates.ownerUserId, user.sub)).limit(1)
      let aff = rows[0]
      if (!aff) {
        const code = await genAffCode(db)
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
      const origin =
        process.env.PUBLIC_APP_ORIGIN ||
        (new URL(c.req.url)).origin

      return c.json({
        code: aff.code,
        share_url: `${origin}/r/${aff.code}`,
        stats: { clicks, signups: 0, earnings_cents: 0 },
      })
    })

    app.get('/api/aff/stats', requireAuth, requireDb, async (c) => {
      const db = c.get('db')
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

// ---------- subs proxy routes
const subsRate = new Map<string,{count:number,reset:number}>()
async function subsRateLimit(c: any, next: any) {
  const user: any = c.get('user')
  const now = Date.now()
  let rec = subsRate.get(user.email)
  if (!rec || now > rec.reset) { rec = { count: 0, reset: now + 60_000 } }
  if (rec.count >= 5) return c.json({ error: { code: 'rate_limited', message: 'Too many requests' } }, 429)
  rec.count++; subsRate.set(user.email, rec); await next()
}
function ownsLogin(c: any, login: string) {
  const user: any = c.get('user')
  return user.role === 'admin' || user.email === login
}
function handleSubsError(c: any, e: any) {
  if (e instanceof subs.SubsError && [401,403,404,409].includes(e.status)) {
    return c.json({ error: { code: e.code, message: e.message } }, e.status)
  }
  console.error('subs proxy error', e)
  return c.json({ error: { code: 'subs_error', message: 'subs error' } }, 502)
}

app.post('/api/subs/assign', requireAuth, subsRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (body.uid) return c.json({ error: { code: 'uid_not_allowed', message: 'uid not allowed' } }, 400)
  const parsed = z.object({ login: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: { code: 'invalid_input' } }, 400)
  if (!ownsLogin(c, parsed.data.login)) return c.json({ error: 'forbidden' }, 403)
  try {
    const r = await subs.assign(parsed.data.login)
    return c.json(r)
  } catch (e) { return handleSubsError(c, e) }
})

app.post('/api/subs/reassign', requireAuth, subsRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  if (body.uid) return c.json({ error: { code: 'uid_not_allowed', message: 'uid not allowed' } }, 400)
  const parsed = z.object({ login: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: { code: 'invalid_input' } }, 400)
  if (!ownsLogin(c, parsed.data.login)) return c.json({ error: 'forbidden' }, 403)
  try {
    const r = await subs.reassign(parsed.data.login)
    return c.json(r)
  } catch (e) { return handleSubsError(c, e) }
})

app.post('/api/subs/revoke', requireAuth, subsRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const parsed = z.object({ login: z.string() }).safeParse(body)
  if (!parsed.success) return c.json({ error: { code: 'invalid_input' } }, 400)
  if (!ownsLogin(c, parsed.data.login)) return c.json({ error: 'forbidden' }, 403)
  try {
    await subs.revoke(parsed.data.login)
    return c.body(null, 204)
  } catch (e) { return handleSubsError(c, e) }
})

app.get('/api/subs/status', requireAuth, async (c) => {
  const login = c.req.query('login')
  if (!login) return c.json({ error: { code: 'login_required' } }, 400)
  if (!ownsLogin(c, login)) return c.json({ error: 'forbidden' }, 403)
  try {
    const r = await subs.statusByLogin(login)
    return c.json(r)
  } catch (e) { return handleSubsError(c, e) }
})

app.get('/api/subs/link', requireAuth, async (c) => {
  const login = c.req.query('login')
  const fmt = c.req.query('fmt') as 'plain' | 'b64' | undefined
  if (!login || !fmt) return c.json({ error: { code: 'invalid_input' } }, 400)
  if (!ownsLogin(c, login)) return c.json({ error: 'forbidden' }, 403)
  try {
    const txt = await subs.subLink({ login }, fmt)
    return c.text(txt)
  } catch (e) { return handleSubsError(c, e) }
})

app.get('/api/subs/qrcode', requireAuth, async (c) => {
  const login = c.req.query('login')
  if (!login) return c.json({ error: { code: 'login_required' } }, 400)
  if (!ownsLogin(c, login)) return c.json({ error: 'forbidden' }, 403)
  try {
    const buf = await subs.qrcode({ login })
    return new Response(buf, { headers: { 'content-type': 'image/png' } })
  } catch (e) { return handleSubsError(c, e) }
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

export { app }
export default app
