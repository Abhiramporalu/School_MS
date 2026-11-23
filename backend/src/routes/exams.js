import { Router } from "express";
import { ExamStatus, Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../db.js";
import { allowRoles } from "../middleware/auth.js";
import { asyncRoute, HttpError } from "../middleware/errors.js";
import { calculateResult } from "../utils/results.js";
const examsRouter = Router();
const adminOnly = allowRoles(Role.ADMIN);
const examInclude = {
  academicYear: true,
  schoolClass: true,
  section: true,
  subjects: { include: { classSubject: { include: { subject: true } } } }
};
async function assertTeacherAssignment(teacherId, classSubjectId, examSectionId, studentId) {
  const classSubject = await prisma.classSubject.findUniqueOrThrow({ where: { id: classSubjectId } });
  const enrollments = await prisma.enrollment.findMany({
    where: {
      active: true,
      classId: classSubject.classId,
      ...examSectionId ? { sectionId: examSectionId } : {},
      ...studentId ? { studentId } : {}
    },
    select: { sectionId: true }
  });
  if (!enrollments.length) throw new HttpError(404, "Student is not enrolled in this examination class");
  const relevantSections = new Set(enrollments.map(({ sectionId }) => sectionId));
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      teacherId,
      classSubjectId,
      OR: [{ sectionId: null }, { sectionId: { in: [...relevantSections] } }]
    },
    select: { sectionId: true }
  });
  const canEdit = enrollments.some(
    ({ sectionId }) => assignments.some((assignment) => assignment.sectionId === null || assignment.sectionId === sectionId)
  );
  if (!canEdit) throw new HttpError(403, "You are not assigned to this subject and class");
  if (examSectionId && enrollments.some(({ sectionId }) => sectionId !== examSectionId)) {
    throw new HttpError(404, "Student is not enrolled in this examination section");
  }
  return [...new Set(enrollments.filter(({ sectionId }) => assignments.some((assignment) => assignment.sectionId === null || assignment.sectionId === sectionId)).map(({ sectionId }) => sectionId))];
}
examsRouter.get("/", asyncRoute(async (req, res) => {
  const where = {};
  if (typeof req.query.academicYearId === "string") where.academicYearId = req.query.academicYearId;
  if (typeof req.query.classId === "string") where.classId = req.query.classId;
  if (req.user?.role === Role.STUDENT && req.user.profileId) {
    where.schoolClass = { enrollments: { some: { studentId: req.user.profileId, active: true } } };
  }
  if (req.user?.role === Role.TEACHER && req.user.profileId) {
    where.subjects = { some: { classSubject: { assignments: { some: { teacherId: req.user.profileId } } } } };
  }
  const exams = await prisma.examination.findMany({
    where,
    include: {
      ...examInclude,
      ...req.user?.role === Role.TEACHER && req.user.profileId ? {
        subjects: {
          where: { classSubject: { assignments: { some: { teacherId: req.user.profileId } } } },
          include: { classSubject: { include: { subject: true } } }
        }
      } : {},
      _count: { select: { results: true } }
    },
    orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }]
  });
  res.json(exams);
}));
examsRouter.post("/", allowRoles(Role.ADMIN, Role.TEACHER), asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().trim().min(2).max(100),
    type: z.string().trim().min(2).max(60),
    academicYearId: z.string().uuid(),
    classId: z.string().uuid(),
    sectionId: z.string().uuid().optional(),
    startsOn: z.coerce.date().optional(),
    endsOn: z.coerce.date().optional(),
    distinctionPct: z.number().min(0).max(100).default(75),
    subjects: z.array(z.object({
      classSubjectId: z.string().uuid(),
      examDate: z.coerce.date().optional(),
      maxMarks: z.number().positive().max(1e4),
      passMarks: z.number().min(0).max(1e4)
    })).min(1)
  }).parse(req.body);
  if (input.endsOn && input.startsOn && input.endsOn < input.startsOn) {
    throw new HttpError(400, "Examination end date must be on or after its start date");
  }
  if (input.subjects.some((subject) => subject.passMarks > subject.maxMarks)) {
    throw new HttpError(400, "Passing marks cannot exceed maximum marks");
  }
  if (new Set(input.subjects.map(({ classSubjectId }) => classSubjectId)).size !== input.subjects.length) {
    throw new HttpError(400, "An examination cannot include the same subject more than once");
  }
  const classSubjects = await prisma.classSubject.findMany({
    where: { id: { in: input.subjects.map(({ classSubjectId }) => classSubjectId) } },
    select: { id: true, classId: true }
  });
  if (classSubjects.length !== input.subjects.length || classSubjects.some(({ classId }) => classId !== input.classId)) {
    throw new HttpError(400, "All examination subjects must belong to the selected class");
  }
  if (req.user?.role === Role.TEACHER) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        teacherId: req.user.profileId,
        classSubjectId: { in: input.subjects.map(({ classSubjectId }) => classSubjectId) },
        OR: input.sectionId ? [{ sectionId: null }, { sectionId: input.sectionId }] : [{ sectionId: null }]
      },
      select: { classSubjectId: true }
    });
    const assigned = new Set(assignments.map(({ classSubjectId }) => classSubjectId));
    if (input.subjects.some(({ classSubjectId }) => !assigned.has(classSubjectId))) {
      throw new HttpError(403, "You may only create examinations for your assigned subjects and sections");
    }
  }
  if (input.sectionId) {
    const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
    if (!section || section.classId !== input.classId) throw new HttpError(400, "Section does not belong to this class");
  }
  const { subjects, ...exam } = input;
  const created = await prisma.examination.create({
    data: {
      ...exam,
      status: ExamStatus.MARKS_ENTRY,
      subjects: { create: subjects }
    },
    include: examInclude
  });
  res.status(201).json(created);
}));
examsRouter.get("/:examId/marks/:examSubjectId", asyncRoute(async (req, res) => {
  const exam = await prisma.examination.findUnique({
    where: { id: req.params.examId },
    include: { ...examInclude }
  });
  if (!exam) throw new HttpError(404, "Examination not found");
  const examSubject = exam.subjects.find(({ id }) => id === req.params.examSubjectId);
  if (!examSubject) throw new HttpError(404, "Subject is not part of this examination");
  if (req.user?.role === Role.STUDENT) throw new HttpError(403, "Students cannot access marks-entry data");
  const allowedSections = req.user?.role === Role.TEACHER ? await assertTeacherAssignment(req.user.profileId, examSubject.classSubjectId, exam.sectionId) : void 0;
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      enrollments: {
        some: {
          active: true,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          ...exam.sectionId ? { sectionId: exam.sectionId } : {},
          ...allowedSections ? { sectionId: { in: allowedSections } } : {}
        }
      }
    },
    include: {
      enrollments: {
        where: {
          active: true,
          classId: exam.classId,
          ...allowedSections ? { sectionId: { in: allowedSections } } : {}
        },
        include: { section: true }
      },
      marks: { where: { examSubjectId: examSubject.id } }
    },
    orderBy: { fullName: "asc" }
  });
  res.json({
    exam: { id: exam.id, name: exam.name, status: exam.status },
    subject: { id: examSubject.id, name: examSubject.classSubject.subject.name, maxMarks: Number(examSubject.maxMarks), passMarks: Number(examSubject.passMarks) },
    students: students.map((student) => ({
      id: student.id,
      admissionNo: student.admissionNo,
      fullName: student.fullName,
      section: student.enrollments[0]?.section.name,
      score: student.marks[0]?.score === null || !student.marks[0] ? null : Number(student.marks[0].score)
    }))
  });
}));
examsRouter.put("/:examId/marks/:examSubjectId/:studentId", allowRoles(Role.ADMIN, Role.TEACHER), asyncRoute(async (req, res) => {
  const { score } = z.object({ score: z.number().min(0).max(1e4) }).parse(req.body);
  const exam = await prisma.examination.findUnique({
    where: { id: req.params.examId },
    include: { subjects: true }
  });
  if (!exam) throw new HttpError(404, "Examination not found");
  if (exam.status === ExamStatus.PUBLISHED) throw new HttpError(409, "Published examination marks cannot be changed");
  const examSubject = exam.subjects.find(({ id }) => id === req.params.examSubjectId);
  if (!examSubject) throw new HttpError(404, "Subject is not part of this examination");
  if (score > Number(examSubject.maxMarks)) throw new HttpError(400, "Marks cannot exceed the subject maximum");
  const student = await prisma.student.findFirst({
    where: {
      id: req.params.studentId,
      enrollments: {
        some: {
          active: true,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          ...exam.sectionId ? { sectionId: exam.sectionId } : {}
        }
      }
    }
  });
  if (!student) throw new HttpError(404, "Student is not enrolled in this examination");
  if (req.user?.role === Role.TEACHER) {
    await assertTeacherAssignment(req.user.profileId, examSubject.classSubjectId, exam.sectionId, student.id);
  }
  const mark = await prisma.$transaction(async (tx) => {
    const existing = await tx.mark.findUnique({
      where: { examSubjectId_studentId: { examSubjectId: examSubject.id, studentId: student.id } }
    });
    const saved = await tx.mark.upsert({
      where: { examSubjectId_studentId: { examSubjectId: examSubject.id, studentId: student.id } },
      create: {
        examSubjectId: examSubject.id,
        studentId: student.id,
        score,
        enteredById: req.user.id
      },
      update: { score, enteredById: req.user.id }
    });
    await tx.auditLog.create({
      data: {
        actorId: req.user.id,
        action: existing ? "MARK_UPDATED" : "MARK_ENTERED",
        entity: "Mark",
        entityId: saved.id,
        before: existing ? { score: existing.score?.toString() ?? null } : Prisma.JsonNull,
        after: { score: score.toString(), studentId: student.id, examSubjectId: examSubject.id }
      }
    });
    return saved;
  });
  res.json({ id: mark.id, score: Number(mark.score) });
}));
examsRouter.post("/:examId/publish", adminOnly, asyncRoute(async (req, res) => {
  const exam = await prisma.examination.findUnique({
    where: { id: req.params.examId },
    include: {
      subjects: { include: { classSubject: { include: { subject: true } } } }
    }
  });
  if (!exam) throw new HttpError(404, "Examination not found");
  if (exam.status === ExamStatus.PUBLISHED) throw new HttpError(409, "Examination is already published");
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      enrollments: {
        some: {
          active: true,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          ...exam.sectionId ? { sectionId: exam.sectionId } : {}
        }
      }
    },
    include: {
      marks: { where: { examSubject: { examinationId: exam.id } }, include: { examSubject: true } }
    }
  });
  if (!students.length) throw new HttpError(400, "Cannot publish an examination with no enrolled students");
  const expectedSubjects = exam.subjects.length;
  for (const student of students) {
    if (student.marks.length !== expectedSubjects || student.marks.some(({ score }) => score === null)) {
      throw new HttpError(409, `Marks are incomplete for ${student.fullName}`);
    }
  }
  const entries = students.map((student) => {
    const scores = student.marks.map((mark) => ({
      score: Number(mark.score),
      maxMarks: Number(mark.examSubject.maxMarks),
      passMarks: Number(mark.examSubject.passMarks)
    }));
    return { studentId: student.id, ...calculateResult(scores, Number(exam.distinctionPct)) };
  }).sort((a, b) => b.totalMarks - a.totalMarks || a.studentId.localeCompare(b.studentId));
  let rank = 0;
  let previousTotal = null;
  const ranked = entries.map((entry, index) => {
    if (previousTotal !== entry.totalMarks) rank = index + 1;
    previousTotal = entry.totalMarks;
    return { ...entry, rank };
  });
  await prisma.$transaction(async (tx) => {
    await tx.result.deleteMany({ where: { examinationId: exam.id } });
    await tx.result.createMany({
      data: ranked.map((result) => ({
        examinationId: exam.id,
        studentId: result.studentId,
        totalMarks: result.totalMarks,
        maximumMarks: result.maximumMarks,
        percentage: result.percentage,
        grade: result.grade,
        division: result.division,
        passed: result.passed,
        distinction: result.distinction,
        rank: result.rank
      }))
    });
    await tx.reportCard.createMany({
      data: ranked.map((result) => ({ examinationId: exam.id, studentId: result.studentId })),
      skipDuplicates: true
    });
    await tx.examination.update({ where: { id: exam.id }, data: { status: ExamStatus.PUBLISHED } });
  });
  res.json({ published: true, studentCount: ranked.length });
}));
examsRouter.get("/:examId/subject-results/:examSubjectId", allowRoles(Role.ADMIN, Role.TEACHER), asyncRoute(async (req, res) => {
  const exam = await prisma.examination.findUnique({
    where: { id: req.params.examId },
    include: { schoolClass: true, section: true, subjects: { include: { classSubject: { include: { subject: true } } } } }
  });
  if (!exam) throw new HttpError(404, "Examination not found");
  const examSubject = exam.subjects.find(({ id }) => id === req.params.examSubjectId);
  if (!examSubject) throw new HttpError(404, "Subject is not part of this examination");
  const allowedSections = req.user?.role === Role.TEACHER ? await assertTeacherAssignment(req.user.profileId, examSubject.classSubjectId, exam.sectionId) : void 0;
  const students = await prisma.student.findMany({
    where: {
      status: "ACTIVE",
      enrollments: {
        some: {
          active: true,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          ...exam.sectionId ? { sectionId: exam.sectionId } : {},
          ...allowedSections ? { sectionId: { in: allowedSections } } : {}
        }
      }
    },
    include: {
      enrollments: {
        where: {
          active: true,
          classId: exam.classId,
          ...allowedSections ? { sectionId: { in: allowedSections } } : {}
        },
        include: { section: true }
      },
      marks: { where: { examSubjectId: examSubject.id } }
    },
    orderBy: { fullName: "asc" }
  });
  const ordered = students.map((student) => ({
    student,
    score: student.marks[0]?.score === null || !student.marks[0] ? null : Number(student.marks[0].score)
  })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.student.fullName.localeCompare(b.student.fullName));
  let rank = 0;
  let previousScore = null;
  const results = ordered.map((entry, index) => {
    if (entry.score === null) return { ...entry, rank: null };
    if (entry.score !== previousScore) rank = index + 1;
    previousScore = entry.score;
    return { ...entry, rank };
  });
  res.json({
    exam: { id: exam.id, name: exam.name, type: exam.type, className: exam.schoolClass.name, section: exam.section?.name ?? null },
    subject: { id: examSubject.id, name: examSubject.classSubject.subject.name, maxMarks: Number(examSubject.maxMarks), passMarks: Number(examSubject.passMarks) },
    results: results.map(({ student, score, rank: subjectRank }) => ({
      student: {
        id: student.id,
        fullName: student.fullName,
        admissionNo: student.admissionNo,
        rollNumber: student.enrollments[0]?.rollNumber ?? "",
        section: student.enrollments[0]?.section.name ?? ""
      },
      score,
      passed: score !== null && score >= Number(examSubject.passMarks),
      rank: subjectRank
    }))
  });
}));
examsRouter.get("/:examId/results", asyncRoute(async (req, res) => {
  const exam = await prisma.examination.findUnique({
    where: { id: req.params.examId },
    include: {
      schoolClass: true,
      section: true,
      subjects: { include: { classSubject: { include: { subject: true } } } }
    }
  });
  if (!exam) throw new HttpError(404, "Examination not found");
  if (exam.status !== ExamStatus.PUBLISHED) throw new HttpError(409, "Results have not been published");
  const resultScope = { examinationId: exam.id };
  if (req.user?.role === Role.STUDENT) resultScope.studentId = req.user.profileId ?? "__missing_student_profile__";
  if (req.user?.role === Role.TEACHER) {
    throw new HttpError(403, "Contact an administrator for complete class results");
  }
  const results = await prisma.result.findMany({
    where: resultScope,
    include: {
      student: {
        select: {
          id: true,
          admissionNo: true,
          fullName: true,
          enrollments: {
            where: { active: true, classId: exam.classId },
            select: { rollNumber: true, section: { select: { name: true } } }
          }
        }
      }
    },
    orderBy: [{ rank: "asc" }, { student: { fullName: "asc" } }]
  });
  const markRows = await prisma.mark.findMany({
    where: {
      examSubject: { examinationId: exam.id },
      studentId: { in: results.map(({ studentId }) => studentId) }
    },
    include: { examSubject: { include: { classSubject: { include: { subject: true } } } } }
  });
  const marksByStudent = /* @__PURE__ */ new Map();
  for (const mark of markRows) marksByStudent.set(mark.studentId, [...marksByStudent.get(mark.studentId) ?? [], mark]);
  res.json({
    exam: { id: exam.id, name: exam.name, type: exam.type, className: exam.schoolClass.name, section: exam.section?.name ?? null, status: exam.status },
    subjects: exam.subjects.map(({ id, maxMarks, passMarks, classSubject }) => ({
      id,
      name: classSubject.subject.name,
      maxMarks: Number(maxMarks),
      passMarks: Number(passMarks)
    })),
    results: results.map((result) => ({
      ...result,
      totalMarks: Number(result.totalMarks),
      maximumMarks: Number(result.maximumMarks),
      percentage: Number(result.percentage),
      student: result.student,
      marks: (marksByStudent.get(result.studentId) ?? []).map((mark) => ({
        subject: mark.examSubject.classSubject.subject.name,
        score: Number(mark.score),
        maxMarks: Number(mark.examSubject.maxMarks),
        passMarks: Number(mark.examSubject.passMarks),
        passed: Number(mark.score) >= Number(mark.examSubject.passMarks)
      }))
    }))
  });
}));
export {
  examsRouter
};
