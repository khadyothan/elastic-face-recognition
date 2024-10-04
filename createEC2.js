import config from "./config.js";
import { EC2Client, RunInstancesCommand } from "@aws-sdk/client-ec2";

const ec2Client = new EC2Client(config);

// Creating EC2 instance
const createEC2Instance = async () => {
  const params = {
    ImageId: "ami-0ebfd941bbafe70c6",
    InstanceType: "t2.micro",
    KeyName: process.env.AWS_KEY_PAIR_NAME,
    MinCount: 1,
    MaxCount: 1,
    SecurityGroupIds: [process.env.AWS_SECURITY_GROUP_ID],
    TagSpecifications: [
      {
        ResourceType: "instance",
        Tags: [
          {
            Key: "Name",
            Value: "web-instance",
          },
        ],
      },
    ],
  };

  try {
    const command = new RunInstancesCommand(params);
    const response = await ec2Client.send(command);
    console.log("EC2 instance created succesfully!");
  } catch (error) {
    console.log("Error creating EC2 instance", err);
  }
};

const createEC2 = async () => {
  console.log("Request Sent.. Waiting..");
  await createEC2Instance();
};

export default createEC2;
