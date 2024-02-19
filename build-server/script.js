const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

const s3Client = new S3Client({
    region: process.env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const PROJECT_ID = process.env.PROJECT_ID;

async function init() {
    console.log("Executing script.js");

    // Go to the output directory containing cloned repo content
    // and then install dependencies and build it
    const outDirPath = path.join(__dirname, "output");
    const p = exec(`cd ${outDirPath} && npm install && npm run build`);

    // Display logs
    p.stdout.on("data", (data) => {
        console.log(data.toString());
    });

    // Display errors
    p.stdout.on("error", (error) => {
        console.log(`Error: ${error.toString()}`);
    });

    // Notify completion of build
    p.on("close", async () => {
        console.log("Build completed successfully");
        const buildFolder = process.env.BUILD_FOLDER;
        const buildFolderPath = path.join(__dirname, "output", buildFolder);
        const buildFolderContents = fs.readdirSync(buildFolderPath, {
            recursive: true,
        });

        for (const file of buildFolderContents) {
            const filepath = path.join(buildFolderPath, file);
            if (fs.lstatSync(filepath).isDirectory()) {
                continue;
            }

            console.log(`Uploading: ${filepath} to cloud`);

            const uploadCommand = new PutObjectCommand({
                Bucket: process.env.S3_BUCKET_NAME,
                key: `__builds/${PROJECT_ID}/${filepath}`,
                Body: fs.createReadStream(filepath),
                ContentType: mime.lookup(filepath),
            });

            await s3Client.send(uploadCommand);
            console.log("Deployment completed...");
        }
    });
}

init();
