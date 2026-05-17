import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const cfg = loadConfig();
const app = createApp(cfg);

const server = app.listen(cfg.PORT, "0.0.0.0", () => {
  console.log(`mini-jira-backend listening on :${cfg.PORT}`);
});

const shutdown = (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
