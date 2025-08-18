import express from 'express'
import path from 'path'
import { pathToFileURL } from 'url'

const app = express()
app.use(express.json())

app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// нативный dynamic import, чтобы tsc не превратил в require()
const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>

/** fallback-адаптер: подключает Hono-приложение к Express без зависимостей от hono/adapter */
function honoAsExpress(honoApp: { fetch: (req: Request) => Promise<Response> }) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`

      // перенесём заголовки
      const headers = new Headers()
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) headers.set(k, v.join(','))
        else if (v !== undefined) headers.set(k, String(v))
      }

      // тело: для JSON восстановим строку из распарсенного body
      const method = req.method
      const bodyAllowed = method !== 'GET' && method !== 'HEAD'
      let body: any = undefined
      const ct = (req.headers['content-type'] || '') as string
      if (bodyAllowed) {
        if (ct.includes('application/json')) body = JSON.stringify(req.body ?? {})
        else body = (req as any) // отдадим поток, если вдруг нужен raw
      }

      const request = new Request(url, { method, headers, body })
      const resp = await honoApp.fetch(request)

      // заголовки/статус/тело обратно в Express
      res.status(resp.status)
      resp.headers.forEach((val, key) => res.setHeader(key, val))
      const ab = await resp.arrayBuffer()
      if (ab.byteLength) res.send(Buffer.from(ab))
      else res.end()
    } catch (e) {
      console.error('[server] honoAsExpress error:', e)
      res.status(500).end()
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

