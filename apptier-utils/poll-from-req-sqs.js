import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import config from "../config.js";

const sqs = new SQSClient(config);

export const pollFromReqSQS = async (url) => {
  const params = {
    QueueUrl: url,
    MaxNumberOfMessages: 3,
    WaitTimeSeconds: 2,
  };

  try {
    const data = await sqs.send(new ReceiveMessageCommand(params));
    return data.Messages || [];
  } catch (err) {
    console.error(`Error receiving messages: ${err.message}`);
    throw err;
  }
};

export default pollFromReqSQS;
