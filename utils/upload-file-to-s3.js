import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import config from "../config.js";

const s3 = new S3Client(config);

const uploadToS3 = async (file, bucketName) => {
  const params = {
    Bucket: bucketName,
    Key: file.originalname,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log(`File uploaded successfully to S3: ${file.originalname}`);
  } catch (error) {
    console.error("Error uploading file to S3:", error);
    throw error;
  }
};

export default uploadToS3;
