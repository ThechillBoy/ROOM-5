import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { sessionMiddleware } from "./config/session";
import guestRoutes from "./modules/guest/guest.routes";
import roomRoutes from "./modules/room/room.routes";
import { errorHandler, notFoundHandler } from "./middleware";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));

app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/guest", guestRoutes);
app.use("/api/rooms", roomRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;