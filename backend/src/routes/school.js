import { Router } from "express";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { allowRoles } from "../middleware/auth.js";
import { asyncRoute, HttpError } from "../middleware/errors.js";
const schoolRouter = Router();
const adminOnly = allowRoles(Role.ADMIN);
schoolRouter.get("/profile", asyncRoute(async (_req, res) => {
  res.json(await prisma.schoolProfile.findUnique({ where: { id: "school-profile" } }));
}));
schoolRouter.put("/profile", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(120),
    address: z.string().trim().max(300).optional(),
    logoUrl: z.string().url().optional().or(z.literal("")),
    principalName: z.string().trim().max(120).optional()
  }).parse(req.body);
  res.json(await prisma.schoolProfile.upsert({
    where: { id: "school-profile" },
    create: { id: "school-profile", ...input, logoUrl: input.logoUrl || null },
    update: { ...input, logoUrl: input.logoUrl || null }
  }));
}));
schoolRouter.get("/academic-years", asyncRoute(async (_req, res) => {
  res.json(await prisma.academicYear.findMany({ orderBy: { startsOn: "desc" } }));
}));
schoolRouter.post("/academic-years", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(4).max(40),
    startsOn: z.coerce.date(),
    endsOn: z.coerce.date(),
    isCurrent: z.boolean().default(false)
  }).parse(req.body);
  if (input.endsOn <= input.startsOn) throw new HttpError(400, "Academic year end must be after its start");
  const year = await prisma.$transaction(async (tx) => {
    if (input.isCurrent) await tx.academicYear.updateMany({ data: { isCurrent: false } });
    return tx.academicYear.create({ data: input });
  });
  res.status(201).json(year);
}));
schoolRouter.get("/classes", asyncRoute(async (req, res) => {
  const where = {};
  if (req.user?.role === Role.TEACHER && req.user.profileId) {
    where.OR = [
      { classTeacherId: req.user.profileId },
      { subjects: { some: { assignments: { some: { teacherId: req.user.profileId } } } } }
    ];
  } else if (req.user?.role === Role.STUDENT && req.user.profileId) {
    where.enrollments = { some: { studentId: req.user.profileId, active: true } };
  }
  const classes = await prisma.schoolClass.findMany({
    where,
    include: {
      academicYear: true,
      classTeacher: { select: { id: true, fullName: true } },
      sections: { orderBy: { name: "asc" }, include: { _count: { select: { enrollments: { where: { active: true } } } } } },
      subjects: { include: { subject: true, assignments: { include: { teacher: { select: { id: true, fullName: true } } } } } },
      _count: { select: { enrollments: { where: { active: true } } } }
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }]
  });
  res.json(classes);
}));
schoolRouter.post("/classes", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(40),
    grade: z.number().int().min(1).max(12),
    academicYearId: z.string().uuid(),
    sections: z.array(z.string().trim().min(1).max(20)).default(["A"]),
    classTeacherId: z.string().uuid().optional()
  }).parse(req.body);
  const { sections, ...classData } = input;
  const created = await prisma.schoolClass.create({
    data: {
      ...classData,
      sections: { create: [...new Set(sections)].map((name) => ({ name })) }
    },
    include: { sections: true, academicYear: true }
  });
  res.status(201).json(created);
}));
schoolRouter.patch("/classes/:classId", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(40).optional(),
    grade: z.number().int().min(1).max(12).optional(),
    classTeacherId: z.string().uuid().nullable().optional()
  }).refine((data) => Object.keys(data).length > 0, "Provide at least one class field to update").parse(req.body);
  res.json(await prisma.schoolClass.update({
    where: { id: req.params.classId },
    data: input,
    include: { sections: true, academicYear: true, classTeacher: { select: { id: true, fullName: true } } }
  }));
}));
schoolRouter.post("/classes/:classId/sections", adminOnly, asyncRoute(async (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(20) }).parse(req.body);
  const section = await prisma.section.create({ data: { name, classId: req.params.classId } });
  res.status(201).json(section);
}));
schoolRouter.get("/subjects", asyncRoute(async (req, res) => {
  const subjects = await prisma.subject.findMany({
    include: { classes: { include: { schoolClass: true } } },
    orderBy: { name: "asc" }
  });
  res.json(subjects);
}));
schoolRouter.post("/subjects", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(80),
    code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase())
  }).parse(req.body);
  res.status(201).json(await prisma.subject.create({ data: input }));
}));
schoolRouter.post("/classes/:classId/subjects", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    subjectId: z.string().uuid(),
    maxMarks: z.number().positive().max(1e4),
    passMarks: z.number().min(0).max(1e4)
  }).parse(req.body);
  if (input.passMarks > input.maxMarks) throw new HttpError(400, "Passing marks cannot exceed maximum marks");
  const row = await prisma.classSubject.create({
    data: {
      classId: req.params.classId,
      subjectId: input.subjectId,
      maxMarks: input.maxMarks,
      passMarks: input.passMarks
    },
    include: { subject: true }
  });
  res.status(201).json(row);
}));
schoolRouter.get("/teachers", asyncRoute(async (_req, res) => {
  res.json(await prisma.teacher.findMany({
    select: { id: true, employeeNo: true, fullName: true, phone: true, user: { select: { email: true } } },
    orderBy: { fullName: "asc" }
  }));
}));
schoolRouter.post("/teachers", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    fullName: z.string().trim().min(2).max(120),
    employeeNo: z.string().trim().min(1).max(40),
    email: z.string().email().transform((value) => value.toLowerCase()),
    phone: z.string().max(30).optional(),
    password: z.string().min(12).max(128)
  }).parse(req.body);
  const passwordHash = await bcrypt.hash(input.password, 12);
  const teacher = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email: input.email, passwordHash, role: Role.TEACHER } });
    return tx.teacher.create({
      data: { userId: user.id, employeeNo: input.employeeNo, fullName: input.fullName, phone: input.phone },
      include: { user: { select: { email: true } } }
    });
  });
  res.status(201).json(teacher);
}));
schoolRouter.post("/assignments/bulk", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    teacherId: z.string().uuid(),
    assignments: z.array(z.object({
      classSubjectId: z.string().uuid(),
      sectionId: z.string().uuid().nullable()
    })).min(1).max(100).refine(
      (assignments) => new Set(assignments.map(({ classSubjectId, sectionId }) => `${classSubjectId}:${sectionId ?? "all"}`)).size === assignments.length,
      "Each class and section can only be selected once"
    )
  }).parse(req.body);
  const classSubjectIds = [...new Set(input.assignments.map(({ classSubjectId }) => classSubjectId))];
  const classSubjects = await prisma.classSubject.findMany({
    where: { id: { in: classSubjectIds } },
    select: { id: true, classId: true }
  });
  if (classSubjects.length !== classSubjectIds.length) {
    throw new HttpError(400, "One or more selected class subjects do not exist");
  }
  const classIdBySubjectId = new Map(classSubjects.map(({ id, classId }) => [id, classId]));
  const sectionIds = [...new Set(input.assignments.flatMap(({ sectionId }) => sectionId ? [sectionId] : []))];
  const sections = sectionIds.length ? await prisma.section.findMany({
    where: { id: { in: sectionIds } },
    select: { id: true, classId: true }
  }) : [];
  const classIdBySectionId = new Map(sections.map(({ id, classId }) => [id, classId]));
  if (sections.length !== sectionIds.length || input.assignments.some(({ classSubjectId, sectionId }) => (
    sectionId && classIdBySectionId.get(sectionId) !== classIdBySubjectId.get(classSubjectId)
  ))) {
    throw new HttpError(400, "Each selected section must belong to its selected class");
  }
  const existing = await prisma.teacherAssignment.findMany({
    where: {
      teacherId: input.teacherId,
      classSubjectId: { in: classSubjectIds }
    },
    select: { classSubjectId: true, sectionId: true }
  });
  const conflicts = input.assignments.filter(({ classSubjectId, sectionId }) => existing.some((assignment) => (
    assignment.classSubjectId === classSubjectId && (
      assignment.sectionId === null || sectionId === null || assignment.sectionId === sectionId
    )
  )));
  if (conflicts.length) {
    throw new HttpError(409, "The teacher is already assigned to one or more selected classes or sections");
  }
  const result = await prisma.teacherAssignment.createMany({
    data: input.assignments.map(({ classSubjectId, sectionId }) => ({
      teacherId: input.teacherId,
      classSubjectId,
      sectionId
    }))
  });
  res.status(201).json({ assigned: result.count });
}));
schoolRouter.post("/assignments", adminOnly, asyncRoute(async (req, res) => {
  const input = z.object({
    teacherId: z.string().uuid(),
    classSubjectId: z.string().uuid(),
    sectionId: z.string().uuid().optional()
  }).parse(req.body);
  const classSubject = await prisma.classSubject.findUnique({ where: { id: input.classSubjectId }, select: { classId: true } });
  const section = input.sectionId ? await prisma.section.findUnique({ where: { id: input.sectionId }, select: { classId: true } }) : null;
  if (!classSubject || input.sectionId && section?.classId !== classSubject.classId) {
    throw new HttpError(400, "The selected section must belong to the subject's class");
  }
  const duplicate = await prisma.teacherAssignment.findFirst({
    where: {
      teacherId: input.teacherId,
      classSubjectId: input.classSubjectId,
      sectionId: input.sectionId ?? null
    }
  });
  if (duplicate) throw new HttpError(409, "This teacher is already assigned to the selected subject and section");
  res.status(201).json(await prisma.teacherAssignment.create({
    data: input,
    include: { teacher: true, classSubject: { include: { subject: true, schoolClass: true } }, section: true }
  }));
}));
export {
  schoolRouter
};
