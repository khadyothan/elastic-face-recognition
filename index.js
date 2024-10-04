import "dotenv/config";
import createEC2 from "./createEC2.js";

const main = async () => {
  try {
    const response = await createEC2();
  } catch (err) {
    console.log(err);
  }
};

main();
