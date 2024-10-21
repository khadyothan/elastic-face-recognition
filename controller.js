import express from "express";
import { SQSClient, GetQueueAttributesCommand } from "@aws-sdk/client-sqs";
import {
  EC2Client,
  RunInstancesCommand,
  TerminateInstancesCommand,
  DescribeInstancesCommand,
} from "@aws-sdk/client-ec2";
import dotenv from "dotenv";
import config from "./config.js";

dotenv.config();

const app = express();
const sqs = new SQSClient(config);
const ec2 = new EC2Client(config);

const MAX_INSTANCES = 20;
const MIN_INSTANCES = 1;
const INSTANCE_NAME = "app-tier-instance-2"; // Use the same name for all instances
let INSTANCE_COUNT = { count: 0 };

const controller = async () => {
  try {
    // Get SQS queue attributes
    const { Attributes } = await sqs.send(
      new GetQueueAttributesCommand({
        QueueUrl: process.env.AWS_SQS_REQ_QUEUE_URL,
        AttributeNames: ["ApproximateNumberOfMessages"],
      })
    );

    let instancesToLaunch = 1;
    const messageCount =
      parseInt(Attributes.ApproximateNumberOfMessages, 10) || 0;
    console.log(messageCount);
    if (messageCount < 10) {
      instancesToLaunch = 3;
    } else if (messageCount >= 10 && messageCount < 20) {
      instancesToLaunch = 6;
    } else if (messageCount >= 20 && messageCount < 30) {
      instancesToLaunch = 10;
    } else if (messageCount >= 30 && messageCount < 50) {
      instancesToLaunch = 14;
    } else if (messageCount >= 50 && messageCount < 75) {
      instancesToLaunch = 18;
    } else if (messageCount >= 75) {
      instancesToLaunch = 20;
    }
    console.log(instancesToLaunch);

    // let instancesToLaunch = messageCount > 20 ? MAX_INSTANCES : MIN_INSTANCES;

    const params = {
      ImageId: "ami-0a9c9f629813187cc",
      InstanceType: "t2.micro",
      KeyName: process.env.AWS_KEY_PAIR_NAME,
      MinCount: instancesToLaunch,
      MaxCount: instancesToLaunch,
      SecurityGroupIds: [process.env.AWS_SECURITY_GROUP_ID],
      TagSpecifications: [
        {
          ResourceType: "instance",
          Tags: [
            {
              Key: "Name",
              Value: INSTANCE_NAME,
            },
          ],
        },
      ],
    };

    const { Instances } = await ec2.send(new RunInstancesCommand(params));
    INSTANCE_COUNT.count += instancesToLaunch;

    console.log(`Launched ${instancesToLaunch} instances.`);

    // Check for messages periodically
    const checkQueueInterval = setInterval(async () => {
      const { Attributes: updatedAttributes } = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: process.env.AWS_SQS_REQ_QUEUE_URL,
          AttributeNames: ["ApproximateNumberOfMessages"],
        })
      );

      if (parseInt(updatedAttributes.ApproximateNumberOfMessages, 10) === 0) {
        // Terminate instances if no messages for some time
        console.log("No messages in queue, terminating instances...");

        // Describe instances to get their IDs based on the name tag
        const describeParams = {
          Filters: [
            {
              Name: "tag:Name",
              Values: [INSTANCE_NAME],
            },
          ],
        };

        const { Reservations } = await ec2.send(
          new DescribeInstancesCommand(describeParams)
        );
        const instanceIds = Reservations.flatMap((reservation) =>
          reservation.Instances.map((instance) => instance.InstanceId)
        );

        if (instanceIds.length > 0) {
          await ec2.send(
            new TerminateInstancesCommand({ InstanceIds: instanceIds })
          );
          INSTANCE_COUNT.count -= instanceIds.length; // Update count after termination

          console.log(`Terminated instances: ${instanceIds.join(", ")}`);
        } else {
          console.log("No instances found to terminate.");
        }

        // Clear the interval and end the controller
        clearInterval(checkQueueInterval);
        return; // End the controller
      }
    }, 100000); // Check every 100 seconds (1 minute and 40 seconds)
  } catch (error) {
    console.error("Error checking SQS and launching instances:", error);
  }
};

export default controller;