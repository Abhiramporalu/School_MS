import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
}
const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
const notFound = (_req, res) => {
  res.status(404).json({ error: "Not found" });
};
const errorHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.issues });
    return;
  }
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ error: "A record with one of these unique values already exists" });
      return;
    }
    if (error.code === "P2003") {
      res.status(400).json({ error: "The selected related record is invalid" });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ error: "The requested record was not found" });
      return;
    }
  }
  console.error(error);
  res.status(500).json({ error: "An unexpected server error occurred" });
};
export {
  HttpError,
  asyncRoute,
  errorHandler,
  notFound
};
