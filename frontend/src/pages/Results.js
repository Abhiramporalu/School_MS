import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { api, csvDownload } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function ResultsPage({ isTeacher = false }) {
  return isTeacher ? /* @__PURE__ */ jsx(TeacherSubjectReports, {}) : /* @__PURE__ */ jsx(PublishedResultsPage, {});
}
function TeacherSubjectReports() {
  // const[exams, setExams] = useState([]);
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/exams").then((items) => {
      setExams(items);
      setExamId(items[0]?.id ?? "");
      setSubjectId(items[0]?.subjects?.[0]?.id ?? "");
      setLoading(false);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not load examinations");
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (!examId || !subjectId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError("");
    api(`/exams/${examId}/subject-results/${subjectId}`).then(setReport).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load the subject report")).finally(() => setLoading(false));
  }, [examId, subjectId]);
  function exportSubject() {
    if (!report) return;
    csvDownload(`${report.exam.name}-${report.subject.name}-report.csv`, [
      ["Rank", "Admission number", "Student", "Section", "Roll number", `Marks / ${report.subject.maxMarks}`, "Result"],
      ...report.results.map((result) => [
        result.rank ?? "",
        result.student.admissionNo,
        result.student.fullName,
        result.student.section,
        result.student.rollNumber,
        result.score ?? "",
        result.passed ? "Pass" : "Fail"
      ])
    ]);
  }
  const currentExam = exams.find((exam) => exam.id === examId);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "SUBJECT REPORTING", title: "Class results", description: "Review and export marks for your assigned subjects.", actions: report && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("button", { className: "button button-quiet", onClick: exportSubject, children: [
        /* @__PURE__ */ jsx(Download, { size: 16 }),
        " Export CSV"
      ] }),
      /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => window.print(), children: [
        /* @__PURE__ */ jsx(Printer, { size: 16 }),
        " Print report"
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    /* @__PURE__ */ jsxs("section", { className: "panel results-toolbar", children: [
      /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Examination" }),
        /* @__PURE__ */ jsxs("select", { value: examId, onChange: (event) => {
          const next = exams.find((item) => item.id === event.target.value);
          setExamId(event.target.value);
          setSubjectId(next?.subjects?.[0]?.id ?? "");
        }, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Select an examination" }),
          exams.map((exam) => /* @__PURE__ */ jsxs("option", { value: exam.id, children: [
            exam.name,
            " \xB7 ",
            exam.schoolClass?.name
          ] }, exam.id))
        ] })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Assigned subject" }),
        /* @__PURE__ */ jsxs("select", { value: subjectId, onChange: (event) => setSubjectId(event.target.value), disabled: !currentExam, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Select a subject" }),
          currentExam?.subjects?.map((subject) => /* @__PURE__ */ jsx("option", { value: subject.id, children: subject.classSubject.subject.name }, subject.id))
        ] })
      ] }),
      report && /* @__PURE__ */ jsxs("div", { className: "result-summary", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: report.results.length }),
          " students"
        ] }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: report.subject.name }),
          " \xB7 ",
          report.exam.className,
          report.exam.section ? ` / ${report.exam.section}` : ""
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : !report?.results.length ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No student marks", message: "Marks for this subject will appear here as they are entered." }) }) : /* @__PURE__ */ jsxs("section", { className: "panel", children: [
      /* @__PURE__ */ jsx("div", { className: "report-table-title", children: /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("h2", { children: [
          report.exam.name,
          " \xB7 ",
          report.subject.name
        ] }),
        /* @__PURE__ */ jsxs("p", { children: [
          report.exam.className,
          report.exam.section ? ` \xB7 Section ${report.exam.section}` : " \xB7 All assigned sections",
          " \xB7 Maximum ",
          report.subject.maxMarks
        ] })
      ] }) }),
      /* @__PURE__ */ jsx("div", { className: "table-scroll", children: /* @__PURE__ */ jsxs("table", { children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "RANK" }),
          /* @__PURE__ */ jsx("th", { children: "STUDENT" }),
          /* @__PURE__ */ jsx("th", { children: "ADMISSION NO." }),
          /* @__PURE__ */ jsx("th", { children: "SECTION" }),
          /* @__PURE__ */ jsx("th", { children: "ROLL NO." }),
          /* @__PURE__ */ jsx("th", { children: "MARKS" }),
          /* @__PURE__ */ jsx("th", { children: "RESULT" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: report.results.map((item) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: item.rank ? /* @__PURE__ */ jsxs("span", { className: `rank-badge rank-${Math.min(item.rank, 3)}`, children: [
            "#",
            item.rank
          ] }) : "\u2014" }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("strong", { children: item.student.fullName }) }),
          /* @__PURE__ */ jsx("td", { className: "mono", children: item.student.admissionNo }),
          /* @__PURE__ */ jsx("td", { children: item.student.section }),
          /* @__PURE__ */ jsx("td", { children: item.student.rollNumber }),
          /* @__PURE__ */ jsxs("td", { children: [
            /* @__PURE__ */ jsx("strong", { children: item.score ?? "Not entered" }),
            " ",
            /* @__PURE__ */ jsxs("span", { className: "cell-subtle", children: [
              "/ ",
              report.subject.maxMarks
            ] })
          ] }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `status-pill ${item.score === null ? "status-grey" : item.passed ? "status-green" : "status-red"}`, children: item.score === null ? "pending" : item.passed ? "pass" : "fail" }) })
        ] }, item.student.id)) })
      ] }) })
    ] })
  ] });
}
function PublishedResultsPage() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [report, setReport] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/exams").then((items) => {
      const published = items.filter((exam) => exam.status === "PUBLISHED");
      setExams(published);
      setExamId(published[0]?.id ?? "");
      setLoading(false);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not load examinations");
      setLoading(false);
    });
  }, []);
  useEffect(() => {
    api("/school/profile").then(setSchool).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load school profile"));
  }, []);
  useEffect(() => {
    if (!examId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setError("");
    api(`/exams/${examId}/results`).then(setReport).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load results")).finally(() => setLoading(false));
  }, [examId]);
  function exportResults() {
    if (!report) return;
    const rows = [
      ["Rank", "Admission number", "Student", "Section", ...report.subjects.map((subject) => `${subject.name} / ${subject.maxMarks}`), "Total", "Maximum", "Percentage", "Grade", "Division", "Result"]
    ];
    for (const result of report.results) rows.push([
      result.rank,
      result.student.admissionNo,
      result.student.fullName,
      result.student.enrollments[0]?.section.name ?? "",
      ...report.subjects.map((subject) => result.marks.find((mark) => mark.subject === subject.name)?.score ?? ""),
      result.totalMarks,
      result.maximumMarks,
      result.percentage,
      result.grade,
      result.division,
      result.passed ? "Pass" : "Fail"
    ]);
    csvDownload(`${report.exam.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-results.csv`, rows);
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "REPORTING", title: "Results & report cards", description: "Review published results, export class summaries, or print report cards.", actions: report && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("button", { className: "button button-quiet", onClick: exportResults, children: [
        /* @__PURE__ */ jsx(Download, { size: 16 }),
        " Export CSV"
      ] }),
      /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => window.print(), children: [
        /* @__PURE__ */ jsx(Printer, { size: 16 }),
        " Print / Save PDF"
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    /* @__PURE__ */ jsxs("section", { className: "panel results-toolbar", children: [
      /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Published examination" }),
        /* @__PURE__ */ jsxs("select", { value: examId, onChange: (event) => setExamId(event.target.value), children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Select an examination" }),
          exams.map((exam) => /* @__PURE__ */ jsxs("option", { value: exam.id, children: [
            exam.name,
            " \xB7 ",
            exam.schoolClass?.name
          ] }, exam.id))
        ] })
      ] }),
      report && /* @__PURE__ */ jsxs("div", { className: "result-summary", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: report.results.length }),
          " students"
        ] }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: report.exam.className }),
          report.exam.section ? ` \xB7 Section ${report.exam.section}` : " \xB7 All sections"
        ] })
      ] })
    ] }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : !report?.results.length ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: exams.length ? "No result rows" : "No published results yet", message: exams.length ? "This examination does not have any published results." : "Results will be available after an administrator publishes examination marks." }) }) : /* @__PURE__ */ jsx("div", { className: "report-card-list", children: report.results.map((result) => /* @__PURE__ */ jsxs("article", { className: "report-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "report-school-header", children: [
        school?.logoUrl ? /* @__PURE__ */ jsx("img", { className: "report-logo-img", src: school.logoUrl, alt: "" }) : /* @__PURE__ */ jsx("div", { className: "report-logo", children: (school?.name ?? "School")[0] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: school?.name ?? "School Management System" }),
          /* @__PURE__ */ jsx("span", { children: school?.address || "Academic performance report" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "report-copy", children: [
          "STUDENT REPORT",
          /* @__PURE__ */ jsx("br", {}),
          /* @__PURE__ */ jsx("strong", { children: report.exam.name })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "report-student-details", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "STUDENT NAME" }),
          /* @__PURE__ */ jsx("strong", { children: result.student.fullName })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "ADMISSION NO." }),
          /* @__PURE__ */ jsx("strong", { children: result.student.admissionNo })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "CLASS / SECTION" }),
          /* @__PURE__ */ jsxs("strong", { children: [
            report.exam.className,
            " \xB7 ",
            result.student.enrollments[0]?.section.name ?? "\u2014"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "ROLL NO." }),
          /* @__PURE__ */ jsx("strong", { children: result.student.enrollments[0]?.rollNumber ?? "\u2014" })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "EXAMINATION" }),
          /* @__PURE__ */ jsx("strong", { children: report.exam.name })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "RANK" }),
          /* @__PURE__ */ jsxs("strong", { children: [
            "#",
            result.rank
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "table-scroll report-table", children: /* @__PURE__ */ jsxs("table", { children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "SUBJECT" }),
          /* @__PURE__ */ jsx("th", { children: "MAX MARKS" }),
          /* @__PURE__ */ jsx("th", { children: "MARKS OBTAINED" }),
          /* @__PURE__ */ jsx("th", { children: "RESULT" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: report.subjects.map((subject) => {
          const mark = result.marks.find((item) => item.subject === subject.name);
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: subject.name }),
            /* @__PURE__ */ jsx("td", { children: subject.maxMarks }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("strong", { children: mark?.score ?? "\u2014" }) }),
            /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `status-pill ${mark?.passed ? "status-green" : "status-red"}`, children: mark?.passed ? "Pass" : "Fail" }) })
          ] }, subject.id);
        }) })
      ] }) }),
      /* @__PURE__ */ jsxs("div", { className: "report-totals", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "TOTAL MARKS" }),
          /* @__PURE__ */ jsxs("strong", { children: [
            result.totalMarks,
            " ",
            /* @__PURE__ */ jsxs("small", { children: [
              "/ ",
              result.maximumMarks
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "PERCENTAGE" }),
          /* @__PURE__ */ jsxs("strong", { children: [
            Number(result.percentage).toFixed(2),
            "%"
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "GRADE" }),
          /* @__PURE__ */ jsx("strong", { className: "grade-large", children: result.grade })
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "OVERALL RESULT" }),
          /* @__PURE__ */ jsx("strong", { className: result.passed ? "text-green" : "text-red", children: result.passed ? "PASS" : "FAIL" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "report-remarks", children: [
        /* @__PURE__ */ jsx("span", { children: "CLASS TEACHER REMARKS" }),
        /* @__PURE__ */ jsx("p", { children: "No remarks entered." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "signature-row", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "Class teacher" }),
          /* @__PURE__ */ jsx("i", {})
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: school?.principalName || "Principal" }),
          /* @__PURE__ */ jsx("i", {})
        ] }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("span", { children: "Parent / guardian" }),
          /* @__PURE__ */ jsx("i", {})
        ] })
      ] })
    ] }, result.id)) })
  ] });
}
export {
  ResultsPage as default
};
