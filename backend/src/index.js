
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

// Environment configuration
const isProduction = process.env.NODE_ENV === "production";

const sessionSecret = process.env.SESSION_SECRET;
const clientOrigin = process.env.CLIENT_ORIGIN;

if (!sessionSecret || sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must contain at least 32 characters"
  );
}

if (!clientOrigin) {
  throw new Error("CLIENT_ORIGIN environment variable is required");
}

// Express application
const app = express();

app.set("trust proxy", isProduction ? 1 : false);

// Security middleware
app.use(helmet());

app.use(
  cors({
    origin: clientOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

app.use(
  morgan(isProduction ? "combined" : "dev")
);

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isProduction ? { ssl: { rejectUnauthorized: false } } : {})
});

// PostgreSQL session store
const PgSessionStore = connectPgSimple(session);

const sessionStore = new PgSessionStore({
  pool,
  createTableIfMissing: true
});

// Session configuration
app.use(
  session({
    store: sessionStore,
    name: "school.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000
    }
  })
);

// Root route
app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "School Management API is running"
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API is healthy"
  });
});

// Rate limiting
app.use(
  "/api/auth/login",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  "/api/auth/signup",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use(
  "/api/auth/forgot-password",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Authentication routes
app.use("/api/auth", authRouter);

// Protected routes
app.use("/api", authenticate);

app.use("/api/school", schoolRouter);
app.use("/api/students", studentsRouter);
app.use("/api/exams", examsRouter);
app.use("/api/dashboard", dashboardRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;

if (process.env.VERCEL !== "1") {
  const port = Number(process.env.PORT ?? 4000);
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
}
