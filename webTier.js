import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  CreateTagsCommand,
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
import config from "./config.js";

dotenv.config();
const app = express();
const PORT = 8000;
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const ec2 = new EC2Client(config);
const s3 = new S3Client(config);
const sqs = new SQSClient(config);
const INPUT_S3_BUCKET_NAME = process.env.AWS_S3_INPUT_BUCKET_NAME;
const REQ_SQS_QUEUE_URL = process.env.AWS_SQS_REQ_QUEUE_URL;
const RESP_SQS_QUEUE_URL = process.env.AWS_SQS_RESP_QUEUE_URL;

const results = {};
let activeInstances = [];
let totalResponses = 0;
let instancesRunning = false;

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

async function terminateInstances() {
  if (activeInstances.length === 0) return;
  try {
    const params = {
      InstanceIds: activeInstances,
    };
    const terminateCommand = new TerminateInstancesCommand(params);
    await ec2.send(terminateCommand);
    console.log("Terminated instances:", activeInstances);

    activeInstances = [];
    // totalResponses = 0;
    instancesRunning = false;
  } catch (error) {
    console.error("Error terminating instances:", error);
  }
}

app.post("/", upload.single("inputFile"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  const reqId = Date.now().toString();

  try {
    await uploadToS3(file, INPUT_S3_BUCKET_NAME);
    await sendMessageToReqSQS(reqId, file.originalname, REQ_SQS_QUEUE_URL);

    results[reqId] = (response) => {
      totalResponses++;
      res.send(`${response}`);
      if (totalResponses === Object.keys(results).length) {
        terminateInstances();
      }
    };

    if (!instancesRunning) {
      instancesRunning = true;

      const instancesToLaunch = 5;
      const instanceNames = [
        "app-tier-instance-1",
        "app-tier-instance-2",
        "app-tier-instance-3",
        "app-tier-instance-4",
        "app-tier-instance-5",
      ];

      const params = {
        ImageId: "ami-0a9c9f629813187cc",
        InstanceType: "t2.micro",
        KeyName: process.env.AWS_KEY_PAIR_NAME,
        MinCount: instancesToLaunch,
        MaxCount: instancesToLaunch,
        SecurityGroupIds: [process.env.AWS_SECURITY_GROUP_ID],
      };

      const runInstancesCommand = new RunInstancesCommand(params);
      const runInstancesResponse = await ec2.send(runInstancesCommand);

      const instanceIds = runInstancesResponse.Instances.map(
        (instance) => instance.InstanceId
      );

      console.log("Launched EC2 instances:", instanceIds);

      // Now tag each instance with its respective name
      for (let i = 0; i < instanceIds.length; i++) {
        const tagParams = {
          Resources: [instanceIds[i]], // Specify the instance ID
          Tags: [
            {
              Key: "Name",
              Value: instanceNames[i], // Assign the appropriate name
            },
          ],
        };
        const createTagsCommand = new CreateTagsCommand(tagParams);
        await ec2.send(createTagsCommand); // Send tag request for each instance
        console.log(
          `Tagged instance ${instanceIds[i]} with Name: ${instanceNames[i]}`
        );
      }

      activeInstances = runInstancesResponse.Instances.map(
        (instance) => instance.InstanceId
      );

      console.log("Launched EC2 instances:", activeInstances);
    }

    setInterval(() => {
      pollFromRespSQS(RESP_SQS_QUEUE_URL, results);
    }, 5000);
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send("Error processing request.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
