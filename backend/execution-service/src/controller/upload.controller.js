import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: process.env.AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});

export const createPresignUrl = async (req, res) => {
  try {
    console.log('[uploads] presign request body:', req.body);
    const { filename, contentType = 'image/jpeg' } = req.body || {};
    const key = `${process.env.S3_PREFIX || 'uploads'}/${uuidv4()}-${filename || 'image.jpg'}`;
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      // Do not set ACL here; many buckets have ACLs disabled. Use bucket policy instead.
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 60 * 5 });
    const publicUrl = `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    console.log('[uploads] presign success key:', key);
    res.json({ uploadUrl, publicUrl, contentType });
  } catch (error) {
    console.error('[uploads] presign error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Simple placeholder extraction - in real use call an OCR/LLM provider
export const extractDigits = async (req, res) => {
  try {
    console.log('[ai] extract-digits file:', req.file?.originalname, 'size:', req.file?.size);
    // TODO: integrate with provider like AWS Textract, Google Vision, OpenAI, etc.
    // For now, return dummy values or parse using a simple heuristic.
    res.json({ depth: 2.5, temperature: 30, angle: 12 });
  } catch (error) {
    console.error('[ai] extract-digits error:', error);
    res.status(500).json({ message: error.message });
  }
};


