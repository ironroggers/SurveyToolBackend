import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const deleteUrlFromS3 = async (url) => {
  try {
    const s3 = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: url,
    });
    await s3.send(command);
  } catch (error) {
    console.error("Error deleting URL from S3:", error);
  }
};

export default deleteUrlFromS3;
