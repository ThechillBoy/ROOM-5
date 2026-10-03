import session from "express-session";
import { RedisStore } from "connect-redis";
import { createClient } from "redis";
import { env } from "./env";
import { SESSION_TTL_MS } from "@room5/shared";

const isProduction = env.NODE_ENV === "production";
const redisClient = env.REDIS_URL ? createClient({
  url: env.REDIS_URL,
  // Requests fail promptly during an outage rather than waiting in a queue.
  disableOfflineQueue: true,
  socket: { connectTimeout: 5_000 },
}) : undefined;

redisClient?.on("error", () => {
  // Connection strings can contain credentials; do not log the raw error.
  console.error("Session store connection error");
});

const sessionStore = redisClient ? new RedisStore({
  client: redisClient,
  prefix: "room5:session:",
  ttl: Math.ceil(SESSION_TTL_MS / 1000),
}) : undefined;

export async function connectSessionStore(): Promise<void> {
  if (!redisClient) return;

  let startupTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      redisClient.connect(),
      new Promise<never>((_resolve, reject) => {
        startupTimeout = setTimeout(() => {
          reject(new Error("Session store connection timed out"));
        }, 15_000);
      }),
    ]);
  } catch {
    if (redisClient.isOpen) redisClient.destroy();
    throw new Error("Unable to connect to the configured session store");
  } finally {
    clearTimeout(startupTimeout);
  }
}

export async function closeSessionStore(): Promise<void> {
  if (!redisClient?.isOpen) return;

  if (redisClient.isReady) {
    await redisClient.close();
  } else {
    redisClient.destroy();
  }
}

export const sessionMiddleware = session({
  store: sessionStore,
  name: "room5.sid",
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
    // No explicit domain: cookie is scoped to the current host, so it works
    // for both localhost and 127.0.0.1 in development.
  },
  rolling: true,
});
