import express from 'express';
import { uploadFiles as uploadMiddleware } from '../middleware/upload.middleware.js';
import { uploadFiles } from '../controllers/upload.controller.js';

const router = express.Router();

router.post('/', uploadMiddleware, uploadFiles);

export default router; 