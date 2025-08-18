import express, { Request, Response } from 'express';
import path from 'path';

const app = express();
const port = process.env.PORT || 5173;

const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));

app.get('/healthz', (_req: Request, res: Response) => {
  res.sendStatus(200);
});

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`listening on :${port}`);
});
