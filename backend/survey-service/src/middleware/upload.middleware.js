import multer from 'multer';
import { BadRequestError } from '../utils/errors.js';

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimeTypes = {
    'image/jpeg': true,
    'image/png': true,
    'image/gif': true,
    'video/mp4': true,
    'video/mpeg': true,
    'video/quicktime': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true
  };

  if (allowedMimeTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Invalid file type. Only images, videos, and documents are allowed.'), false);
  }
};

// Configure multer with memory storage for S3 upload
const upload = multer({
  storage: multer.memoryStorage(), // Using memory storage for S3
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

export const uploadFiles = upload.single('file'); 