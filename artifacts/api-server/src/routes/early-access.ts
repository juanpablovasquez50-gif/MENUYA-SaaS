import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_MS = 12 * 60 * 60 * 1000;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(expiry: string, secret: string) {
  return createHmac("sha256", secret).update(expiry).digest("hex");
}

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

router.post("/access/verify", (req, res) => {
  const password = process.env.EARLY_ACCESS_PASSWORD;
  const secret = process.env.EARLY_ACCESS_SECRET;
  if (!password || !secret) {
    res.status(503).json({ error: "El acceso anticipado aún no está configurado." });
    return;
  }

  const key = clientKey(req);
  const now = Date.now();
  const record = attempts.get(key);
  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: "Demasiados intentos. Espera unos minutos e inténtalo de nuevo." });
    return;
  }

  const supplied = typeof req.body?.password === "string" ? req.body.password : "";
  if (!safeEqual(supplied, password)) {
    const next = !record || record.resetAt <= now
      ? { count: 1, resetAt: now + WINDOW_MS }
      : { ...record, count: record.count + 1 };
    attempts.set(key, next);
    res.status(401).json({ error: "Ese código no es correcto. Inténtalo nuevamente." });
    return;
  }

  attempts.delete(key);
  const expiry = String(now + SESSION_MS);
  const token = `${expiry}.${sign(expiry, secret)}`;
  res.json({ token, expiresAt: Number(expiry) });
});

router.post("/access/session", (req, res) => {
  const secret = process.env.EARLY_ACCESS_SECRET;
  if (!secret) {
    res.status(503).json({ valid: false });
    return;
  }
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  const [expiry, signature, extra] = token.split(".");
  if (!expiry || !signature || extra || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now()) {
    res.status(401).json({ valid: false });
    return;
  }
  const expected = sign(expiry, secret);
  if (!safeEqual(signature, expected)) {
    res.status(401).json({ valid: false });
    return;
  }
  res.json({ valid: true, expiresAt: Number(expiry) });
});

export default router;
