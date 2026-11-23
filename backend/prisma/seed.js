import "dotenv/config";
import bcrypt from "bcryptjs";
import { ExamStatus, Role } from "@prisma/client";
import { prisma } from "../src/db.js";
import { calculateResult } from "../src/utils/results.js";
async function passwordHash(name) {
  const password = process.env[name];
  if (!password || password.length < 12) throw new Error(`${name} must be set to at least 12 characters`);
  return bcrypt.hash(password, 12);
}
async function main() {
  const year = await prisma.academicYear.upsert({
    where: { name: "2026-2027" },
    update: { isCurrent: true },
    create: { name: "2026-2027", startsOn: /* @__PURE__ */ new Date("2026-07-01"), endsOn: /* @__PURE__ */ new Date("2027-06-30"), isCurrent: true }
  });
  await prisma.academicYear.updateMany({ where: { id: { not: year.id }, isCurrent: true }, data: { isCurrent: false } });
  await prisma.schoolProfile.upsert({
    where: { id: "school-profile" },
    update: {},
    create: { id: "school-profile", name: "Greenfield Public School", address: "School address", principalName: "School Principal" }
  });
  const accounts = [
    { email: "admin@school.local", role: Role.ADMIN, env: "SEED_ADMIN_PASSWORD" },
    { email: "teacher@school.local", role: Role.TEACHER, env: "SEED_TEACHER_PASSWORD" },
    { email: "student@school.local", role: Role.STUDENT, env: "SEED_STUDENT_PASSWORD" }
  ];
  const users = /* @__PURE__ */ new Map();
  for (const account of accounts) {
    let user = await prisma.user.findUnique({ where: { email: account.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: account.email, passwordHash: await passwordHash(account.env), role: account.role }
      });
    }
    users.set(account.role, user.id);
  }
  const teacherUserId = users.get(Role.TEACHER);
  const teacher = await prisma.teacher.upsert({
    where: { employeeNo: "T-1001" },
    update: {},
    create: { userId: teacherUserId, employeeNo: "T-1001", fullName: "Jordan Lee", phone: "+1 555 010 1001" }
  });
  const schoolClass = await prisma.schoolClass.upsert({
    where: { grade_academicYearId: { grade: 8, academicYearId: year.id } },
    update: { name: "Class 8", classTeacherId: teacher.id },
    create: { name: "Class 8", grade: 8, academicYearId: year.id, classTeacherId: teacher.id }
  });
  const section = await prisma.section.upsert({
    where: { name_classId: { name: "A", classId: schoolClass.id } },
    update: {},
    create: { name: "A", classId: schoolClass.id }
  });
  const subjectNames = [
    ["MATH", "Mathematics"],
    ["SCI", "Science"],
    ["ENG", "English"],
    ["SOC", "Social Studies"],
    ["HIN", "Hindi"],
    ["COMP", "Computer Science"]
  ];
  const classSubjects = [];
  for (const [code, name] of subjectNames) {
    const subject = await prisma.subject.upsert({
      where: { code },
      update: { name },
      create: { code, name }
    });
    const classSubject = await prisma.classSubject.upsert({
      where: { classId_subjectId: { classId: schoolClass.id, subjectId: subject.id } },
      update: { maxMarks: 100, passMarks: 35 },
      create: { classId: schoolClass.id, subjectId: subject.id, maxMarks: 100, passMarks: 35 }
    });
    classSubjects.push({ classSubject, subject });
    const existing = await prisma.teacherAssignment.findFirst({
      where: { teacherId: teacher.id, classSubjectId: classSubject.id, sectionId: section.id }
    });
    if (!existing) await prisma.teacherAssignment.create({
      data: { teacherId: teacher.id, classSubjectId: classSubject.id, sectionId: section.id }
    });
  }
  const studentNames = ["Avery Morgan", "Riley Chen", "Samira Patel", "Noah Wilson", "Mia Johnson", "Arjun Shah", "Lena Garcia", "Ethan Brooks", "Zara Ahmed", "Kai Thompson"];
  const students = [];
  for (const [index, fullName] of studentNames.entries()) {
    const admissionNo = `GF-26-${String(index + 1).padStart(3, "0")}`;
    let student = await prisma.student.findUnique({ where: { admissionNo } });
    if (!student) {
      student = await prisma.student.create({
        data: {
          admissionNo,
          fullName,
          email: index === 0 ? "student@school.local" : null,
          parent: {
            create: {
              fullName: `${fullName.split(" ")[1]} Family`,
              phone: `+1 555 010 ${String(2e3 + index).slice(-4)}`
            }
          }
        }
      });
    }
    const enrollment = await prisma.enrollment.findUnique({
      where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } }
    });
    if (!enrollment) await prisma.enrollment.create({
      data: { studentId: student.id, classId: schoolClass.id, sectionId: section.id, academicYearId: year.id, rollNumber: String(index + 1).padStart(2, "0") }
    });
    students.push(student);
  }
  const studentUserId = users.get(Role.STUDENT);
  const firstStudent = students[0];
  await prisma.student.update({ where: { id: firstStudent.id }, data: { userId: studentUserId, email: "student@school.local" } });
  let exam = await prisma.examination.findFirst({
    where: { name: "Term 1 Assessment", classId: schoolClass.id, academicYearId: year.id }
  });
  if (!exam) {
    exam = await prisma.examination.create({
      data: {
        name: "Term 1 Assessment",
        type: "Mid-Term",
        academicYearId: year.id,
        classId: schoolClass.id,
        status: ExamStatus.MARKS_ENTRY,
        startsOn: /* @__PURE__ */ new Date("2026-10-12"),
        endsOn: /* @__PURE__ */ new Date("2026-10-20"),
        distinctionPct: 75,
        subjects: {
          create: classSubjects.map(({ classSubject }, index) => ({
            classSubjectId: classSubject.id,
            maxMarks: 100,
            passMarks: 35,
            examDate: /* @__PURE__ */ new Date(`2026-10-${String(12 + index).padStart(2, "0")}`)
          }))
        }
      }
    });
  }
  const examSubjects = await prisma.examSubject.findMany({ where: { examinationId: exam.id } });
  for (const [studentIndex, student] of students.entries()) {
    for (const [subjectIndex, examSubject] of examSubjects.entries()) {
      const score = studentIndex === students.length - 1 && subjectIndex === 0 ? 28 : 48 + (studentIndex * 11 + subjectIndex * 7) % 49;
      await prisma.mark.upsert({
        where: { examSubjectId_studentId: { examSubjectId: examSubject.id, studentId: student.id } },
        update: {},
        create: { examSubjectId: examSubject.id, studentId: student.id, score, enteredById: users.get(Role.ADMIN) }
      });
    }
  }
  const results = [];
  for (const student of students) {
    const marks = await prisma.mark.findMany({
      where: { studentId: student.id, examSubject: { examinationId: exam.id } },
      include: { examSubject: true }
    });
    const calculated = calculateResult(marks.map((mark) => ({
      score: Number(mark.score ?? 0),
      maxMarks: Number(mark.examSubject.maxMarks),
      passMarks: Number(mark.examSubject.passMarks)
    })), Number(exam.distinctionPct));
    results.push({ studentId: student.id, ...calculated });
  }
  results.sort((a, b) => b.totalMarks - a.totalMarks || a.studentId.localeCompare(b.studentId));
  let rank = 0;
  let lastScore = -1;
  for (const [index, result] of results.entries()) {
    if (result.totalMarks !== lastScore) rank = index + 1;
    lastScore = result.totalMarks;
    await prisma.result.upsert({
      where: { examinationId_studentId: { examinationId: exam.id, studentId: result.studentId } },
      update: { ...result, rank },
      create: { examinationId: exam.id, ...result, rank }
    });
    await prisma.reportCard.upsert({
      where: { examinationId_studentId: { examinationId: exam.id, studentId: result.studentId } },
      update: {},
      create: { examinationId: exam.id, studentId: result.studentId }
    });
  }
  await prisma.examination.update({ where: { id: exam.id }, data: { status: ExamStatus.PUBLISHED } });
  console.log("Seed complete. Demo logins: admin@school.local, teacher@school.local, student@school.local");
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
