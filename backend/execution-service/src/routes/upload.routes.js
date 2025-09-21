import { Router } from 'express';
import { createPresignUrl } from '../controller/upload.controller.js';

const router = Router();

router.post('/presign', createPresignUrl);

export default router;


