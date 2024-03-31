const express = require("express");
const randomWordSlugs = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = express();
const PORT = 9000;

const ecsClient = new ECSClient({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const buildCommandConfig = {
    CLUSTER: process.env.AWS_BUILD_CLUSTER_ARN,
    TASK: process.env.AWS_BUILD_TASK_ARN,
};

app.use(express.json());

app.post("/projects", async (req, res) => {
    const { gitUrl, buildFolder } = req.body;
    const projectSlug = randomWordSlugs.generateSlug();

    // Spin the build container
    const buildCommand = new RunTaskCommand({
        cluster: buildCommandConfig.CLUSTER,
        taskDefinition: buildCommandConfig.TASK,
        launchType: "FARGATE",
        count: 1,
        networkConfiguration: {
            awsvpcConfiguration: {
                assignPublicIp: "ENABLED",
                subnets: [
                    "subnet-0d9ebb5880f597488",
                    "subnet-0f9b8b113f579c4d0",
                    "subnet-068579e8f8cdf70d1",
                ],
                securityGroups: ["sg-0941895278cc761d4"],
            },
        },
        overrides: {
            containerOverrides: [
                {
                    name: "build-server-image",
                    environment: [
                        {
                            name: "GIT_REPO_URL",
                            value: gitUrl,
                        },
                        {
                            name: "PROJECT_ID",
                            value: projectSlug,
                        },
                        {
                            name: "BUILD_FOLDER",
                            value: buildFolder,
                        },
                    ],
                },
            ],
        },
    });

    await ecsClient.send(buildCommand);
    return res.json({
        status: "queued",
        data: {
            projectSlug,
            url: `http://${projectSlug}.localhost:8000`,
        },
    });
});

app.listen(PORT, () => console.log(`Reverse proxy running on ${PORT}`));
