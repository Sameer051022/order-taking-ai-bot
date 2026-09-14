import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  dbPath: process.env.DATABASE_PATH ?? "./data/app.db",
  claudeModel: process.env.AGENT_MODEL ?? "claude-opus-5",
  claudeEffort: (process.env.AGENT_EFFORT ?? "medium") as "low" | "medium" | "high",
  demoToken: process.env.DEMO_TOKEN ?? "",
  whatsapp: {
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? "change-me",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? "",
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? "v21.0",
  },
};
