import http from 'node:http';
function head(path: string) {
  return new Promise<http.IncomingHttpHeaders>((res, rej) => {
    const r = http.request({ host: '127.0.0.1', port: 5173, path, method: 'HEAD' }, (rs) => res(rs.headers));
    r.on('error', rej); r.end();
  });
}
(async () => {
  const h = await head('/');
  const ct = String(h['content-type'] || '');
  if (!/text\/html/i.test(ct)) {
    console.error('Expected text/html at "/", got:', ct);
    process.exit(1);
  }
  console.log('HEAD / OK:', ct);
})();
