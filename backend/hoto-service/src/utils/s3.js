import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const generateFileName = (originalname) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString("hex");
  const extension = originalname.split(".").pop();
  return `${timestamp}-${randomString}.${extension}`;
};

const getFileType = (mimetype) => {
  if (mimetype.startsWith("image/")) return "IMAGE";
  if (mimetype.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
};

export const generateUploadSignedUrl = async (fileDetails) => {
  try {
    const fileName = generateFileName(fileDetails.originalname);
    const fileType = getFileType(fileDetails.mimetype);

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: fileName,
      ContentType: fileDetails.mimetype,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    }); // URL expires in 1 hour

    const fileUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${
      process.env.AWS_REGION || "us-west-2"
    }.amazonaws.com/${fileName}`;

    return {
      signedUrl,
      fileUrl,
      fileName,
      fileType,
    };
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw error;
  }
};
