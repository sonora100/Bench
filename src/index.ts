import app from "./app";
import { logger } from "./lib/logger";
import { syncMetalPricesNow } from "./routes/metal_prices";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Sync metal prices immediately on startup, then every hour
  syncMetalPricesNow()
    .then((s) => logger.info({ gold: s.gold_24k_ozt, silver: s.silver_ozt, platinum: s.platinum_ozt }, "Metal prices synced on startup"))
    .catch((e) => logger.warn({ err: e }, "Startup metal price sync failed — prices may be stale"));

  setInterval(() => {
    syncMetalPricesNow()
      .then((s) => logger.info({ gold: s.gold_24k_ozt }, "Metal prices synced (hourly)"))
      .catch((e) => logger.warn({ err: e }, "Hourly metal price sync failed"));
  }, 60 * 60 * 1000);
});
