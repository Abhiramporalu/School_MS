import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Award, BookOpenCheck, GraduationCap, Users } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
const chartColors = ["#5d6be8", "#f0a44b", "#50b894", "#e87575", "#94a3b8"];
function StatCard({ label, value, note, icon: Icon, tone, trend }) {
  return /* @__PURE__ */ jsxs("article", { className: "stat-card", children: [
    /* @__PURE__ */ jsx("div", { className: `stat-icon ${tone}`, children: /* @__PURE__ */ jsx(Icon, { size: 19 }) }),
    /* @__PURE__ */ jsx("div", { className: "stat-label", children: label }),
    /* @__PURE__ */ jsx("div", { className: "stat-value", children: value }),
    /* @__PURE__ */ jsxs("div", { className: "stat-note", children: [
      trend && (trend === "up" ? /* @__PURE__ */ jsx(ArrowUpRight, { size: 14 }) : /* @__PURE__ */ jsx(ArrowDownRight, { size: 14 })),
      note
    ] })
  ] });
}
function DashboardPage({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [section, setSection] = useState("");
  const [yearId, setYearId] = useState("");
  const [classId, setClassId] = useState("");
  async function load(nextExamId = examId, nextSubjectId = subjectId, nextSection = section, nextYearId = yearId, nextClassId = classId) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextExamId) params.set("examId", nextExamId);
      if (nextSubjectId) params.set("subject", nextSubjectId);
      if (nextSection) params.set("section", nextSection);
      if (nextYearId) params.set("academicYearId", nextYearId);
      if (nextClassId) params.set("classId", nextClassId);
      const response = await api(`/dashboard${params.size ? `?${params}` : ""}`);
      setData(response);
      if (response.role === "ADMIN") setExamId((current) => current || response.filters.selectedExamId || "");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load dashboard");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  if (loading && !data) return /* @__PURE__ */ jsx(LoadingState, {});
  if (error && !data) return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "SCHOOL AT A GLANCE", title: `Welcome, ${user.fullName.split(" ")[0]}` }),
    /* @__PURE__ */ jsx(ErrorBanner, { message: error })
  ] });
  if (data?.role === "STUDENT") {
    const results = data.profile?.results ?? [];
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(PageHeading, { eyebrow: "STUDENT PORTAL", title: `Good day, ${user.fullName.split(" ")[0]}`, description: "Your academic journey, all in one place." }),
      error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
      /* @__PURE__ */ jsxs("div", { className: "stats-grid stats-grid-three", children: [
        /* @__PURE__ */ jsx(StatCard, { label: "Published results", value: results.length, note: "Examinations completed", icon: BookOpenCheck, tone: "tone-violet" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Average score", value: `${results.length ? (results.reduce((sum, item) => sum + Number(item.percentage), 0) / results.length).toFixed(1) : "\u2014"}%`, note: "Across published exams", icon: GraduationCap, tone: "tone-blue" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Upcoming exams", value: data.exams.filter((exam) => exam.status !== "PUBLISHED").length, note: "Scheduled for your class", icon: Award, tone: "tone-orange" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "content-grid dashboard-lower", children: [
        /* @__PURE__ */ jsxs("section", { className: "panel", children: [
          /* @__PURE__ */ jsx("div", { className: "panel-heading", children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { children: "Recent results" }),
            /* @__PURE__ */ jsx("p", { children: "Your published examination history" })
          ] }) }),
          results.length ? /* @__PURE__ */ jsx("div", { className: "result-history", children: results.slice(0, 6).map((result) => /* @__PURE__ */ jsxs("div", { className: "history-row", children: [
            /* @__PURE__ */ jsx("div", { className: "history-medal", children: /* @__PURE__ */ jsx(Award, { size: 17 }) }),
            /* @__PURE__ */ jsxs("div", { className: "history-main", children: [
              /* @__PURE__ */ jsx("strong", { children: result.examination.name }),
              /* @__PURE__ */ jsxs("span", { children: [
                result.examination.type,
                " \xB7 Rank #",
                result.rank
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "history-score", children: [
              /* @__PURE__ */ jsxs("strong", { children: [
                Number(result.percentage).toFixed(1),
                "%"
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                result.grade,
                " \xB7 ",
                result.passed ? "Passed" : "Needs support"
              ] })
            ] })
          ] }, result.id)) }) : /* @__PURE__ */ jsx(EmptyState, { title: "Results will appear here", message: "Published exam results will be added to your history." })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "panel", children: [
          /* @__PURE__ */ jsx("div", { className: "panel-heading", children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { children: "Exam schedule" }),
            /* @__PURE__ */ jsx("p", { children: "Upcoming assessments for your class" })
          ] }) }),
          data.exams.length ? data.exams.slice(0, 6).map((exam) => /* @__PURE__ */ jsxs("div", { className: "schedule-row", children: [
            /* @__PURE__ */ jsx("div", { className: "schedule-dot" }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("strong", { children: exam.name }),
              /* @__PURE__ */ jsxs("span", { children: [
                exam.className,
                " \xB7 ",
                exam.subjects.map((subject) => subject.name).join(", ")
              ] })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "status-pill status-blue", children: exam.status.toLowerCase() })
          ] }, exam.id)) : /* @__PURE__ */ jsx(EmptyState, { title: "No exams scheduled", message: "There are no exams scheduled for your current class." })
        ] })
      ] })
    ] });
  }
  if (data?.role === "TEACHER") {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx(PageHeading, { eyebrow: "TEACHER WORKSPACE", title: `Welcome, ${user.fullName.split(" ")[0]}`, description: "Your teaching assignments and assessment work at a glance." }),
      error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
      /* @__PURE__ */ jsxs("div", { className: "stats-grid stats-grid-three", children: [
        /* @__PURE__ */ jsx(StatCard, { label: "Assigned classes", value: data.stats.assignedClasses, note: "Classes you teach", icon: Users, tone: "tone-violet" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Students", value: data.stats.students, note: "In your assigned classes", icon: GraduationCap, tone: "tone-blue" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Open assessments", value: data.stats.pendingExaminations, note: "Ready for marks entry", icon: BookOpenCheck, tone: "tone-orange" })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsx("div", { className: "panel-heading", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: "Your classes" }),
          /* @__PURE__ */ jsx("p", { children: "Classes and sections assigned to your account" })
        ] }) }),
        data.classes.length ? /* @__PURE__ */ jsx("div", { className: "class-grid compact-class-grid", children: data.classes.map((item) => /* @__PURE__ */ jsxs("article", { className: "class-card", children: [
          /* @__PURE__ */ jsxs("div", { className: "class-card-top", children: [
            /* @__PURE__ */ jsx("div", { className: "grade-mark", children: item.name.match(/\d+/)?.[0] ?? "CL" }),
            /* @__PURE__ */ jsx("span", { className: "class-year", children: item.academicYear })
          ] }),
          /* @__PURE__ */ jsx("h2", { children: item.name }),
          /* @__PURE__ */ jsxs("div", { className: "class-card-stats", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx(Users, { size: 15 }),
              item.studentCount,
              " students"
            ] }),
            /* @__PURE__ */ jsxs("span", { children: [
              item.sections.length,
              " sections"
            ] })
          ] })
        ] }, item.id)) }) : /* @__PURE__ */ jsx(EmptyState, { title: "No teaching assignments", message: "Your assigned classes will appear here." })
      ] }),
      /* @__PURE__ */ jsxs("section", { className: "panel", children: [
        /* @__PURE__ */ jsx("div", { className: "panel-heading", children: /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: "Recent examinations" }),
          /* @__PURE__ */ jsx("p", { children: "Assessments linked to your subjects" })
        ] }) }),
        data.exams.length ? /* @__PURE__ */ jsx("div", { className: "schedule-list", children: data.exams.map((exam) => /* @__PURE__ */ jsxs("div", { className: "schedule-row", children: [
          /* @__PURE__ */ jsx("div", { className: "schedule-dot" }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("strong", { children: exam.name }),
            /* @__PURE__ */ jsxs("span", { children: [
              exam.schoolClass?.name,
              " \xB7 ",
              exam.type
            ] })
          ] }),
          /* @__PURE__ */ jsx("span", { className: `status-pill ${exam.status === "PUBLISHED" ? "status-green" : "status-blue"}`, children: exam.status.toLowerCase() })
        ] }, exam.id)) }) : /* @__PURE__ */ jsx(EmptyState, { title: "No examinations assigned", message: "Exams for your assigned subjects will appear here." })
      ] })
    ] });
  }
  const admin = data;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "SCHOOL AT A GLANCE", title: `Welcome, ${user.fullName.split(" ")[0]}`, description: "A live view of student progress and academic performance.", actions: admin && /* @__PURE__ */ jsxs("div", { className: "dashboard-filters", children: [
      /* @__PURE__ */ jsxs("select", { value: yearId, onChange: (event) => {
        setYearId(event.target.value);
        setClassId("");
        setExamId("");
        setSubjectId("");
        setSection("");
        void load("", "", "", event.target.value, "");
      }, "aria-label": "Filter by academic year", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All academic years" }),
        admin.filters.allAcademicYears.map((year) => /* @__PURE__ */ jsx("option", { value: year.id, children: year.name }, year.id))
      ] }),
      /* @__PURE__ */ jsxs("select", { value: classId, onChange: (event) => {
        setClassId(event.target.value);
        setExamId("");
        setSubjectId("");
        setSection("");
        void load("", "", "", yearId, event.target.value);
      }, "aria-label": "Filter by class", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All classes" }),
        admin.filters.classes.filter((item) => !yearId || item.academicYearId === yearId).map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.name }, item.id))
      ] }),
      /* @__PURE__ */ jsxs("select", { value: examId || admin.filters.selectedExamId || "", onChange: (event) => {
        setExamId(event.target.value);
        setSubjectId("");
        setSection("");
        void load(event.target.value, "", "");
      }, "aria-label": "Filter by examination", children: [
        !admin.filters.examinations.length && /* @__PURE__ */ jsx("option", { value: "", children: "No published exams" }),
        admin.filters.examinations.map((exam) => /* @__PURE__ */ jsxs("option", { value: exam.id, children: [
          exam.name,
          " \xB7 ",
          exam.className
        ] }, exam.id))
      ] }),
      !!admin.filters.sections.length && /* @__PURE__ */ jsxs("select", { value: section, onChange: (event) => {
        setSection(event.target.value);
        void load(examId || admin.filters.selectedExamId || "", subjectId, event.target.value);
      }, "aria-label": "Filter by section", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All sections" }),
        admin.filters.sections.map((item) => /* @__PURE__ */ jsx("option", { value: item.name, children: item.name }, item.id))
      ] }),
      !!admin.filters.subjects.length && /* @__PURE__ */ jsxs("select", { value: subjectId, onChange: (event) => {
        setSubjectId(event.target.value);
        void load(examId || admin.filters.selectedExamId || "", event.target.value, section);
      }, "aria-label": "Filter by subject", children: [
        /* @__PURE__ */ jsx("option", { value: "", children: "All subjects" }),
        admin.filters.subjects.map((subject) => /* @__PURE__ */ jsx("option", { value: subject.id, children: subject.name }, subject.id))
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    !admin?.filters.examinations.length ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No published examination data", message: "Once an examination is published, live results and analytics will be available here." }) }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("div", { className: "stats-grid", children: [
        /* @__PURE__ */ jsx(StatCard, { label: "Active students", value: admin.stats.totalStudents.toLocaleString(), note: "Current school enrollment", icon: Users, tone: "tone-violet" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Students appeared", value: admin.stats.appeared.toLocaleString(), note: "In selected examination", icon: GraduationCap, tone: "tone-blue" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Passed", value: admin.stats.passed.toLocaleString(), note: `${admin.stats.passPercentage}% pass rate`, icon: BookOpenCheck, tone: "tone-green", trend: "up" }),
        /* @__PURE__ */ jsx(StatCard, { label: "Distinctions", value: admin.stats.distinction.toLocaleString(), note: "Above configured threshold", icon: Award, tone: "tone-orange" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "content-grid dashboard-charts", children: [
        /* @__PURE__ */ jsxs("section", { className: "panel chart-panel", children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h2", { children: "Result distribution" }),
              /* @__PURE__ */ jsx("p", { children: admin.filters.examinations.find((exam) => exam.id === (examId || admin.filters.selectedExamId))?.name ?? "Selected examination" })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "chart-caption", children: "Pass vs. fail" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "chart-area pie-area", children: admin.stats.appeared ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(PieChart, { children: [
              /* @__PURE__ */ jsxs(Pie, { data: [{ name: "Passed", value: admin.stats.passed }, { name: "Failed", value: admin.stats.failed }], dataKey: "value", nameKey: "name", innerRadius: 66, outerRadius: 92, paddingAngle: 4, children: [
                /* @__PURE__ */ jsx(Cell, { fill: "#45b88a" }),
                /* @__PURE__ */ jsx(Cell, { fill: "#ed777a" })
              ] }),
              /* @__PURE__ */ jsx(Tooltip, {})
            ] }) }),
            /* @__PURE__ */ jsxs("div", { className: "chart-center", children: [
              /* @__PURE__ */ jsxs("strong", { children: [
                admin.stats.passPercentage,
                "%"
              ] }),
              /* @__PURE__ */ jsx("span", { children: "pass rate" })
            ] })
          ] }) : /* @__PURE__ */ jsx(EmptyState, { title: "No result data", message: "No students have results for this examination." }) }),
          /* @__PURE__ */ jsxs("div", { className: "chart-legend", children: [
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("i", { className: "legend-dot green-dot" }),
              "Passed ",
              /* @__PURE__ */ jsx("strong", { children: admin.stats.passed })
            ] }),
            /* @__PURE__ */ jsxs("span", { children: [
              /* @__PURE__ */ jsx("i", { className: "legend-dot red-dot" }),
              "Failed ",
              /* @__PURE__ */ jsx("strong", { children: admin.stats.failed })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "panel chart-panel", children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h2", { children: "Subject performance" }),
              /* @__PURE__ */ jsx("p", { children: "Average marks by subject" })
            ] }),
            /* @__PURE__ */ jsx("span", { className: "chart-caption", children: "Average %" })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "chart-area bar-area", children: admin.subjectPerformance.length ? /* @__PURE__ */ jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxs(BarChart, { data: admin.subjectPerformance, margin: { top: 10, right: 12, left: -20, bottom: 4 }, children: [
            /* @__PURE__ */ jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#edf0f5" }),
            /* @__PURE__ */ jsx(XAxis, { dataKey: "subject", tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "#8290a5" } }),
            /* @__PURE__ */ jsx(YAxis, { domain: [0, 100], tickLine: false, axisLine: false, tick: { fontSize: 11, fill: "#8290a5" } }),
            /* @__PURE__ */ jsx(Tooltip, { formatter: (value) => [`${value}%`, "Average"] }),
            /* @__PURE__ */ jsx(Bar, { dataKey: "average", radius: [6, 6, 0, 0], barSize: 30, children: admin.subjectPerformance.map((item, index) => /* @__PURE__ */ jsx(Cell, { fill: chartColors[index % chartColors.length] }, item.subject)) })
          ] }) }) : /* @__PURE__ */ jsx(EmptyState, { title: "No subject results", message: "No score data is available." }) }),
          !!admin.subjectPerformance.length && /* @__PURE__ */ jsx("div", { className: "subject-toppers", children: admin.subjectPerformance.map((item) => item.topper && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsxs("span", { children: [
              item.subject,
              " topper"
            ] }),
            /* @__PURE__ */ jsx("strong", { children: item.topper.name }),
            /* @__PURE__ */ jsx("b", { children: item.topper.score })
          ] }, item.subject)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "content-grid dashboard-lower", children: [
        /* @__PURE__ */ jsxs("section", { className: "panel", children: [
          /* @__PURE__ */ jsxs("div", { className: "panel-heading", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h2", { children: "Top performers" }),
              /* @__PURE__ */ jsx("p", { children: "Highest overall results in this examination" })
            ] }),
            /* @__PURE__ */ jsxs("span", { className: "table-link", children: [
              admin.toppers.length,
              " students"
            ] })
          ] }),
          admin.toppers.length ? /* @__PURE__ */ jsx("div", { className: "table-scroll", children: /* @__PURE__ */ jsxs("table", { children: [
            /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { children: "RANK" }),
              /* @__PURE__ */ jsx("th", { children: "STUDENT" }),
              /* @__PURE__ */ jsx("th", { children: "SECTION" }),
              /* @__PURE__ */ jsx("th", { children: "SCORE" }),
              /* @__PURE__ */ jsx("th", { children: "GRADE" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { children: admin.toppers.map((topper) => /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("span", { className: `rank-badge rank-${Math.min(topper.rank, 3)}`, children: [
                "#",
                topper.rank
              ] }) }),
              /* @__PURE__ */ jsxs("td", { children: [
                /* @__PURE__ */ jsx("strong", { children: topper.student }),
                /* @__PURE__ */ jsx("span", { className: "cell-subtle", children: topper.admissionNo })
              ] }),
              /* @__PURE__ */ jsx("td", { children: topper.section || "\u2014" }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("strong", { children: [
                topper.percentage.toFixed(1),
                "%"
              ] }) }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: "grade-pill", children: topper.grade }) })
            ] }, topper.admissionNo)) })
          ] }) }) : /* @__PURE__ */ jsx(EmptyState, { title: "No results yet", message: "Published results will populate this ranking." })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "panel", children: [
          /* @__PURE__ */ jsx("div", { className: "panel-heading", children: /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { children: "Class snapshot" }),
            /* @__PURE__ */ jsx("p", { children: "Performance by section" })
          ] }) }),
          admin.classPerformance.length ? admin.classPerformance.flatMap((item) => item.sections.map((section2) => /* @__PURE__ */ jsxs("div", { className: "class-performance-row", children: [
            /* @__PURE__ */ jsxs("div", { className: "class-performance-title", children: [
              /* @__PURE__ */ jsxs("strong", { children: [
                item.className,
                " \xB7 ",
                section2.name
              ] }),
              /* @__PURE__ */ jsxs("span", { children: [
                section2.appeared,
                " of ",
                section2.students,
                " appeared"
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "progress-track", children: /* @__PURE__ */ jsx("div", { style: { width: `${section2.appeared ? section2.passed / section2.appeared * 100 : 0}%` } }) }),
            /* @__PURE__ */ jsxs("small", { children: [
              section2.appeared ? Math.round(section2.passed / section2.appeared * 100) : 0,
              "% pass \xB7 avg ",
              section2.averagePercentage,
              "% \xB7 high ",
              section2.highestPercentage,
              "% \xB7 low ",
              section2.lowestPercentage,
              "%"
            ] })
          ] }, `${item.className}-${section2.name}`))) : /* @__PURE__ */ jsx(EmptyState, { title: "No class data", message: "Class performance appears after publishing results." })
        ] })
      ] })
    ] })
  ] });
}
export {
  DashboardPage as default
};
