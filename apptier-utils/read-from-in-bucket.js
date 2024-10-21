import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import config from "../config.js";

const s3 = new S3Client(config);

export const readFromInBucket = async (bucket, key, localFilePath) => {
  const getObjectParams = {
    Bucket: bucket,
    Key: key,
  };

  const command = new GetObjectCommand(getObjectParams);
  const s3Response = await s3.send(command);

  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(localFilePath);
    s3Response.Body.pipe(writeStream);

    writeStream.on("finish", () => {
      console.log(`Downloaded ${key} to ${localFilePath}`);
      resolve(localFilePath);
    });

    writeStream.on("error", (err) => {
      console.error(`Error writing file: ${err.message}`);
      reject(err);
    });
  });
};

export default readFromInBucket;
