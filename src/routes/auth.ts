import { Router } from "express";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

const SHOP_PASSWORD = process.env.SHOP_PASSWORD;
if (!SHOP_PASSWORD) {
  logger.warn(
    'SHOP_PASSWORD env var is not set. Set it to protect your shop data. Defaulting to "admin".'
  );
}
const password = SHOP_PASSWORD ?? "admin";

const LoginBody = z.object({ password: z.string().min(1) });

router.post("/auth/login", (req, res) => {
  const result = LoginBody.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Password required" });
    return;
  }
  if (result.data.password !== password) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

router.get("/auth/me", (req, res) => {
  res.json({ authenticated: !!req.session?.authenticated });
});

export default router;
