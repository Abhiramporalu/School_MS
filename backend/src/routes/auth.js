import { randomBytes } from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role, RequestStatus, StudentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { allowRoles, authenticate } from "../middleware/auth.js";
import { asyncRoute, HttpError } from "../middleware/errors.js";

const authRouter = Router();
const adminOnly = allowRoles(Role.ADMIN);
const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128)
});
const registrationSchema = z.object({
  email: emailSchema,
  password: z.string().min(12).max(128),
  fullName: z.string().trim().min(2).max(120),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT"]),
  employeeNo: z.string().trim().min(1).max(40).optional(),
  admissionNo: z.string().trim().min(1).max(40).optional(),
  phone: z.string().trim().max(30).optional()
}).superRefine((request, context) => {
  if (request.role === "TEACHER" && !request.employeeNo) {
    context.addIssue({ code: "custom", path: ["employeeNo"], message: "Employee number is required for teacher registration" });
  }
  if (request.role === "STUDENT" && !request.admissionNo) {
    context.addIssue({ code: "custom", path: ["admissionNo"], message: "Admission number is required for student registration" });
  }
});

authRouter.post("/signup", asyncRoute(async (req, res) => {
  const input = registrationSchema.parse(req.body);
  const existingUser = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  const pendingRequest = await prisma.registrationRequest.findFirst({
    where: { email: input.email, status: RequestStatus.PENDING },
    select: { id: true }
  });
  if (!existingUser && !pendingRequest) {
    const passwordHash = await bcrypt.hash(input.password, 12);
    const data = {
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      requestedRole: input.role,
      employeeNo: input.employeeNo,
      admissionNo: input.admissionNo,
      phone: input.phone,
      status: RequestStatus.PENDING
    };
    const previouslyRejected = await prisma.registrationRequest.findFirst({
      where: { email: input.email, status: RequestStatus.REJECTED },
      select: { id: true }
    });
    if (previouslyRejected) {
      await prisma.registrationRequest.update({ where: { id: previouslyRejected.id }, data });
    } else {
      await prisma.registrationRequest.create({ data });
    }
  }
  res.status(202).json({ message: "Your request has been submitted for administrator approval. You can sign in once it is approved." });
}));

authRouter.post("/forgot-password", asyncRoute(async (req, res) => {
  const { email } = z.object({ email: emailSchema }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const studentWithoutLogin = user ? null : await prisma.student.findFirst({
    where: { email, userId: null, status: StudentStatus.ACTIVE },
    select: { id: true }
  });
  if (user || studentWithoutLogin) {
    const existingRequest = await prisma.passwordResetRequest.findFirst({
      where: { email, status: RequestStatus.PENDING },
      select: { id: true }
    });
    if (!existingRequest) await prisma.passwordResetRequest.create({ data: { email } });
  }
  res.status(202).json({ message: "If an account exists for that email, a password-reset request has been sent to the school administrator." });
}));

authRouter.post("/login", asyncRoute(async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { teacher: true, student: true }
  });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.userId = user.id;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.teacher?.fullName ?? user.student?.fullName ?? "School administrator",
      profileId: user.teacher?.id ?? user.student?.id ?? null
    }
  });
}));

authRouter.get("/admin/registration-requests", authenticate, adminOnly, asyncRoute(async (_req, res) => {
  const requests = await prisma.registrationRequest.findMany({
    where: { status: RequestStatus.PENDING },
    select: {
      id: true,
      email: true,
      fullName: true,
      requestedRole: true,
      employeeNo: true,
      admissionNo: true,
      phone: true,
      createdAt: true
    },
    orderBy: { createdAt: "asc" }
  });
  res.json(requests);
}));

