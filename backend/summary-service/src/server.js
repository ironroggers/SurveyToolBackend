import http from 'http';
import app from './app.js';
import { loadEnv } from './config/env.js';
import { connectToDatabase } from './config/database.js';
import { logger } from './utils/logger.js';

loadEnv();

const port = process.env.PORT || 4005;
app.set('port', port);

async function start() {
  await connectToDatabase();
  const server = http.createServer(app);
  server.listen(port, () => {
    logger.info('[summary-service] listening', { port });
  });
}

start().catch((err) => {
  logger.error('[summary-service] failed to start', { error: String(err) });
  process.exit(1);
});


