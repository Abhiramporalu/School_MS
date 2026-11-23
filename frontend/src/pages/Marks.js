import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Check, ClipboardList, Save } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function MarksPage() {
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState("");
  const [examSubjectId, setExamSubjectId] = useState("");
  const [roster, setRoster] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    api("/exams").then((items) => {
      setExams(items.filter((exam) => exam.status !== "PUBLISHED"));
      setLoading(false);
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not load exams");
      setLoading(false);
    });
  }, []);
  async function loadRoster(nextExamId = examId, nextSubjectId = examSubjectId) {
    if (!nextExamId || !nextSubjectId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await api(`/exams/${nextExamId}/marks/${nextSubjectId}`);
      setRoster(data);
      setDrafts(Object.fromEntries(data.students.map((student) => [student.id, student.score === null ? "" : String(student.score)])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load mark sheet");
    } finally {
      setLoading(false);
    }
  }
  async function saveMark(studentId) {
    if (!roster || drafts[studentId] === "") {
      setError("Enter a mark before saving");
      return;
    }
    setBusyId(studentId);
    setError("");
    setSaved("");
    try {
      await api(`/exams/${examId}/marks/${examSubjectId}/${studentId}`, {
        method: "PUT",
        body: JSON.stringify({ score: Number(drafts[studentId]) })
      });
      setSaved(studentId);
      window.setTimeout(() => setSaved((current) => current === studentId ? "" : current), 1800);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save mark");
    } finally {
      setBusyId("");
    }
  }
  const selectedExam = exams.find((exam) => exam.id === examId);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "ASSESSMENT", title: "Marks entry", description: "Enter scores for your assigned subjects. Scores are validated against the subject maximum." }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    /* @__PURE__ */ jsxs("section", { className: "panel marks-controls", children: [
      /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Examination" }),
        /* @__PURE__ */ jsxs("select", { value: examId, onChange: (event) => {
          setExamId(event.target.value);
          setExamSubjectId("");
          setRoster(null);
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
        /* @__PURE__ */ jsx("span", { children: "Subject" }),
        /* @__PURE__ */ jsxs("select", { value: examSubjectId, onChange: (event) => {
          setExamSubjectId(event.target.value);
          void loadRoster(examId, event.target.value);
        }, disabled: !selectedExam, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "Select a subject" }),
          selectedExam?.subjects?.map((subject) => /* @__PURE__ */ jsx("option", { value: subject.id, children: subject.classSubject.subject.name }, subject.id))
        ] })
      ] }),
      roster && /* @__PURE__ */ jsxs("div", { className: "mark-context", children: [
        /* @__PURE__ */ jsx(ClipboardList, { size: 17 }),
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx("strong", { children: roster.students.length }),
          " students \xB7 Max ",
          roster.subject.maxMarks,
          " \xB7 Pass ",
          roster.subject.passMarks
        ] })
      ] })
    ] }),
    !loading && !exams.length && /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No open examinations", message: "There are no examinations currently accepting marks." }) }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : roster && /* @__PURE__ */ jsxs("section", { className: "panel", children: [
      /* @__PURE__ */ jsx("div", { className: "table-scroll", children: /* @__PURE__ */ jsxs("table", { children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "STUDENT" }),
          /* @__PURE__ */ jsx("th", { children: "ADMISSION NO." }),
          /* @__PURE__ */ jsx("th", { children: "SECTION" }),
          /* @__PURE__ */ jsxs("th", { children: [
            "MARKS / ",
            roster.subject.maxMarks
          ] }),
          /* @__PURE__ */ jsx("th", { children: "ENTRY STATUS" }),
          /* @__PURE__ */ jsx("th", {})
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: roster.students.map((student) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("strong", { children: student.fullName }) }),
          /* @__PURE__ */ jsx("td", { className: "mono", children: student.admissionNo }),
          /* @__PURE__ */ jsx("td", { children: student.section }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("input", { className: "marks-input", type: "number", min: "0", max: roster.subject.maxMarks, step: "0.01", value: drafts[student.id] ?? "", onChange: (event) => setDrafts((current) => ({ ...current, [student.id]: event.target.value })), "aria-label": `Marks for ${student.fullName}` }) }),
          /* @__PURE__ */ jsx("td", { children: drafts[student.id] === "" ? /* @__PURE__ */ jsx("span", { className: "status-pill status-orange", children: "not entered" }) : /* @__PURE__ */ jsx("span", { className: "status-pill status-green", children: "entered" }) }),
          /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("button", { className: `button button-small ${saved === student.id ? "button-success" : "button-quiet"}`, onClick: () => void saveMark(student.id), disabled: busyId === student.id || roster.exam.status === "PUBLISHED", children: saved === student.id ? /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Check, { size: 14 }),
            " Saved"
          ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
            /* @__PURE__ */ jsx(Save, { size: 14 }),
            " ",
            busyId === student.id ? "Saving" : "Save"
          ] }) }) })
        ] }, student.id)) })
      ] }) }),
      !roster.students.length && /* @__PURE__ */ jsx(EmptyState, { title: "No students in this roster", message: "Check the exam class, section, and academic year enrollment." })
    ] })
  ] });
}
export {
  MarksPage as default
};
