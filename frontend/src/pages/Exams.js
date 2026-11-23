import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function ExamsPage({ isAdmin, teacherId }) {
  const [exams, setExams] = useState([]);
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [publishingId, setPublishingId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [examData, classData, yearData] = await Promise.all([
        api("/exams"),
        api("/school/classes"),
        api("/school/academic-years")
      ]);
      setExams(examData);
      setClasses(classData);
      setYears(yearData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load examinations");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function createExam(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedClass2 = classes.find((item) => item.id === form.get("classId"));
    const subjects = form.getAll("classSubjectId").map((rawClassSubjectId) => {
      const classSubjectId = String(rawClassSubjectId);
      const classSubject = selectedClass2?.subjects.find((item) => item.id === classSubjectId);
      return classSubject && {
        classSubjectId,
        maxMarks: Number(form.get(`max-${classSubjectId}`) || classSubject.maxMarks),
        passMarks: Number(form.get(`pass-${classSubjectId}`) || classSubject.passMarks),
        examDate: form.get(`date-${classSubjectId}`) || void 0
      };
    }).filter(Boolean);
    setBusy(true);
    setError("");
    try {
      await api("/exams", { method: "POST", body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        academicYearId: selectedClass2?.academicYearId,
        classId: selectedClass2?.id,
        sectionId: form.get("sectionId") || void 0,
        startsOn: form.get("startsOn") || void 0,
        endsOn: form.get("endsOn") || void 0,
        distinctionPct: Number(form.get("distinctionPct") || 75),
        subjects
      }) });
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create examination");
    } finally {
      setBusy(false);
    }
  }
  async function publishExam(exam) {
    if (!window.confirm(`Publish results for ${exam.name}? Marks cannot be edited after publication.`)) return;
    setPublishingId(exam.id);
    setError("");
    try {
      await api(`/exams/${exam.id}/publish`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not publish results");
    } finally {
      setPublishingId("");
    }
  }
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const availableSubjects = selectedClass?.subjects.filter(
    (item) => !teacherId || item.assignments.some(
      (assignment) => assignment.teacherId === teacherId && (assignment.sectionId === null || assignment.sectionId === selectedSectionId)
    )
  ) ?? [];
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "ASSESSMENT", title: "Examinations", description: "Plan assessment schedules and manage result publication.", actions: isAdmin || teacherId ? /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => setShowForm(true), children: [
      /* @__PURE__ */ jsx(Plus, { size: 16 }),
      " Create exam"
    ] }) : void 0 }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : exams.length === 0 ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No examinations yet", message: "Examinations and schedules assigned to you will appear here." }) }) : /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx("div", { className: "table-scroll", children: /* @__PURE__ */ jsxs("table", { children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsx("th", { children: "EXAMINATION" }),
        /* @__PURE__ */ jsx("th", { children: "CLASS / SECTION" }),
        /* @__PURE__ */ jsx("th", { children: "ACADEMIC YEAR" }),
        /* @__PURE__ */ jsx("th", { children: "SUBJECTS" }),
        /* @__PURE__ */ jsx("th", { children: "SCHEDULE" }),
        /* @__PURE__ */ jsx("th", { children: "STATUS" }),
        isAdmin && /* @__PURE__ */ jsx("th", {})
      ] }) }),
      /* @__PURE__ */ jsx("tbody", { children: exams.map((exam) => /* @__PURE__ */ jsxs("tr", { children: [
        /* @__PURE__ */ jsxs("td", { children: [
          /* @__PURE__ */ jsx("strong", { children: exam.name }),
          /* @__PURE__ */ jsx("span", { className: "cell-subtle", children: exam.type })
        ] }),
        /* @__PURE__ */ jsxs("td", { children: [
          exam.schoolClass?.name ?? "\u2014",
          exam.section?.name ? /* @__PURE__ */ jsxs("span", { className: "cell-subtle", children: [
            "Section ",
            exam.section.name
          ] }) : ""
        ] }),
        /* @__PURE__ */ jsx("td", { children: exam.academicYear?.name ?? "\u2014" }),
        /* @__PURE__ */ jsx("td", { children: exam.subjects?.length ?? 0 }),
        /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("span", { className: "date-cell", children: [
          /* @__PURE__ */ jsx(CalendarDays, { size: 14 }),
          exam.startsOn ? new Date(exam.startsOn).toLocaleDateString() : "Dates not set"
        ] }) }),
        /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `status-pill ${exam.status === "PUBLISHED" ? "status-green" : "status-blue"}`, children: exam.status === "MARKS_ENTRY" ? "marks entry" : exam.status.toLowerCase() }) }),
        isAdmin && /* @__PURE__ */ jsx("td", { children: exam.status !== "PUBLISHED" && /* @__PURE__ */ jsx("button", { className: "text-button", disabled: publishingId === exam.id, onClick: () => void publishExam(exam), children: publishingId === exam.id ? "Publishing..." : "Publish results" }) })
      ] }, exam.id)) })
    ] }) }) }),
    showForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card modal-wide", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "ASSESSMENT SETUP" }),
          /* @__PURE__ */ jsx("h2", { children: "Create examination" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => setShowForm(false), children: "\xD7" })
      ] }),
      !years.length || classes.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "Create an academic year, class, and class subjects before creating an examination." }) : /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void createExam(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Examination name *" }),
          /* @__PURE__ */ jsx("input", { name: "name", required: true, placeholder: "Mid-term assessment" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Type *" }),
          /* @__PURE__ */ jsxs("select", { name: "type", defaultValue: "Unit Test", children: [
            /* @__PURE__ */ jsx("option", { children: "Unit Test" }),
            /* @__PURE__ */ jsx("option", { children: "Mid-Term" }),
            /* @__PURE__ */ jsx("option", { children: "Final Examination" }),
            /* @__PURE__ */ jsx("option", { children: "Other" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Class *" }),
          /* @__PURE__ */ jsxs("select", { name: "classId", required: true, value: selectedClassId, onChange: (event) => {
            setSelectedClassId(event.target.value);
            setSelectedSectionId("");
          }, children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select class" }),
            classes.map((item) => /* @__PURE__ */ jsxs("option", { value: item.id, children: [
              item.name,
              " \xB7 ",
              item.academicYear.name
            ] }, item.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Section" }),
          /* @__PURE__ */ jsxs("select", { name: "sectionId", value: selectedSectionId, onChange: (event) => setSelectedSectionId(event.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "All sections" }),
            selectedClass?.sections.map((section) => /* @__PURE__ */ jsx("option", { value: section.id, children: section.name }, section.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Start date" }),
          /* @__PURE__ */ jsx("input", { type: "date", name: "startsOn" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "End date" }),
          /* @__PURE__ */ jsx("input", { type: "date", name: "endsOn" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Distinction threshold (%)" }),
          /* @__PURE__ */ jsx("input", { type: "number", name: "distinctionPct", min: "0", max: "100", defaultValue: "75" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Examination subjects *" }),
          !selectedClass ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "Select a class to load its subjects." }) : !availableSubjects.length ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "There are no subjects assigned to this teacher and section." }) : /* @__PURE__ */ jsx("div", { className: "exam-subject-select", children: availableSubjects.map((item) => /* @__PURE__ */ jsxs("div", { className: "exam-subject-option", children: [
            /* @__PURE__ */ jsxs("label", { className: "exam-subject-check", children: [
              /* @__PURE__ */ jsx("input", { type: "checkbox", name: "classSubjectId", value: item.id }),
              /* @__PURE__ */ jsxs("span", { className: "exam-subject-info", children: [
                /* @__PURE__ */ jsx("strong", { children: item.subject.name }),
                /* @__PURE__ */ jsxs("small", { children: [
                  "Class default: ",
                  item.maxMarks,
                  " max \xB7 ",
                  item.passMarks,
                  " pass"
                ] })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "mini-field", children: [
              "Max",
              /* @__PURE__ */ jsx("input", { name: `max-${item.id}`, type: "number", min: "1", defaultValue: item.maxMarks })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "mini-field", children: [
              "Pass",
              /* @__PURE__ */ jsx("input", { name: `pass-${item.id}`, type: "number", min: "0", defaultValue: item.passMarks })
            ] }),
            /* @__PURE__ */ jsxs("label", { className: "mini-field", children: [
              "Date",
              /* @__PURE__ */ jsx("input", { name: `date-${item.id}`, type: "date" })
            ] })
          ] }, item.id)) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => setShowForm(false), children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy, children: busy ? "Creating..." : "Create examination" })
        ] })
      ] })
    ] }) })
  ] });
}
export {
  ExamsPage as default
};
