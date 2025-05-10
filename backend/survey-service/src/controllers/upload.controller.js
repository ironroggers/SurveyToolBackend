import { uploadFileToS3 } from '../utils/s3.js';
import { addGeoTagToMedia } from '../utils/exif.js';
import { BadRequestError } from '../utils/errors.js';

export const uploadFiles = async (req, res, next) => {
  try {
    console.log('\n=== Upload Controller Started ===');
    console.log('Request Headers:', req.headers);
    console.log('Content Type:', req.headers['content-type']);
    
    if (!req.file) {
      console.error('❌ No file in request');
      throw new BadRequestError('No file uploaded');
    }

    console.log('Received File:');
    console.log('- Field name:', req.file.fieldname);
    console.log('- Original name:', req.file.originalname);
    console.log('- Encoding:', req.file.encoding);
    console.log('- Mimetype:', req.file.mimetype);
    console.log('- Size:', req.file.size, 'bytes');

    // Get geolocation data from request body
    const geoData = {
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      deviceName: req.body.deviceName || null,
      accuracy: req.body.accuracy ? parseFloat(req.body.accuracy) : null,
      place: req.body.place || null
    };

    let fileBuffer = req.file.buffer;
    
    // Only add EXIF data for images and videos
    if ((req.file.mimetype.startsWith('image/') || req.file.mimetype.startsWith('video/')) && 
        geoData.latitude && geoData.longitude && geoData.deviceName && geoData.accuracy) {
      
      console.log('Geotagging media file with EXIF data...');
      
      try {
        // Add geolocation data to the file's EXIF metadata
        fileBuffer = await addGeoTagToMedia(req.file.buffer, geoData);
        console.log('Geotagging successful');
      } catch (exifError) {
        console.error('Warning: Could not add EXIF data to file:', exifError.message);
        console.error('Continuing with original file');
        // Continue with original buffer if EXIF processing fails
        fileBuffer = req.file.buffer;
      }
    } else if (req.file.mimetype.startsWith('image/') || req.file.mimetype.startsWith('video/')) {
      console.warn('⚠️ Missing geolocation data for media file:', req.file.originalname);
      console.warn('Geolocation data received:', geoData);
      console.warn('EXIF geotagging skipped');
    }

    // Create a modified file object with the updated buffer
    const modifiedFile = {
      ...req.file,
      buffer: fileBuffer
    };

    console.log('\nCalling uploadFileToS3...');
    const uploadedFile = await uploadFileToS3(modifiedFile);
    
    // Add geolocation data to the response
    // This is needed for the survey system to associate the location with the file
    // even if EXIF tagging failed
    const responseData = {
      ...uploadedFile,
      latitude: geoData.latitude,
      longitude: geoData.longitude,
      deviceName: geoData.deviceName,
      accuracy: geoData.accuracy,
      place: geoData.place
    };
    
    console.log('Upload successful:', responseData);
    console.log('=== Upload Controller Completed ===\n');
    
    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('\n❌ Upload Controller Error:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    next(error);
  }
}; 