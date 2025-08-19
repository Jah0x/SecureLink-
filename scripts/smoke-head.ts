import http from 'node:http';
import { spawn } from 'node:child_process';

function head(path: string) {
  return new Promise<http.IncomingHttpHeaders>((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: 5173, path, method: 'HEAD' }, (rs) => res(rs.headers));
    r.on('error', rej);
    r.end();
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const server = spawn('node', ['dist/server/index.js'], { stdio: 'inherit' });
  try {
    let headers: http.IncomingHttpHeaders | null = null;
    for (let i = 0; i < 20; i++) {
      try {
        headers = await head('/');
        break;
      } catch {
        await sleep(500);
      }
    }
    if (!headers) {
      console.error('Server did not start on port 5173');
      process.exitCode = 1;
      return;
    }
    const ct = String(headers['content-type'] || '');
    if (!/text\/html/i.test(ct)) {
      console.error('Expected text/html at "/", got:', ct);
      process.exitCode = 1;
      return;
    }
    console.log('HEAD / OK:', ct);
  } finally {
    server.kill();
  }
})();
