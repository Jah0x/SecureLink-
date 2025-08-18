import express from 'express'
import path from 'path'
import { pathToFileURL } from 'url'

const app = express()
app.use(express.json())

// health
app.get('/healthz', (_req, res) => res.status(200).send('ok'))

// ГАРАНТИРОВАННО нативный dynamic import, чтобы TSC НЕ превратил import() в require()
const dynamicImport = new Function('p', 'return import(p)') as (p: string) => Promise<any>

async function mountWorker() {
  try {
    const workerPath = path.join(__dirname, '..', 'worker', 'index.js')
    const mod: any = await dynamicImport(pathToFileURL(workerPath).href)

    const honoApp = mod.app || mod.default || null

    if (honoApp && typeof honoApp.fetch === 'function') {
      const { handle } = await dynamicImport('hono/adapter')
      app.use(handle(honoApp))
      console.log('[server] mounted Hono app from worker on /')
      return
    }

    if (typeof mod.fetch === 'function') {
      const { handle } = await dynamicImport('hono/adapter')
      app.use(handle({ fetch: mod.fetch.bind(mod) } as any))
      console.log('[server] mounted fetch() from worker on /')
      return
    }

    console.warn('[server] worker found but no app/fetch exports')
  } catch (e: any) {
    console.warn('[server] worker import failed:', e?.message || e)
  }
}

const port = Number(process.env.PORT || 5173)
;(async () => {
  // 1) СНАЧАЛА подключаем API (worker)
  await mountWorker()

  // 2) ПОТОМ — статику и SPA fallback
  const clientDir = path.join(__dirname, '..', 'client')
  app.use(express.static(clientDir))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDir, 'index.html'))
  })

  app.listen(port, () => console.log(`listening on :${port}`))
})()

