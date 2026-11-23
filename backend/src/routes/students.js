import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role, StudentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { allowRoles } from "../middleware/auth.js";
import { asyncRoute, HttpError } from "../middleware/errors.js";
import { generateAdmissionNumber } from "../utils/admission-number.js";
const studentsRouter = Router();
const adminOnly = allowRoles(Role.ADMIN);
const enrollmentInput = z.object({
  classId: z.string().uuid(),
  sectionId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  rollNumber: z.string().trim().min(1).max(20)
});
const studentInput = z.object({
  admissionNo: z.string().trim().min(1).max(40).optional(),
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.string().max(30).optional(),
  guardianName: z.string().max(120).optional(),
  guardianPhone: z.string().max(30).optional(),
  guardianEmail: z.string().email().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().max(500).optional(),
  photoUrl: z.string().url().optional().or(z.literal("")),
  admissionDate: z.coerce.date().optional(),
  loginPassword: z.string().min(12).max(128).optional(),
  enrollment: enrollmentInput
});
const profileInclude = {
  parent: true,
  enrollments: {
    where: { active: true },
    include: { schoolClass: true, section: true, academicYear: true }
  }
};
async function studentWhere(user, query) {
  const where = {};
  const enrollmentFilters = [{ active: true }];
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { admissionNo: { contains: search, mode: "insensitive" } },
      { enrollments: { some: { rollNumber: { contains: search, mode: "insensitive" } } } }
    ];
  }
  if (typeof query.classId === "string") enrollmentFilters.push({ classId: query.classId });
  if (typeof query.sectionId === "string") enrollmentFilters.push({ sectionId: query.sectionId });
  if (user?.role === Role.STUDENT) {
    where.id = user.profileId ?? "__missing_student_profile__";
  } else if (user?.role === Role.TEACHER && user.profileId) {
    const [homerooms, assignments] = await prisma.$transaction([
      prisma.schoolClass.findMany({ where: { classTeacherId: user.profileId }, select: { id: true } }),
      prisma.teacherAssignment.findMany({
        where: { teacherId: user.profileId },
        select: { sectionId: true, classSubject: { select: { classId: true } } }
      })
    ]);
    const allowed = [
      ...homerooms.length ? [{ classId: { in: homerooms.map(({ id }) => id) } }] : [],
      ...assignments.map(({ sectionId, classSubject }) => ({
        classId: classSubject.classId,
        ...sectionId ? { sectionId } : {}
      }))
    ];
    if (!allowed.length) allowed.push({ id: "__no_assigned_enrollment__" });
    enrollmentFilters.push({ OR: allowed });
  }
  where.AND = [
    ...where.OR ? [{ OR: where.OR }] : [],
    { enrollments: { some: { AND: enrollmentFilters } } }
  ];
  delete where.OR;
  return where;
}
async function validateEnrollment(enrollment) {
  const section = await prisma.section.findUnique({
    where: { id: enrollment.sectionId },
    include: { schoolClass: true }
  });
  if (!section || section.classId !== enrollment.classId || section.schoolClass.academicYearId !== enrollment.academicYearId) {
    throw new HttpError(400, "Selected class, section, and academic year do not match");
  }
}
studentsRouter.get("/", asyncRoute(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
  const where = {
    ...await studentWhere(req.user, req.query),
    ...req.query.status === "INACTIVE" ? { status: StudentStatus.INACTIVE } : { status: StudentStatus.ACTIVE }
  };
  const [total, items] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      include: profileInclude,
      orderBy: { fullName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);
  res.json({ items, page, pageSize, total, pages: Math.ceil(total / pageSize) });
}));
studentsRouter.get("/:studentId", asyncRoute(async (req, res) => {
  const student = await prisma.student.findFirst({
    where: { id: req.params.studentId, ...await studentWhere(req.user, {}) },
    include: {
      ...profileInclude,
      results: {
        include: { examination: { select: { id: true, name: true, type: true, academicYear: true } } },
        orderBy: { createdAt: "desc" }
      }
    }
  });
  if (!student) throw new HttpError(404, "Student not found");
  res.json(student);
}));
studentsRouter.post("/", adminOnly, asyncRoute(async (req, res) => {
  const input = studentInput.parse(req.body);
  await validateEnrollment(input.enrollment);
  const { enrollment, loginPassword, guardianName, guardianPhone, guardianEmail, ...data } = input;
  const email = data.email?.toLowerCase() || void 0;
  const admissionNo = data.admissionNo || generateAdmissionNumber();
  const passwordHash = loginPassword ? await bcrypt.hash(loginPassword, 12) : undefined;
  const created = await prisma.student.create({
    data: {
      ...data,
      admissionNo,
      email,
      ...passwordHash && email ? {
        user: { create: { email, passwordHash, role: Role.STUDENT } }
      } : {},
      ...guardianName || guardianPhone || guardianEmail ? {
        parent: { create: { fullName: guardianName || "Parent / guardian", phone: guardianPhone, email: guardianEmail || void 0 } }
      } : {},
      enrollments: { create: enrollment }
    },
    include: profileInclude
  });
  res.status(201).json(created);
}));
studentsRouter.post("/import", adminOnly, asyncRoute(async (req, res) => {
  const importStudentInput = studentInput.omit({ loginPassword: true }).extend({
    admissionNo: z.string().trim().min(1).max(40)
  });
  const rows = z.array(importStudentInput).min(1).max(500).parse(req.body.rows);
  for (const row of rows) await validateEnrollment(row.enrollment);
  const created = await prisma.$transaction(async (tx) => {
    const students = [];
    for (const { enrollment, guardianName, guardianPhone, guardianEmail, ...data } of rows) {
      students.push(await tx.student.create({
        data: {
          ...data,
          email: data.email?.toLowerCase() || void 0,
          ...guardianName || guardianPhone || guardianEmail ? {
            parent: { create: { fullName: guardianName || "Parent / guardian", phone: guardianPhone, email: guardianEmail || void 0 } }
          } : {},
          enrollments: { create: enrollment }
        },
        select: { id: true, admissionNo: true, fullName: true }
      }));
    }
    return students;
  });
  res.status(201).json({ imported: created.length, students: created });
}));
studentsRouter.patch("/:studentId", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    admissionNo: z.string().trim().min(1).max(40).optional(),
    fullName: z.string().trim().min(2).max(120).optional(),
    dateOfBirth: z.coerce.date().nullable().optional(),
    gender: z.string().max(30).nullable().optional(),
    guardianName: z.string().max(120).nullable().optional(),
    guardianPhone: z.string().max(30).nullable().optional(),
    guardianEmail: z.string().email().nullable().optional(),
    email: z.string().email().nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    photoUrl: z.string().url().nullable().optional(),
    admissionDate: z.coerce.date().optional(),
    status: z.nativeEnum(StudentStatus).optional(),
    enrollment: enrollmentInput.optional()
  }).parse(req.body);
  if (input.enrollment) await validateEnrollment(input.enrollment);
  const { enrollment, guardianName, guardianPhone, guardianEmail, ...studentData } = input;
  await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id: req.params.studentId },
      select: {
        id: true,
        userId: true,
        parent: true,
        enrollments: {
          where: { active: true },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, academicYearId: true }
        }
      }
    });
    if (!student) throw new HttpError(404, "Student not found");
    if (student.userId && studentData.email !== void 0) {
      if (!studentData.email) throw new HttpError(400, "A student account must keep an email address");
      studentData.email = studentData.email.toLowerCase();
    }
    await tx.student.update({
      where: { id: student.id },
      data: { ...studentData, email: studentData.email?.toLowerCase() ?? studentData.email }
    });
    if (student.userId && studentData.email !== void 0) {
      await tx.user.update({ where: { id: student.userId }, data: { email: studentData.email } });
    }
    if (guardianName !== void 0 || guardianPhone !== void 0 || guardianEmail !== void 0) {
      const currentParent = student.parent;
      const parentData = {
        fullName: guardianName ?? currentParent?.fullName ?? "Parent / guardian",
        phone: guardianPhone ?? currentParent?.phone ?? null,
        email: guardianEmail ?? currentParent?.email ?? null
      };
      if (currentParent) await tx.parent.update({ where: { id: currentParent.id }, data: parentData });
      else await tx.parent.create({ data: { studentId: student.id, ...parentData } });
    }
    if (enrollment) {
      const currentEnrollment = student.enrollments[0];
      if (currentEnrollment?.academicYearId === enrollment.academicYearId) {
        await tx.enrollment.update({ where: { id: currentEnrollment.id }, data: enrollment });
      } else {
        await tx.enrollment.updateMany({
          where: { studentId: student.id, active: true },
          data: { active: false }
        });
        await tx.enrollment.create({ data: { studentId: student.id, ...enrollment } });
      }
    }
  }, { maxWait: 10000, timeout: 30000 });
  const updated = await prisma.student.findUnique({
    where: { id: req.params.studentId },
    include: profileInclude
  });
  if (!updated) throw new HttpError(404, "Student not found");
  res.json(updated);
}));
studentsRouter.delete("/:studentId", adminOnly, asyncRoute(async (req, res) => {
  await prisma.$transaction([
    prisma.student.update({ where: { id: req.params.studentId }, data: { status: StudentStatus.INACTIVE } }),
    prisma.enrollment.updateMany({ where: { studentId: req.params.studentId, active: true }, data: { active: false } })
  ]);
  res.status(204).end();
}));
export {
  studentsRouter
};
