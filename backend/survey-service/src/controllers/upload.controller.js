import { uploadFileToS3 } from '../utils/s3.js';
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

    console.log('\nCalling uploadFileToS3...');
    const uploadedFile = await uploadFileToS3(req.file);
    console.log('Upload successful:', uploadedFile);

    console.log('=== Upload Controller Completed ===\n');
    res.status(200).json({
      success: true,
      data: uploadedFile
    });
  } catch (error) {
    console.error('\n❌ Upload Controller Error:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    next(error);
  }
}; 