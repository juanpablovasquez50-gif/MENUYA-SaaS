import { createHmac, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request } from "express";

const router: IRouter = Router();
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const SESSION_MS = 12 * 60 * 60 * 1000;
const DEVICE_MS = 180 * 24 * 60 * 60 * 1000;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function clientKey(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function makeToken(expiry: string, secret: string, purpose: "session" | "device") {
  const payload = `${purpose}:${expiry}`;
  return `${expiry}.${sign(payload, secret)}`;
}

function validToken(token: unknown, secret: string, purpose: "session" | "device") {
  if (typeof token !== "string") return false;
  const [expiry, signature, extra] = token.split(".");
  if (!expiry || !signature || extra || !/^\d+$/.test(expiry) || Number(expiry) <= Date.now()) return false;
  return safeEqual(signature, sign(`${purpose}:${expiry}`, secret));
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
  const sessionExpiry = String(now + SESSION_MS);
  const response: { token: string; expiresAt: number; deviceToken?: string; deviceExpiresAt?: number } = {
    token: makeToken(sessionExpiry, secret, "session"),
    expiresAt: Number(sessionExpiry),
  };
  if (req.body?.rememberDevice === true) {
    const deviceExpiry = String(now + DEVICE_MS);
    response.deviceToken = makeToken(deviceExpiry, secret, "device");
    response.deviceExpiresAt = Number(deviceExpiry);
  }
  res.json(response);
});

router.post("/access/device", (req, res) => {
  const secret = process.env.EARLY_ACCESS_SECRET;
  if (!secret) {
    res.status(503).json({ valid: false });
    return;
  }
  const token = req.body?.token;
  if (!validToken(token, secret, "device")) {
    res.status(401).json({ valid: false });
    return;
  }
  const expiry = Number(String(token).split(".")[0]);
  res.json({ valid: true, expiresAt: expiry });
});

router.post("/access/session", (req, res) => {
  const secret = process.env.EARLY_ACCESS_SECRET;
  if (!secret || !validToken(req.body?.token, secret, "session")) {
    res.status(401).json({ valid: false });
    return;
  }
  const expiry = Number(String(req.body.token).split(".")[0]);
  res.json({ valid: true, expiresAt: expiry });
});

export default router;
