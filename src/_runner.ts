import { serve } from '@hono/node-server';
/* eslint-disable @typescript-eslint/no-explicit-any */

// Загружаем Hono app из одного из типичных путей.
// В проекте должен экспортироваться объект `app` с методом .fetch
async function loadApp() {
  const candidates = [
    './server/index',
    './server/app',
    './server',
  ];
  for (const p of candidates) {
    try {
      const mod = await import(p);
      const app = (mod as any)?.app ?? (mod as any)?.default ?? mod;
      if (app?.fetch) return app;
    } catch {
      // пробуем следующий
    }
  }
  throw new Error('Hono app not found: expected export `app` with .fetch');
}

(async () => {
  // Если очень нужно уметь мигрировать в рантайме — оставим «рычаг»:
  // MIGRATE_ON_BOOT=1 заставит выполнить миграции, иначе пропускаем.
  if (process.env.MIGRATE_ON_BOOT === '1') {
    try {
      const m = await import('./worker/index');
      if (typeof (m as any)?.safeMigrate === 'function') {
        console.log('[db] running safeMigrate() because MIGRATE_ON_BOOT=1');
        await (m as any).safeMigrate();
      } else if (typeof (m as any)?.default === 'function') {
        console.log('[db] running default migrate() because MIGRATE_ON_BOOT=1');
        await (m as any).default();
      } else {
        console.log('[db] migrate entry not found, skipping...');
      }
    } catch (e) {
      console.error('[db] migrate error:', e);
      process.exit(1);
    }
  } else {
    console.log('[db] runtime migrations are disabled (MIGRATE_ON_BOOT!=1)');
  }

  const app = await loadApp();
  const port = Number(process.env.PORT ?? '5173');
  serve(
    { fetch: app.fetch, hostname: '0.0.0.0', port },
    (info) => console.log(`[server] listening on http://${info.address}:${info.port}`)
  );
})();
