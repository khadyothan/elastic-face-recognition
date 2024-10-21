import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import config from "../config.js";

const s3 = new S3Client(config);

export const storeToOutBucket = async (bucket, key, result) => {
  const params = {
    Bucket: bucket,
    Key: key,
    Body: result,
  };

  try {
    await s3.send(new PutObjectCommand(params));
    console.log(`Stored result to ${key}`);
  } catch (err) {
    console.error(`Error storing to output bucket: ${err.message}`);
    throw err;
  }
};

export default storeToOutBucket;
