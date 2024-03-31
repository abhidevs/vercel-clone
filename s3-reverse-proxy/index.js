const express = require("express");
const httpProxy = require("http-proxy");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

const app = express();
const PORT = 8000;
const BASEPATH = process.env.S3_BASEPATCH;
const proxy = httpProxy.createProxy();

app.use((req, res) => {
    const hostname = req.hostname;
    console.log(hostname);
    const subdomain = hostname.split(".")[0];
    const resolvesTo = `${BASEPATH}/${subdomain}`;

    proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
    const { url } = req;

    if (url === "/") {
        proxyReq.path += "index.html";
    }
});

app.listen(PORT, () => console.log(`Reverse proxy running on ${PORT}`));
