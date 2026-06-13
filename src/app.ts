import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { ZodError } from "zod";
import path from "path";
import { existsSync } from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET env var is not set. Sessions will not persist across server restarts. Set this in production.");
}

const PgStore = connectPgSimple(session);

const sessionStore = process.env.DATABASE_URL
  ? new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "session",
      pruneSessionInterval: 60 * 60,
    })
  : undefined;

if (sessionStore) {
  logger.info("Using PostgreSQL session store");
} else {
  logger.warn("DATABASE_URL not set — using in-memory session store (sessions will not survive restarts)");
}

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET ?? "jeweler-dev-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
  cookie: {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000,


app.use("/api", router);

// Serve frontend static files — works in production (Railway) when Vite build output exists
const frontendDist = path.resolve(process.cwd(), "artifacts/jeweler-repair/dist/public");
if (existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
  logger.info({ frontendDist }, "Serving frontend static files");
}

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation error", issues: err.issues });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  logger.error({ err, message }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
