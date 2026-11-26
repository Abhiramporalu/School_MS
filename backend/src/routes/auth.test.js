import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
// #commitnow
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn() },
    student: { findFirst: vi.fn() },
    passwordResetRequest: { findFirst: vi.fn(), create: vi.fn() }
  }
}));
vi.mock("../db.js", () => ({ prisma: prismaMock }));

const { authRouter } = await import("./auth.js");

describe("POST /auth/forgot-password", () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    vi.resetAllMocks();
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.student.findFirst.mockResolvedValue(null);
    prismaMock.passwordResetRequest.findFirst.mockResolvedValue(null);
    prismaMock.passwordResetRequest.create.mockResolvedValue({ id: "request-id" });

    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRouter);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/forgot-password`;
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  async function submit(email = "student@example.com") {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    return { response, body: await response.json() };
  }

  it("creates an admin-review request for an active student who does not have a login yet", async () => {
    prismaMock.student.findFirst.mockResolvedValue({ id: "student-id" });

    const { response, body } = await submit(" Student@Example.com ");

    expect(response.status).toBe(202);
    expect(body.message).toContain("sent to the school administrator");
    expect(prismaMock.passwordResetRequest.create).toHaveBeenCalledWith({
      data: { email: "student@example.com" }
    });
  });

  it("creates a reset request for an existing user account", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "user-id" });

    const { response } = await submit();

    expect(response.status).toBe(202);
    expect(prismaMock.student.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.passwordResetRequest.create).toHaveBeenCalledWith({
      data: { email: "student@example.com" }
    });
  });

  it("returns the same response without creating a request for an unknown email", async () => {
    const { response, body } = await submit();

    expect(response.status).toBe(202);
    expect(body.message).toContain("sent to the school administrator");
    expect(prismaMock.passwordResetRequest.create).not.toHaveBeenCalled();
  });
});
