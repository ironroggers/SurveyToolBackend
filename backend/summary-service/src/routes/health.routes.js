import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/live', (req, res) => {
  res.json({ status: 'ok' });
});

healthRouter.get('/ready', (req, res) => {
  // In a real check, verify DB and downstreams
  res.json({ status: 'ready' });
});


