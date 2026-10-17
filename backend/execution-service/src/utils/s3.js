import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';

let client;

// Created on first use so it picks up env vars loaded by dotenv in server.js
export const getS3Client = () => {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: process.env.AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      } : undefined,
    });
  }
  return client;
};

// Other services (e.g. hoto-service) use AWS_S3_BUCKET, so accept either name
export const getS3Bucket = () => process.env.S3_BUCKET || process.env.AWS_S3_BUCKET;

export const deleteS3Object = async (key) => {
  const bucket = getS3Bucket();
  if (!bucket || !key) return;
  await getS3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};
