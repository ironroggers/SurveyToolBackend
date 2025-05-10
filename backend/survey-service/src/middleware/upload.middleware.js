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

// Validate geolocation data after file upload
const validateGeoData = (req, res, next) => {
  // Log received form data fields for debugging
  console.log('Form data fields:', Object.keys(req.body));
  
  if (req.file && (req.file.mimetype.startsWith('image/') || req.file.mimetype.startsWith('video/'))) {
    // For images and videos, check if required geotagging data is present
    const { latitude, longitude, deviceName, accuracy } = req.body;
    
    if (!latitude || !longitude || !deviceName || !accuracy) {
      console.warn('⚠️ Media file missing geolocation data:');
      console.warn('- File:', req.file.originalname);
      console.warn('- Type:', req.file.mimetype);
      console.warn('- Latitude:', latitude || 'Missing');
      console.warn('- Longitude:', longitude || 'Missing');
      console.warn('- Device Name:', deviceName || 'Missing');
      console.warn('- Accuracy:', accuracy || 'Missing');
      
      // Note: We're not blocking the upload, just warning
      // The controller will decide what to do based on file type requirements
    } else {
      // Validate latitude and longitude values
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const acc = parseFloat(accuracy);
      
      if (isNaN(lat) || lat < -90 || lat > 90) {
        console.warn('⚠️ Invalid latitude value:', latitude);
      }
      
      if (isNaN(lng) || lng < -180 || lng > 180) {
        console.warn('⚠️ Invalid longitude value:', longitude);
      }
      
      if (isNaN(acc) || acc < 0) {
        console.warn('⚠️ Invalid accuracy value:', accuracy);
      }
      
      console.log('✅ Geolocation data validated for media file');
    }
  }
  
  next();
};

// Configure multer with memory storage for S3 upload
const upload = multer({
  storage: multer.memoryStorage(), // Using memory storage for S3
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
});

export const uploadFiles = [upload.single('file'), validateGeoData]; 