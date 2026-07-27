import { config as loadDotenv } from "dotenv";
import { createApp } from "./app.js";
import { parseServerConfig } from "./config.js";
import { createLiveUpdateService } from "./liveUpdates.js";
import { createServerAccess } from "./fileLoaders.js";
import { existsSync } from "node:fs";
import path from "node:path";

loadDotenv({ path: ".env.local" });
loadDotenv();

const config = parseServerConfig(process.env);
const liveUpdates = createLiveUpdateService(config.dataRoot);
const access = createServerAccess(config.dataRoot);
const app = createApp({ config, liveUpdates, access });

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[cyberboss-api] listening on http://${config.host}:${config.port} (data root: ${config.dataRoot})`,
  );
  if (
    existsSync(
      path.join(config.staticDistDirectory, "index.html"),
    )
  ) {
    console.log(
      `[murmur-lane] serving built client from ${config.staticDistDirectory}`,
    );
  }
  liveUpdates.start();
});

const closeServer = () => {
  liveUpdates.close();
  server.close();
};

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
