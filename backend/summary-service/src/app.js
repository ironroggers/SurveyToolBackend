import express from 'express';
import morgan from 'morgan';
import { errorHandler, notFoundHandler, requestId } from './middlewares/index.js';
import { healthRouter } from './routes/health.routes.js';
import { summaryRouter } from './routes/summary.routes.js';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/v1/summary', summaryRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;


