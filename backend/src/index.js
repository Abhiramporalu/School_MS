#note
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";
import { prisma } from "./db.js";
import { authenticate } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/auth.js";
import { schoolRouter } from "./routes/school.js";
import { studentsRouter } from "./routes/students.js";
import { examsRouter } from "./routes/exams.js";
import { dashboardRouter } from "./routes/dashboard.js";
const port = Number(process.env.PORT ?? 4e3);
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters");
}
const app = express();
const PgSessionStore = connectPgSimple(session);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(session({
  store: new PgSessionStore({ pool, createTableIfMissing: true }),
  name: "school.sid",
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1e3
  }
}));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth/login", rateLimit({ windowMs: 15 * 60 * 1e3, limit: 10, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth/signup", rateLimit({ windowMs: 15 * 60 * 1e3, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth/forgot-password", rateLimit({ windowMs: 15 * 60 * 1e3, limit: 5, standardHeaders: true, legacyHeaders: false }));
app.use("/api/auth", authRouter);
app.use("/api", authenticate);
app.use("/api/school", schoolRouter);
app.use("/api/students", studentsRouter);
app.use("/api/exams", examsRouter);
app.use("/api/dashboard", dashboardRouter);
app.use(notFound);
app.use(errorHandler);
const server = app.listen(port, () => {
  console.log(`School Management API listening on http://localhost:${port}`);
});
async function shutdown() {
  server.close();
  await prisma.$disconnect();
  await pool.end();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
