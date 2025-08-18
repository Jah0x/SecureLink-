import express from 'express'
import path from 'path'
import { pathToFileURL } from 'url'

const app = express()
app.use(express.json())

app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// нативный dynamic import, чтобы tsc не превратил в require()
const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>

// helper: собираем Headers из express-headers
function toHeaders(h: any) {
  const out = new Headers()
  for (const [k, v] of Object.entries(h || {})) {
    if (v == null) continue
    out.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  return out
}

async function bufferBody(req: any): Promise<Uint8Array | string | undefined> {
  const m = req.method
  if (m === 'GET' || m === 'HEAD') return undefined

  if (req.is?.('application/json')) {
    return JSON.stringify(req.body ?? {})
  }

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: any) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  return Buffer.concat(chunks)
}

/** fallback-адаптер: подключает Hono-приложение к Express без зависимостей от hono/adapter */
function honoAsExpress(honoApp: { fetch: (req: Request) => Promise<Response> }) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`
      const headers = toHeaders(req.headers)
      const body = await bufferBody(req)

      const request = new Request(url, {
        method: req.method,
        headers,
        body,
      })
      const resp = await honoApp.fetch(request as any)

      // заголовки/статус/тело обратно в Express
      res.status(resp.status)
      resp.headers.forEach((val, key) => res.setHeader(key, val))
      const ab = await resp.arrayBuffer()
      if (ab.byteLength) res.send(Buffer.from(ab))
      else res.end()
    } catch (e) {
      console.error('[server] honoAsExpress error:', e)
      next(e)
    }
  }
}

async function mountWorker() {
  try {
    const workerPath = path.join(__dirname, '..', 'worker', 'index.js')
    const mod: any = await dynamicImport(pathToFileURL(workerPath).href)

    const honoApp = (mod.app ?? mod.default) && typeof (mod.app ?? mod.default).fetch === 'function'
      ? (mod.app ?? mod.default)
      : (typeof mod.fetch === 'function' ? { fetch: mod.fetch.bind(mod) } : null)

    if (!honoApp) {
      console.warn('[server] worker found but no app/fetch exports')
      return
    }

    // 1) пробуем официальный адаптер, если есть
    try {
      const m = await dynamicImport('hono/adapter')
      if (m && typeof m.handle === 'function') {
        app.use(m.handle(honoApp))
        console.log('[server] mounted Hono app via hono/adapter')
        return
      }
    } catch { /* игнорируем, перейдём на fallback */ }

    // 2) fallback-адаптер (устойчив к изменениям API Hono)
    app.use(honoAsExpress(honoApp))
    console.log('[server] mounted Hono app via fallback adapter')
  } catch (e: any) {
    console.warn('[server] worker import failed:', e?.message || e)
  }
}

const port = Number(process.env.PORT || 5173)
;(async () => {
  await mountWorker() // API
  const clientDir = path.join(__dirname, '..', 'client')
  app.use(express.static(clientDir))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')))
  app.listen(port, () => console.log(`listening on :${port}`))
})()

