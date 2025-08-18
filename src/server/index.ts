import express from 'express'
import path from 'path'
import { pathToFileURL } from 'url'

const app = express()
app.use(express.json())

// health
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// ВАЖНО: нативный dynamic import, чтобы tsc не сделал require()
const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>

/**
 * Монтируем Hono-worker из dist/worker/index.js
 * Worker собран как ESM (с TLA), поэтому используем dynamic import() + hono/adapter.
 * Поддерживаем варианты экспорта:
 *  - app (Hono instance с .fetch)
 *  - default (Hono instance)
 *  - fetch (standalone handler)
 */
async function mountWorker() {
  try {
    const workerPath = path.join(__dirname, '..', 'worker', 'index.js') // dist/server -> dist/worker
    const workerUrl = pathToFileURL(workerPath).href
    const mod: any = await dynamicImport(workerUrl)

    const maybeApp = mod.app || mod.default || null
    if (maybeApp && typeof maybeApp.fetch === 'function') {
      const { handle } = (await dynamicImport('hono/adapter') as any)
      if (typeof handle === 'function') {
        app.use(handle(maybeApp))
        console.log('[server] mounted Hono app from worker on /')
        return
      }
    }

    if (typeof mod.fetch === 'function') {
      const { handle } = (await dynamicImport('hono/adapter') as any)
      if (typeof handle === 'function') {
        app.use(handle({ fetch: mod.fetch.bind(mod) } as any))
        console.log('[server] mounted fetch() from worker on /')
        return
      }
    }

    console.warn('[server] worker found but no app/fetch exports')
  } catch (e: any) {
    console.warn('[server] worker import failed:', e?.message || e)
  }
}

// Запуск после монтирования worker-а
const port = Number(process.env.PORT || 5173)
;(async () => {
  await mountWorker()                                   // 1) сначала API
  const clientDir = path.join(__dirname, '..', 'client')// 2) потом статика
  app.use(express.static(clientDir))
  app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')))
  app.listen(port, () => console.log(`listening on :${port}`))
})()
