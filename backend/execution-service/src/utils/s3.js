import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';

let client;

// Created on first use so it picks up env vars loaded by dotenv in server.js
export const getS3Client = () => {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION,
      // Optional S3-compatible endpoint for local development (e.g. MinIO); unset for AWS
      // S3-compatible servers often don't understand the SDK's default streaming checksums
      ...(process.env.S3_ENDPOINT
        ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED" }
        : {}),
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

// "https://<bucket>.s3.<region>.amazonaws.com/<key>" -> key, for files this service uploaded
export const keyFromUrl = (url) => {
  const bucket = getS3Bucket();
  if (!bucket || !url) return null;
  try {
    const u = new URL(url);
    if (!u.hostname.startsWith(`${bucket}.s3.`) && u.hostname !== `${bucket}.s3.amazonaws.com`) return null;
    return decodeURIComponent(u.pathname.replace(/^\//, "")) || null;
  } catch {
    return null;
  }
};

export const downloadToFile = async (key, file) => {
  const res = await getS3Client().send(new GetObjectCommand({ Bucket: getS3Bucket(), Key: key }));
  await pipeline(res.Body, createWriteStream(file));
  return { contentType: res.ContentType };
};

export const uploadFromFile = async (key, file, contentType) => {
  const { size } = await stat(file);
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getS3Bucket(),
      Key: key,
      Body: createReadStream(file),
      ContentLength: size,
      ContentType: contentType,
      // The stamped file replaces the original at the same URL, so don't let caches keep the old one
      CacheControl: "no-cache",
    })
  );
  return size;
};

export const getObjectStream = async (key) => getS3Client().send(new GetObjectCommand({ Bucket: getS3Bucket(), Key: key }));