authRouter.post("/admin/registration-requests/:id/approve", authenticate, adminOnly, asyncRoute(async (req, res) => {
  const account = await prisma.$transaction(async (tx) => {
    const request = await tx.registrationRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== RequestStatus.PENDING) throw new HttpError(404, "Pending signup request not found");
    if (!request.passwordHash) throw new HttpError(409, "This signup request cannot be approved");
    if (await tx.user.findUnique({ where: { email: request.email }, select: { id: true } })) {
      throw new HttpError(409, "An account already exists for this email");
    }
    let existingStudent = null;
    if (request.requestedRole === Role.STUDENT) {
      if (!request.admissionNo) throw new HttpError(400, "Student request is missing an admission number");
      existingStudent = await tx.student.findUnique({ where: { admissionNo: request.admissionNo } });
      const studentWithEmail = await tx.student.findUnique({ where: { email: request.email } });
      if (studentWithEmail && studentWithEmail.id !== existingStudent?.id) {
        throw new HttpError(409, "This email is already linked to a different student record");
      }
      if (existingStudent && (existingStudent.userId || existingStudent.status !== "ACTIVE" ||
          existingStudent.email && existingStudent.email !== request.email)) {
        throw new HttpError(409, "This student record cannot be linked to the requested account");
      }
    }

    const user = await tx.user.create({
      data: { email: request.email, passwordHash: request.passwordHash, role: request.requestedRole }
    });
    if (request.requestedRole === Role.TEACHER) {
      if (!request.employeeNo) throw new HttpError(400, "Teacher request is missing an employee number");
      await tx.teacher.create({
        data: { userId: user.id, employeeNo: request.employeeNo, fullName: request.fullName, phone: request.phone }
      });
    } else if (request.requestedRole === Role.STUDENT) {
      if (existingStudent) {
        await tx.student.update({
          where: { id: existingStudent.id },
          data: { userId: user.id, email: request.email }
        });
      } else {
        await tx.student.create({
          data: {
            userId: user.id,
            admissionNo: request.admissionNo,
            fullName: request.fullName,
            email: request.email
          }
        });
      }
    }
    await tx.registrationRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.APPROVED, passwordHash: null }
    });
    return { email: user.email, role: user.role, fullName: request.fullName };
  });
  res.json({ account });
}));

authRouter.post("/admin/registration-requests/:id/reject", authenticate, adminOnly, asyncRoute(async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const request = await tx.registrationRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== RequestStatus.PENDING) throw new HttpError(404, "Pending signup request not found");
    await tx.registrationRequest.update({
      where: { id: request.id },
      data: { status: RequestStatus.REJECTED, passwordHash: null }
    });
  });
  res.status(204).end();
}));

authRouter.get("/admin/password-reset-requests", authenticate, adminOnly, asyncRoute(async (_req, res) => {
  const requests = await prisma.passwordResetRequest.findMany({
    where: { status: RequestStatus.PENDING },
    orderBy: { createdAt: "asc" }
  });
  const results = await Promise.all(requests.map(async (request) => {
    const user = await prisma.user.findUnique({
      where: { email: request.email },
      include: { teacher: { select: { fullName: true } }, student: { select: { fullName: true } } }
    });
    const unlinkedStudent = user ? null : await prisma.student.findFirst({
      where: { email: request.email, userId: null, status: StudentStatus.ACTIVE },
      select: { fullName: true }
    });
    return {
      id: request.id,
      email: request.email,
      fullName: user?.teacher?.fullName ?? user?.student?.fullName ?? unlinkedStudent?.fullName ?? "School administrator",
      role: user?.role ?? (unlinkedStudent ? Role.STUDENT : null),
      requiresAccountCreation: Boolean(unlinkedStudent),
      createdAt: request.createdAt
    };
  }));
  res.json(results);
}));

authRouter.post("/admin/password-reset-requests/:id/complete", authenticate, adminOnly, asyncRoute(async (req, res) => {
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const accountCreated = await prisma.$transaction(async (tx) => {
    const request = await tx.passwordResetRequest.findUnique({ where: { id: req.params.id } });
    if (!request || request.status !== RequestStatus.PENDING) throw new HttpError(404, "Pending password-reset request not found");
    const user = await tx.user.findUnique({ where: { email: request.email }, select: { id: true } });
    let accountCreated = false;
    if (user) {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    } else {
      const student = await tx.student.findFirst({
        where: { email: request.email, userId: null, status: StudentStatus.ACTIVE },
        select: { id: true }
      });
      if (!student) throw new HttpError(404, "Account no longer exists");
      const newUser = await tx.user.create({
        data: { email: request.email, passwordHash, role: Role.STUDENT }
      });
      const linkedStudent = await tx.student.updateMany({
        where: { id: student.id, userId: null, status: StudentStatus.ACTIVE },
        data: { userId: newUser.id }
      });
      if (linkedStudent.count !== 1) throw new HttpError(409, "Student account was linked by another request");
      accountCreated = true;
    }
    await tx.passwordResetRequest.update({ where: { id: request.id }, data: { status: RequestStatus.APPROVED } });
    return accountCreated;
  });
  res.json({
    temporaryPassword,
    accountCreated,
    message: "Verify the requester's identity, then share this temporary password with them through a trusted channel."
  });
}));

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("school.sid");
    res.status(204).end();
  });
});

authRouter.get("/me", asyncRoute(async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    include: { teacher: true, student: true }
  });
  if (!user) {
    res.status(401).json({ error: "Session is no longer valid" });
    return;
  }
  res.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.teacher?.fullName ?? user.student?.fullName ?? "School administrator",
      profileId: user.teacher?.id ?? user.student?.id ?? null
    }
  });
}));

export { authRouter };
