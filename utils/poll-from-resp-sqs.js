import dotenv from "dotenv";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import config from "../config.js";

const sqs = new SQSClient(config);

const pollFromRespSQS = async (url, results) => {
  const params = {
    QueueUrl: url,
    MaxNumberOfMessages: 3,
    WaitTimeSeconds: 0,
  };

  try {
    const data = await sqs.send(new ReceiveMessageCommand(params));
    if (data.Messages === 0) {
      return true;
    }
    if (data.Messages && data.Messages.length > 0) {
      for (const message of data.Messages) {
        const receiptHandle = message.ReceiptHandle;
        const { reqId, fileName, result } = JSON.parse(message.Body);
        console.log(`Received response message: ${message.Body}`);

        if (results[reqId]) {
          results[reqId](`${fileName}:${result.trim()}`);
        }

        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: url,
            ReceiptHandle: receiptHandle,
          })
        );

        console.log("Message deleted from SQS queue.");
      }
      return false;
    }
  } catch (error) {
    console.error("Error receiving or processing SQS response message:", error);
  }
};

export default pollFromRespSQS;
