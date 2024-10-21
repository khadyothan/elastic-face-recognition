import { promisify } from "util";
import dotenv from "dotenv";
import pollFromReqSQS from "./apptier-utils/poll-from-req-sqs.js";
import readFromInBucket from "./apptier-utils/read-from-in-bucket.js";
import storeToOutBucket from "./apptier-utils/store-result-to-out-bucket.js";
import sendResultToRespSQS from "./apptier-utils/send-result-to-resp-sqs.js";
import { exec as execCb } from "child_process";
import config from "./config.js";
import path from "path";
import { SQSClient, DeleteMessageCommand } from "@aws-sdk/client-sqs";

dotenv.config();

const exec = promisify(execCb); // Promisify the exec to handle async/await

const processMessages = async () => {
  while (true) {
    const messages = await pollFromReqSQS(process.env.AWS_SQS_REQ_QUEUE_URL);

    if (messages.length === 0) {
      console.log("No messages to process. Polling again...");
      continue;
    }

    for (const message of messages) {
      const { reqId, fileName } = JSON.parse(message.Body);
      const localFilePath = path.join("./tmp", `${fileName}`);
      console.log(localFilePath);

      try {
        const downloadedFile = await readFromInBucket(
          process.env.AWS_S3_INPUT_BUCKET_NAME,
          fileName,
          localFilePath
        );

        const { stdout, stderr } = await exec(
          `python3 ./model/face_recognition.py ${downloadedFile}`
        );

        if (stderr) {
          console.error(`Script error output: ${stderr}`);
        }

        console.log(`Script output: ${stdout}`);

        await storeToOutBucket(
          process.env.AWS_S3_OUTPUT_BUCKET_NAME,
          fileName,
          stdout
        );

        await sendResultToRespSQS(
          reqId,
          fileName,
          stdout,
          process.env.AWS_SQS_RESP_QUEUE_URL
        );

        const sqs = new SQSClient(config);
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: process.env.AWS_SQS_REQ_QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
        );
      } catch (err) {
        console.error(`Error processing message: ${err.message}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

processMessages();
