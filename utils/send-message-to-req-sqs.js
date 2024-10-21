import dotenv from "dotenv";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import config from "../config.js";

const sqs = new SQSClient(config);

const sendMessageToReqSQS = async (reqId, fileName, url) => {
  const messageBody = JSON.stringify({ reqId, fileName });
  const params = {
    QueueUrl: url,
    MessageBody: messageBody,
  };

  try {
    await sqs.send(new SendMessageCommand(params));
    console.log(`Sent message to SQS: ${fileName}`);
  } catch (error) {
    console.error("Error sending message to SQS:", error);
    throw error;
  }
};

export default sendMessageToReqSQS;
