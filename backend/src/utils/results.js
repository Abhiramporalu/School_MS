function gradeFor(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  return "F";
}
function divisionFor(percentage) {
  if (percentage >= 60) return "First";
  if (percentage >= 45) return "Second";
  if (percentage >= 33) return "Third";
  return "Needs improvement";
}
function calculateResult(subjects, distinctionPct = 75) {
  const totalMarks = subjects.reduce((sum, subject) => sum + subject.score, 0);
  const maximumMarks = subjects.reduce((sum, subject) => sum + subject.maxMarks, 0);
  const percentage = maximumMarks === 0 ? 0 : totalMarks / maximumMarks * 100;
  const passed = subjects.length > 0 && subjects.every((subject) => subject.score >= subject.passMarks);
  return {
    totalMarks: Number(totalMarks.toFixed(2)),
    maximumMarks: Number(maximumMarks.toFixed(2)),
    percentage: Number(percentage.toFixed(2)),
    grade: gradeFor(percentage),
    division: divisionFor(percentage),
    passed,
    distinction: passed && percentage >= distinctionPct
  };
}
export {
  calculateResult,
  divisionFor,
  gradeFor
};
