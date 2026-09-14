import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import cors from "@fastify/cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { getDb } from "./db/index.js";
import { seedAll } from "./seed/index.js";
import { registerRoutes } from "./api/routes.js";
import { installNotifications } from "./channels/notifications.js";

const here = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  getDb();
  const seeded = seedAll();
  if (seeded.length) console.log(`Seeded demo data for: ${seeded.join(", ")}`);
  installNotifications();

  const app = Fastify({ logger: { level: "warn" } });
  await app.register(cors, { origin: true });
  await app.register(fastifyStatic, { root: path.join(here, "..", "public"), prefix: "/" });
  await registerRoutes(app);
  app.get("/", async (_req, reply) => reply.redirect("/demo/"));
  app.get("/demo", async (_req, reply) => reply.redirect("/demo/"));
  app.get("/dashboard", async (_req, reply) => reply.redirect("/dashboard/"));

  await app.listen({ port: config.port, host: "0.0.0.0" });
  const aiReady = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  console.log(`\n  AI Ordering Agent running on http://localhost:${config.port}`);
  console.log(`  WhatsApp simulator  http://localhost:${config.port}/demo/`);
  console.log(`  Restaurant dashboard http://localhost:${config.port}/dashboard/`);
  console.log(`  Model: ${config.claudeModel} (effort ${config.claudeEffort})  API key: ${aiReady ? "set" : "not set in env (SDK will try an `ant auth login` profile)"}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
