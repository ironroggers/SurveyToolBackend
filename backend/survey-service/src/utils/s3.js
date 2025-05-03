import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// Detailed configuration logging
console.log('\n=== AWS Configuration Debug ===');
console.log('Environment Variables:');
console.log('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'Missing');
console.log('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '****' + process.env.AWS_SECRET_ACCESS_KEY.slice(-4) : 'Missing');
console.log('- AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET || 'Missing');
console.log('- AWS_REGION:', process.env.AWS_REGION || 'us-west-2 (default)');
console.log('Process ENV Keys:', Object.keys(process.env).filter(key => key.startsWith('AWS')));
console.log('=== End AWS Configuration ===\n');

// Validate required credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS Credentials Validation Failed:');
  console.error('- AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Present' : 'Missing');
  console.error('- AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Present' : 'Missing');
}

if (!process.env.AWS_S3_BUCKET) {
  console.error('❌ AWS S3 Bucket Validation Failed:');
  console.error('- AWS_S3_BUCKET is missing');
}

console.log('✅ AWS Credentials Validation Passed');

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

console.log('✅ S3 Client Initialized');

const generateFileName = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString('hex');
  const extension = originalname.split('.').pop();
  return `${timestamp}-${randomString}.${extension}`;
};

const getFileType = (mimetype) => {
  if (mimetype.startsWith('image/')) return 'IMAGE';
  if (mimetype.startsWith('video/')) return 'VIDEO';
  return 'DOCUMENT';
};

export const uploadFileToS3 = async (file) => {
  try {
    console.log('\n=== Starting S3 Upload Process ===');
    const fileName = generateFileName(file.originalname);
    const fileType = getFileType(file.mimetype);
    
    console.log('File Details:');
    console.log('- Original Name:', file.originalname);
    console.log('- Generated Name:', fileName);
    console.log('- File Type:', fileType);
    console.log('- Content Type:', file.mimetype);
    console.log('- File Size:', file.size, 'bytes');
    
    console.log('\nPreparing S3 Upload Command:');
    console.log('- Bucket:', process.env.AWS_S3_BUCKET);
    console.log('- Region:', process.env.AWS_REGION || 'us-west-2');

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    console.log('\nExecuting S3 Upload...');
    await s3Client.send(command);
    console.log('✅ File uploaded successfully to S3');

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-west-2'}.amazonaws.com/${fileName}`;
    console.log('Generated URL:', fileUrl);
    console.log('=== End S3 Upload Process ===\n');

    return {
      url: fileUrl,
      fileType,
      originalName: file.originalname
    };
  } catch (error) {
    console.error('\n❌ S3 Upload Error:');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    if (error.$metadata) {
      console.error('AWS Metadata:', JSON.stringify(error.$metadata, null, 2));
    }
    throw error;
  }
}; 