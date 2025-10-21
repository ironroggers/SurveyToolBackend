import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { errorHandler, notFoundHandler, requestId } from './middlewares/index.js';
import { healthRouter } from './routes/health.routes.js';
import { summaryRouter } from './routes/summary.routes.js';

const app = express();

// CORS configuration - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: false
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestId);
app.use(morgan('combined'));

app.use('/health', healthRouter);
app.use('/api/v1/summary', summaryRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;


