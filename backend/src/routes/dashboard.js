import { Router } from "express";
import { ExamStatus, Role } from "@prisma/client";
import { prisma } from "../db.js";
import { asyncRoute } from "../middleware/errors.js";
import { gradeFor } from "../utils/results.js";
const dashboardRouter = Router();
dashboardRouter.get("/", asyncRoute(async (req, res) => {
  const user = req.user;
  if (user.role === Role.STUDENT && user.profileId) {
    const [student, exams2] = await prisma.$transaction([
      prisma.student.findUnique({
        where: { id: user.profileId },
        include: {
          enrollments: {
            where: { active: true },
            include: { schoolClass: true, section: true, academicYear: true }
          },
          results: {
            include: { examination: { select: { id: true, name: true, type: true } } },
            orderBy: { createdAt: "desc" }
          }
        }
      }),
      prisma.examination.findMany({
        where: {
          status: { in: [ExamStatus.DRAFT, ExamStatus.MARKS_ENTRY, ExamStatus.PUBLISHED] },
          schoolClass: { enrollments: { some: { studentId: user.profileId, active: true } } }
        },
        include: { subjects: { include: { classSubject: { include: { subject: true } } } }, schoolClass: true },
        orderBy: { startsOn: "asc" }
      })
    ]);
    res.json({
      role: "STUDENT",
      profile: student,
      exams: exams2.map((exam) => ({
        id: exam.id,
        name: exam.name,
        type: exam.type,
        status: exam.status,
        className: exam.schoolClass.name,
        subjects: exam.subjects.map(({ examDate, classSubject }) => ({ name: classSubject.subject.name, examDate }))
      }))
    });
    return;
  }
  if (user.role === Role.TEACHER && user.profileId) {
    const [classes, exams2, assignments] = await prisma.$transaction([
      prisma.schoolClass.findMany({
        where: {
          OR: [
            { classTeacherId: user.profileId },
            { subjects: { some: { assignments: { some: { teacherId: user.profileId } } } } }
          ]
        },
        include: { academicYear: true, sections: true },
        orderBy: { grade: "asc" }
      }),
      prisma.examination.findMany({
        where: {
          subjects: { some: { classSubject: { assignments: { some: { teacherId: user.profileId } } } } }
        },
        include: { schoolClass: true, section: true },
        orderBy: { startsOn: "desc" },
        take: 8
      }),
      prisma.teacherAssignment.findMany({
        where: { teacherId: user.profileId },
        select: { sectionId: true, classSubject: { select: { classId: true } } }
      })
    ]);
    const homeroomIds = classes.filter((schoolClass) => schoolClass.classTeacherId === user.profileId).map(({ id }) => id);
    const scopes = assignments.map(({ sectionId, classSubject }) => ({
      classId: classSubject.classId,
      ...sectionId ? { sectionId } : {}
    }));
    const visibleEnrollments = await prisma.enrollment.findMany({
      where: {
        active: true,
        OR: [
          ...homeroomIds.length ? [{ classId: { in: homeroomIds } }] : [],
          ...scopes
        ]
      },
      select: { classId: true, sectionId: true }
    });
    res.json({
      role: "TEACHER",
      stats: {
        assignedClasses: classes.length,
        students: visibleEnrollments.length,
        pendingExaminations: exams2.filter((exam) => exam.status !== ExamStatus.PUBLISHED).length
      },
      classes: classes.map((schoolClass) => ({
        id: schoolClass.id,
        name: schoolClass.name,
        academicYear: schoolClass.academicYear.name,
        studentCount: visibleEnrollments.filter(({ classId }) => classId === schoolClass.id).length,
        sections: schoolClass.sections.filter(
          (section) => homeroomIds.includes(schoolClass.id) || scopes.some(
            (scope) => scope.classId === schoolClass.id && (!scope.sectionId || scope.sectionId === section.id)
          )
        )
      })),
      exams: exams2
    });
    return;
  }
  const [totalStudents, allExams] = await prisma.$transaction([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.examination.findMany({
      where: { status: ExamStatus.PUBLISHED },
      include: { academicYear: true, schoolClass: true, section: true, subjects: { include: { classSubject: { include: { subject: true } } } } },
      orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }]
    })
  ]);
  const requestedExamId = typeof req.query.examId === "string" ? req.query.examId : void 0;
  const requestedYearId = typeof req.query.academicYearId === "string" ? req.query.academicYearId : void 0;
  const requestedClassId = typeof req.query.classId === "string" ? req.query.classId : void 0;
  const exams = allExams.filter(
    (exam) => (!requestedYearId || exam.academicYearId === requestedYearId) && (!requestedClassId || exam.classId === requestedClassId)
  );
  let selectedExam = requestedExamId ? exams.find(({ id }) => id === requestedExamId) : exams[0];
  if (!selectedExam && !requestedExamId) selectedExam = exams[0];
  const results = selectedExam ? await prisma.result.findMany({
    where: { examinationId: selectedExam.id },
    include: {
      student: {
        select: {
          id: true,
          fullName: true,
          admissionNo: true,
          enrollments: { where: { active: true, classId: selectedExam.classId }, select: { rollNumber: true, section: { select: { name: true } } } }
        }
      }
    },
    orderBy: [{ rank: "asc" }, { student: { fullName: "asc" } }]
  }) : [];
  const subjectMarks = selectedExam ? await prisma.mark.findMany({
    where: { examSubject: { examinationId: selectedExam.id }, score: { not: null } },
    include: {
      student: {
        select: {
          fullName: true,
          admissionNo: true,
          enrollments: {
            where: { active: true, classId: selectedExam.classId },
            select: { section: { select: { name: true } } }
          }
        }
      },
      examSubject: { include: { classSubject: { include: { subject: true } } } }
    }
  }) : [];
  const sectionFilter = typeof req.query.section === "string" ? req.query.section.toLowerCase() : void 0;
  const sectionStudentIds = sectionFilter && selectedExam ? new Set((await prisma.enrollment.findMany({
    where: {
      active: true,
      classId: selectedExam.classId,
      section: { name: { equals: sectionFilter, mode: "insensitive" } }
    },
    select: { studentId: true }
  })).map(({ studentId }) => studentId)) : null;
  const visibleResults = sectionFilter ? results.filter((result) => result.student.enrollments[0]?.section.name.toLowerCase() === sectionFilter) : results;
  const requestedSubject = typeof req.query.subject === "string" ? req.query.subject : void 0;
  let analyticsRows = visibleResults.map((result) => ({
    rank: result.rank,
    student: result.student,
    percentage: Number(result.percentage),
    grade: result.grade,
    passed: result.passed,
    distinction: result.distinction
  }));
  if (requestedSubject && selectedExam) {
    const examSubject = selectedExam.subjects.find(({ classSubject }) => classSubject.subjectId === requestedSubject);
    if (examSubject) {
      const subjectEntries = subjectMarks.filter(
        (mark) => mark.examSubject.classSubject.subjectId === requestedSubject && (!sectionFilter || mark.student.enrollments[0]?.section.name.toLowerCase() === sectionFilter)
      ).map((mark) => ({
        student: mark.student,
        score: Number(mark.score),
        maxMarks: Number(mark.examSubject.maxMarks),
        passMarks: Number(mark.examSubject.passMarks)
      })).sort((a, b) => b.score - a.score || a.student.fullName.localeCompare(b.student.fullName));
      let subjectRank = 0;
      let previousScore = -1;
      analyticsRows = subjectEntries.map((entry, index) => {
        if (entry.score !== previousScore) subjectRank = index + 1;
        previousScore = entry.score;
        const percentage = entry.maxMarks === 0 ? 0 : Number((entry.score / entry.maxMarks * 100).toFixed(2));
        const passed2 = entry.score >= entry.passMarks;
        return {
          rank: subjectRank,
          student: entry.student,
          percentage,
          grade: gradeFor(percentage),
          passed: passed2,
          distinction: passed2 && percentage >= Number(selectedExam.distinctionPct)
        };
      });
    }
  }
  const passed = analyticsRows.filter(({ passed: passed2 }) => passed2).length;
  const failed = analyticsRows.length - passed;
  const subjectGroups = /* @__PURE__ */ new Map();
  for (const mark of subjectMarks) {
    const subjectId = mark.examSubject.classSubject.subjectId;
    if (requestedSubject && requestedSubject !== subjectId) continue;
    if (sectionStudentIds && !sectionStudentIds.has(mark.studentId)) continue;
    const subjectName = mark.examSubject.classSubject.subject.name;
    const score = Number(mark.score);
    const group = subjectGroups.get(subjectName) ?? { total: 0, max: 0, count: 0, topper: null };
    group.total += score;
    group.max += Number(mark.examSubject.maxMarks);
    group.count += 1;
    if (!group.topper || score > group.topper.score) {
      group.topper = { name: mark.student.fullName, admissionNo: mark.student.admissionNo, score };
    }
    subjectGroups.set(subjectName, group);
  }
  const subjectPerformance = [...subjectGroups.entries()].map(([subject, group]) => ({
    subject,
    average: group.max === 0 ? 0 : Number((group.total / group.max * 100).toFixed(1)),
    passCount: group.count,
    topper: group.topper
  }));
  const gradeCounts = analyticsRows.reduce((counts, result) => {
    counts[result.grade] = (counts[result.grade] ?? 0) + 1;
    return counts;
  }, {});
  const percentages = analyticsRows.map(({ percentage }) => percentage);
  const avgPercentage = percentages.length ? Number((percentages.reduce((sum, percentage) => sum + percentage, 0) / percentages.length).toFixed(1)) : 0;
  const selectedClass = selectedExam ? await prisma.schoolClass.findUnique({
    where: { id: selectedExam.classId },
    include: { sections: { include: { _count: { select: { enrollments: { where: { active: true } } } } } } }
  }) : null;
  res.json({
    role: "ADMIN",
    filters: {
      selectedExamId: selectedExam?.id ?? null,
      academicYears: [...new Map(exams.map((exam) => [exam.academicYearId, exam.academicYear])).values()],
      allAcademicYears: [...new Map(allExams.map((exam) => [exam.academicYearId, exam.academicYear])).values()],
      classes: [...new Map(allExams.map((exam) => [exam.classId, { id: exam.classId, name: exam.schoolClass.name, academicYearId: exam.academicYearId }])).values()],
      sections: selectedClass?.sections.map(({ id, name }) => ({ id, name })) ?? [],
      examinations: exams.map(({ id, name, type, academicYear, schoolClass, section }) => ({
        id,
        name,
        type,
        academicYear: academicYear.name,
        className: schoolClass.name,
        section: section?.name ?? null
      })),
      subjects: selectedExam?.subjects.map(({ classSubject }) => ({
        id: classSubject.subjectId,
        name: classSubject.subject.name
      })) ?? []
    },
    stats: {
      totalStudents,
      appeared: analyticsRows.length,
      passed,
      failed,
      distinction: analyticsRows.filter(({ distinction }) => distinction).length,
      passPercentage: analyticsRows.length ? Number((passed / analyticsRows.length * 100).toFixed(1)) : 0,
      averagePercentage: avgPercentage
    },
    classPerformance: selectedClass ? [{
      className: selectedClass.name,
      sections: selectedClass.sections.map((section) => {
        const sectionResults = analyticsRows.filter((result) => result.student.enrollments[0]?.section.name === section.name);
        const sectionPercentages = sectionResults.map(({ percentage }) => percentage);
        return {
          name: section.name,
          students: section._count.enrollments,
          appeared: sectionResults.length,
          passed: sectionResults.filter(({ passed: passed2 }) => passed2).length,
          averagePercentage: sectionPercentages.length ? Number((sectionPercentages.reduce((sum, item) => sum + item, 0) / sectionPercentages.length).toFixed(1)) : 0,
          highestPercentage: sectionPercentages.length ? Math.max(...sectionPercentages) : 0,
          lowestPercentage: sectionPercentages.length ? Math.min(...sectionPercentages) : 0
        };
      })
    }] : [],
    gradeCounts,
    subjectPerformance,
    toppers: analyticsRows.sort((a, b) => a.rank - b.rank).slice(0, 10).map((result) => ({
      rank: result.rank,
      student: result.student.fullName,
      admissionNo: result.student.admissionNo,
      section: result.student.enrollments[0]?.section.name ?? "",
      percentage: Number(result.percentage),
      grade: result.grade,
      passed: result.passed
    }))
  });
}));
export {
  dashboardRouter
};
