import http from 'http';
import app from './app.js';
import { loadEnv } from './config/env.js';
import { connectToDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import Summary, { SummaryLower } from './models/summaryModel.js';
import mongoose from 'mongoose';

loadEnv();

const port = process.env.PORT || 4005;
app.set('port', port);

async function start() {
  await connectToDatabase();
  try {
    const uri = mongoose?.connection?.client?.s?.url || process.env.MONGODB_URI || 'unknown';
    const dbName = mongoose?.connection?.db?.databaseName || 'unknown';
    const [upperCount, lowerCount] = await Promise.all([
      Summary.estimatedDocumentCount().catch(() => -1),
      SummaryLower.estimatedDocumentCount().catch(() => -1),
    ]);
    logger.info('[summary-service] mongo connected', { uri, dbName, SummaryCount: upperCount, summaryCount: lowerCount });
  } catch (e) {
    logger.warn('[summary-service] failed to fetch counts', { error: String(e) });
  }
  const server = http.createServer(app);
  server.listen(port, () => {
    logger.info('[summary-service] listening', { port });
  });
}

start().catch((err) => {
  logger.error('[summary-service] failed to start', { error: String(err) });
  process.exit(1);
});


