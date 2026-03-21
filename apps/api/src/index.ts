import express from 'express';

const app = express();
const port = process.env.PORT ?? '3001';

app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'api' });
});

app.listen(Number(port), () => {
  // Keep bootstrap minimal for the scaffold task.
  // eslint-disable-next-line no-console
  console.log(`API listening on :${port}`);
});