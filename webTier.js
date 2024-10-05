import express from "express";
import multer from "multer";
import fs from "fs";
import csvParser from "csv-parser";

const app = express();
const PORT = 8000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const csvFilePath =
  "./Classification Results on Face Dataset (1000 images).csv";

const getResultFromCSV = (fileName) => {
  return new Promise((resolve, reject) => {
    const results = {};
    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on("data", (data) => {
        results[data.Image] = data.Results;
      })
      .on("end", () => {
        resolve(results[fileName] || "Result not found.");
      })
      .on("error", (error) => {
        reject(error);
      });
  });
};

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.post("/", upload.single("inputFile"), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }
  const fileName = file.originalname.split(".")[0];

  try {
    const classificationResult = await getResultFromCSV(fileName);
    res.send(`${file.originalname}:${classificationResult}`);
  } catch (error) {
    console.error("Error reading CSV:", error);
    res.status(500).send("Error processing request.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
