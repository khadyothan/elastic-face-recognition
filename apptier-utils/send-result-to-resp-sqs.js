import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import config from "../config.js";

const sqs = new SQSClient(config);

export const sendResultToRespSQS = async (reqId, fileName, result, url) => {
  const messageBody = JSON.stringify({ reqId, fileName, result });
  const params = {
    QueueUrl: url,
    MessageBody: messageBody,
  };

  try {
    await sqs.send(new SendMessageCommand(params));
    console.log("Result sent to response SQS");
  } catch (err) {
    console.error(`Error sending result to response SQS: ${err.message}`);
    throw err;
  }
};

export default sendResultToRespSQS;
