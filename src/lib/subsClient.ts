
const base = process.env.SUBS_API_BASE
if (!base) console.warn('SUBS_API_BASE is not set')
function getWriteToken() { return process.env.SUBS_API_TOKEN }
function getReadToken() { return process.env.SUBS_API_READONLY_TOKEN || getWriteToken() }

class SubsError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function subsFetch(path: string, init: RequestInit = {}, token = getWriteToken()) {
  if (!base) throw new SubsError(500, 'subs_not_configured', 'subs not configured')
  const url = new URL(path, base)
  const res = await fetch(url, {
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      authorization: token ? `Bearer ${token}` : '',
      ...(init.headers || {}),
    },
    ...init,
  })
  if (!res.ok) {
    let err: any = { code: 'subs_error', message: 'subs error' }
    try {
      const data = await res.json()
      err = data.error || data
    } catch {
      try {
        err.message = await res.text()
      } catch {}
    }
    throw new SubsError(res.status, err.code || 'subs_error', err.message || 'subs error')
  }
  return res
}

export async function assign(login: string) {
  const body = JSON.stringify({ login })
  const res = await subsFetch('/v1/assign', { method: 'POST', body })
  return res.json()
}

export async function reassign(login: string) {
  const body = JSON.stringify({ login })
  const res = await subsFetch('/v1/reassign', { method: 'POST', body })
  return res.json()
}

export async function revoke(login: string) {
  const body = JSON.stringify({ login })
  const res = await subsFetch('/v1/revoke', { method: 'POST', body })
  return res
}

export async function statusByLogin(login: string) {
  const res = await subsFetch(`/v1/status?login=${encodeURIComponent(login)}`, { method: 'GET' }, getReadToken())
  return res.json()
}

export async function statusByUid(uid: string) {
  const res = await subsFetch(`/v1/status?uid=${encodeURIComponent(uid)}`, { method: 'GET' }, getReadToken())
  return res.json()
}

export async function subLink(loginOrUid: { login?: string; uid?: string }, fmt: 'plain' | 'b64') {
  const params = new URLSearchParams({ fmt })
  if (loginOrUid.login) params.set('login', loginOrUid.login)
  if (loginOrUid.uid) params.set('uid', loginOrUid.uid)
  const res = await subsFetch(`/v1/sub?${params.toString()}`, { method: 'GET' }, getReadToken())
  return res.text()
}

export async function qrcode(loginOrUid: { login?: string; uid?: string }) {
  const params = new URLSearchParams()
  if (loginOrUid.login) params.set('login', loginOrUid.login)
  if (loginOrUid.uid) params.set('uid', loginOrUid.uid)
  const res = await subsFetch(`/v1/qrcode?${params.toString()}`, { method: 'GET' }, getReadToken())
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

export { SubsError }
