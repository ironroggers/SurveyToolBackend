import { Router } from 'express';
import multer from 'multer';
import { extractDigits } from '../controller/upload.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/extract-digits', upload.single('image'), extractDigits);

export default router;


