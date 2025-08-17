import http from 'node:http';
import { Readable } from 'node:stream';
import { URL } from 'node:url';
import * as workerMod from '../worker/index';

const port = parseInt(process.env.PORT || '5173', 10);

// поддерживаем разные варианты экспорта из worker
const fetchFn: any =
  (workerMod as any).fetch ||
  (workerMod as any).default?.fetch ||
  (workerMod as any).default;

if (typeof fetchFn !== 'function') {
  console.error('[server] No fetch() found in ../worker/index');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/healthz') {
      res.writeHead(200);
      res.end('ok');
      return;
    }

    const u = new URL(req.url || '/', `http://${req.headers.host}`);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else if (v != null) headers.set(k, String(v));
    }

    const method = req.method || 'GET';
    const body =
      method === 'GET' || method === 'HEAD'
        ? undefined
        : (Readable as any).toWeb?.(req);

    const request = new Request(u.toString(), { method, headers, body });
    const response: any = await fetchFn(request);

    const status = response?.status ?? 200;
    const respHeaders = Object.fromEntries(response?.headers ?? []);
    res.writeHead(status, respHeaders);

    if (response?.body) {
      const nodeStream = (Readable as any).fromWeb?.(response.body);
      if (nodeStream) nodeStream.pipe(res);
      else res.end(await response.text?.());
    } else {
      res.end();
    }
  } catch (e) {
    console.error('[server] error', e);
    res.writeHead(500);
    res.end('internal error');
  }
});

server.listen(port, () =>
  console.log(`[server] listening on :${port}`)
);
