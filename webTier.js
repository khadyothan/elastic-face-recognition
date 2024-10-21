import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from "@aws-sdk/client-sqs";
import uploadToS3 from "./utils/upload-file-to-s3.js";
import sendMessageToReqSQS from "./utils/send-message-to-req-sqs.js";
import pollFromRespSQS from "./utils/poll-from-resp-sqs.js";
import controller from "./controller.js";

dotenv.config();
const app = express();
const PORT = 8000;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const s3 = new S3Client({ region: process.env.AWS_REGION });
const sqs = new SQSClient({ region: process.env.AWS_REGION });
const INPUT_S3_BUCKET_NAME = process.env.AWS_S3_INPUT_BUCKET_NAME;
const REQ_SQS_QUEUE_URL = process.env.AWS_SQS_REQ_QUEUE_URL;
const RESP_SQS_QUEUE_URL = process.env.AWS_SQS_RESP_QUEUE_URL;

const results = {};
let runController = true;

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.post("/", upload.single("inputFile"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const reqId = Date.now().toString();

  try {
    await uploadToS3(file, INPUT_S3_BUCKET_NAME);
    await sendMessageToReqSQS(reqId, file.originalname, REQ_SQS_QUEUE_URL);
    if (runController) {
      controller();
      runController = false;
    }
    results[reqId] = (response) => {
      res.send(`${response}`);
    };

    setInterval(() => {
      if (pollFromRespSQS(RESP_SQS_QUEUE_URL, results)) {
        runController = true;
      }
    }, 5000);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
