import express from 'express';
import { getUploadUrl } from '../controllers/mediaController.js';

const router = express.Router();

/**
 * @route POST /api/media/upload-url
 * @desc Get a signed URL for uploading media to S3
 * @access Private
 * @body {
 *   filename: string,
 *   contentType: string
 * }
 */
router.post('/upload-url', getUploadUrl);

export default router; 