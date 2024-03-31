const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const Redis = require("ioredis");

const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const PROJECT_ID = process.env.PROJECT_ID;
const REDIS_SERVICE_URI = process.env.REDIS_SERVICE_URI;

const publisher = new Redis(REDIS_SERVICE_URI);

function publishLog(log, printInConsole = true) {
    try {
        publisher.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
    } catch (error) {
        console.log(`Error while publishing log: ${error.toString()}`);
    }

    if (printInConsole) {
        console.log(log);
    }
}

async function init() {
    publishLog("Build initiated...");

    // Go to the output directory containing cloned repo content
    // and then install dependencies and build it
    const outDirPath = path.join(__dirname, "output");
    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    // Display logs
    p.stdout.on("data", (data) => {
        publishLog(data.toString());
    });

    // Display errors
    p.stdout.on("error", (error) => {
        publishLog(`Error: ${error.toString()}`);
    });

    // Notify completion of build
    p.on("close", async function () {
        publishLog("Build completed successfully");
        const buildFolder = process.env.BUILD_FOLDER || "build";
        const buildFolderPath = path.join(__dirname, "output", buildFolder);
        const buildFolderContents = fs.readdirSync(buildFolderPath, {
            recursive: true,
        });
        publishLog("Deployment started");

        for (const file of buildFolderContents) {
            const filepath = path.join(buildFolderPath, file);
            if (fs.lstatSync(filepath).isDirectory()) {
                continue;
            }

            publishLog(`Uploading: ${filepath} to cloud`);

            const uploadCommand = new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `__builds/${PROJECT_ID}/${file}`,
                Body: fs.createReadStream(filepath),
                ContentType: mime.lookup(filepath),
            });

            await s3Client.send(uploadCommand);
        }

        publishLog("Deployment completed...");
    });
}

init();
