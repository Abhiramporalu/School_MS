import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../src/db.js";

const email = z.string().email().max(254).parse(process.env.ADMIN_EMAIL ?? "admin@school.local").toLowerCase();
const password = randomBytes(24).toString("base64url");

try {
  const account = await prisma.$transaction(async (tx) => {
    const adminCount = await tx.user.count({ where: { role: Role.ADMIN } });
    if (adminCount > 0) throw new Error("An administrator already exists; refusing to create another bootstrap account.");

    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new Error(`The email ${email} is already in use.`);

    const passwordHash = await bcrypt.hash(password, 12);
    return tx.user.create({
      data: { email, passwordHash, role: Role.ADMIN },
      select: { email: true, role: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  console.log("Administrator created. Save this generated password now; it will not be shown again.");
  console.log(`Email: ${account.email}`);
  console.log(`Password: ${password}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Could not create administrator.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
