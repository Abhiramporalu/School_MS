import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Plus, UserRoundCheck } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function SubjectsPage({ isAdmin }) {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [showCurriculumForm, setShowCurriculumForm] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [assignmentSubjectId, setAssignmentSubjectId] = useState("");
  const [assignmentTeacherId, setAssignmentTeacherId] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState([]);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [subjectData, classData, teacherData] = await Promise.all([
        api("/school/subjects"),
        api("/school/classes"),
        isAdmin ? api("/school/teachers") : Promise.resolve([])
      ]);
      setSubjects(subjectData);
      setClasses(classData);
      setTeachers(teacherData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load subjects");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function createSubject(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/school/subjects", { method: "POST", body: JSON.stringify({ name: form.get("name"), code: form.get("code") }) });
      setShowSubjectForm(false);
      setNotice("Subject created");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create subject");
    } finally {
      setBusy(false);
    }
  }
  async function addToClass(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const classId = String(form.get("classId"));
      await api(`/school/classes/${classId}/subjects`, { method: "POST", body: JSON.stringify({
        subjectId: form.get("subjectId"),
        maxMarks: Number(form.get("maxMarks")),
        passMarks: Number(form.get("passMarks"))
      }) });
      setShowCurriculumForm(false);
      setNotice("Subject added to class");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not assign subject");
    } finally {
      setBusy(false);
    }
  }
  async function addTeacher(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedAssignments.length) {
      setError("Select at least one class section for this subject");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const teacherId = String(form.get("teacherId"));
      await api("/school/assignments/bulk", { method: "POST", body: JSON.stringify({
        assignments: selectedAssignments,
        teacherId
      }) });
      setShowAssignmentForm(false);
      setSelectedAssignments([]);
      setAssignmentSubjectId("");
      setAssignmentTeacherId("");
      setNotice("Teacher assigned to the selected classes and sections");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not assign teacher");
    } finally {
      setBusy(false);
    }
  }
  const classSubjects = classes.flatMap((schoolClass) => schoolClass.subjects.map((classSubject) => ({
    ...classSubject,
    className: schoolClass.name,
    academicYear: schoolClass.academicYear.name,
    sections: schoolClass.sections
  })));
  const availableAssignmentClasses = classSubjects.filter((item) => item.subject.id === assignmentSubjectId);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "CURRICULUM", title: "Subjects", description: "Set subject combinations, scoring rules, and teaching assignments.", actions: isAdmin ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("button", { className: "button button-quiet", onClick: () => setShowSubjectForm(true), children: [
        /* @__PURE__ */ jsx(Plus, { size: 16 }),
        " New subject"
      ] }),
      /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => setShowCurriculumForm(true), children: [
        /* @__PURE__ */ jsx(Plus, { size: 16 }),
        " Add to class"
      ] })
    ] }) : void 0 }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    notice && /* @__PURE__ */ jsxs("div", { className: "success-banner", children: [
      notice,
      /* @__PURE__ */ jsx("button", { onClick: () => setNotice(""), children: "Dismiss" })
    ] }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : classes.length === 0 ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No class subjects yet", message: "Create classes and subjects to build the curriculum." }) }) : /* @__PURE__ */ jsx("div", { className: "curriculum-list", children: classes.map((schoolClass) => /* @__PURE__ */ jsxs("section", { className: "panel curriculum-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "curriculum-heading", children: [
        /* @__PURE__ */ jsx("div", { className: "grade-mark grade-mark-small", children: String(schoolClass.grade).padStart(2, "0") }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: schoolClass.name }),
          /* @__PURE__ */ jsxs("span", { children: [
            schoolClass.academicYear.name,
            " \xB7 ",
            schoolClass.subjects.length,
            " subjects"
          ] })
        ] })
      ] }),
      schoolClass.subjects.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "No subjects assigned to this class yet." }) : /* @__PURE__ */ jsx("div", { className: "subject-grid", children: schoolClass.subjects.map((item) => /* @__PURE__ */ jsxs("article", { className: "subject-tile", children: [
        /* @__PURE__ */ jsx("div", { className: "subject-icon", children: /* @__PURE__ */ jsx("span", { children: item.subject.name.slice(0, 1) }) }),
        /* @__PURE__ */ jsxs("div", { className: "subject-main", children: [
          /* @__PURE__ */ jsx("strong", { children: item.subject.name }),
          /* @__PURE__ */ jsx("span", { children: item.subject.code })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "subject-marks", children: [
          /* @__PURE__ */ jsx("strong", { children: Number(item.maxMarks) }),
          /* @__PURE__ */ jsx("span", { children: "max marks" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "subject-teacher", children: [
          /* @__PURE__ */ jsx(UserRoundCheck, { size: 14 }),
          item.assignments.length ? item.assignments.map((assignment) => assignment.teacher.fullName).join(", ") : "No teacher assigned"
        ] })
      ] }, item.id)) })
    ] }, schoolClass.id)) }),
    showSubjectForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "CATALOG" }),
          /* @__PURE__ */ jsx("h2", { children: "Create subject" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => setShowSubjectForm(false), children: "\xD7" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void createSubject(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Subject name *" }),
          /* @__PURE__ */ jsx("input", { name: "name", required: true, placeholder: "Mathematics" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Subject code *" }),
          /* @__PURE__ */ jsx("input", { name: "code", required: true, placeholder: "MATH" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => setShowSubjectForm(false), children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy, children: "Create subject" })
        ] })
      ] })
    ] }) }),
    showCurriculumForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "CLASS CURRICULUM" }),
          /* @__PURE__ */ jsx("h2", { children: "Add subject to class" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => setShowCurriculumForm(false), children: "\xD7" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void addToClass(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Class *" }),
          /* @__PURE__ */ jsxs("select", { name: "classId", required: true, defaultValue: "", children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select class" }),
            classes.map((item) => /* @__PURE__ */ jsxs("option", { value: item.id, children: [
              item.name,
              " \xB7 ",
              item.academicYear.name
            ] }, item.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Subject *" }),
          /* @__PURE__ */ jsxs("select", { name: "subjectId", required: true, defaultValue: "", children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select subject" }),
            subjects.map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.name }, item.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Maximum marks *" }),
          /* @__PURE__ */ jsx("input", { name: "maxMarks", type: "number", min: "1", defaultValue: "100", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Passing marks *" }),
          /* @__PURE__ */ jsx("input", { name: "passMarks", type: "number", min: "0", defaultValue: "35", required: true })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => setShowCurriculumForm(false), children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy, children: "Add subject" })
        ] })
      ] })
    ] }) }),
    showAssignmentForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "TEACHER ASSIGNMENT" }),
          /* @__PURE__ */ jsx("h2", { children: "Assign a subject teacher" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => setShowAssignmentForm(false), "aria-label": "Close form", children: "\xD7" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void addTeacher(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Subject *" }),
        /* @__PURE__ */ jsxs("select", { name: "subjectId", required: true, value: assignmentSubjectId, onChange: (event) => {
          setAssignmentSubjectId(event.target.value);
          setSelectedAssignments([]);
        }, children: [
          /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select subject" }),
          subjects.filter((subject) => classSubjects.some((item) => item.subject.id === subject.id)).map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.name }, item.id))
        ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
        /* @__PURE__ */ jsx("span", { children: "Teacher *" }),
        /* @__PURE__ */ jsxs("select", { name: "teacherId", required: true, value: assignmentTeacherId, onChange: (event) => {
          setAssignmentTeacherId(event.target.value);
          setSelectedAssignments([]);
        }, children: [
          /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select teacher" }),
          teachers.map((item) => /* @__PURE__ */ jsx("option", { value: item.id, children: item.fullName }, item.id))
        ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "field full-field", children: [
        /* @__PURE__ */ jsx("span", { children: "Classes *" }),
        !assignmentSubjectId ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "Choose a subject to see the classes that offer it." }) : availableAssignmentClasses.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "This subject is not assigned to any classes." }) : /* @__PURE__ */ jsxs("div", { className: "assignment-class-list", children: [
          /* @__PURE__ */ jsx("small", { children: "Choose All sections or select only the section(s) this teacher will teach." }),
          availableAssignmentClasses.map((item) => {
            const teacherAssignments = item.assignments.filter((assignment) => assignment.teacher.id === assignmentTeacherId);
            const alreadyAssignedToAll = teacherAssignments.some((assignment) => !assignment.sectionId);
            const selectedForAll = selectedAssignments.some((assignment) => assignment.classSubjectId === item.id && !assignment.sectionId);
            const studentCount = item.sections.reduce((total, section) => total + (section._count?.enrollments ?? 0), 0);
            return /* @__PURE__ */ jsxs("div", { className: "assignment-class-option", children: [
              /* @__PURE__ */ jsxs("div", { className: "assignment-class-heading", children: [
                /* @__PURE__ */ jsxs("span", { className: "assignment-class-details", children: [
                /* @__PURE__ */ jsx("strong", { children: item.className }),
                /* @__PURE__ */ jsxs("small", { children: [
                  item.academicYear,
                  " \xB7 ",
                  item.sections.length,
                  item.sections.length === 1 ? " section" : " sections",
                  " \xB7 ",
                  studentCount,
                  studentCount === 1 ? " student" : " students"
                ] })
              ] })
              ] }),
              /* @__PURE__ */ jsx("div", { className: "assignment-section-options", children: [
              /* @__PURE__ */ jsxs("label", { className: `assignment-section-option${alreadyAssignedToAll ? " assignment-section-disabled" : ""}`, children: [
                /* @__PURE__ */ jsx("input", {
                  type: "checkbox",
                  checked: selectedForAll,
                  disabled: alreadyAssignedToAll || !assignmentTeacherId || teacherAssignments.length > 0,
                  onChange: (event) => setSelectedAssignments((current) => event.target.checked
                    ? [...current.filter((assignment) => assignment.classSubjectId !== item.id), { classSubjectId: item.id, sectionId: null }]
                    : current.filter((assignment) => !(assignment.classSubjectId === item.id && !assignment.sectionId)))
                }),
                "All sections",
                teacherAssignments.length > 0 && !alreadyAssignedToAll && /* @__PURE__ */ jsx("small", { children: "Some assigned" })
              ] }),
              item.sections.map((section) => {
                const alreadyAssigned = alreadyAssignedToAll || teacherAssignments.some((assignment) => assignment.sectionId === section.id);
                const selected = selectedAssignments.some((assignment) => assignment.classSubjectId === item.id && assignment.sectionId === section.id);
                const sectionStudents = section._count?.enrollments ?? 0;
                return /* @__PURE__ */ jsxs("label", { className: `assignment-section-option${alreadyAssigned ? " assignment-section-disabled" : ""}`, children: [
                  /* @__PURE__ */ jsx("input", {
                    type: "checkbox",
                    checked: selected,
                    disabled: alreadyAssigned || !assignmentTeacherId,
                    onChange: (event) => setSelectedAssignments((current) => event.target.checked
                      ? [...current.filter((assignment) => !(assignment.classSubjectId === item.id && !assignment.sectionId)), { classSubjectId: item.id, sectionId: section.id }]
                      : current.filter((assignment) => !(assignment.classSubjectId === item.id && assignment.sectionId === section.id)))
                  }),
                  section.name,
                  /* @__PURE__ */ jsx("small", { children: `${sectionStudents} ${sectionStudents === 1 ? "student" : "students"}` }),
                  alreadyAssigned && /* @__PURE__ */ jsx("small", { children: "Assigned" })
                ] }, section.id);
              })
              ] })
            ] }, item.id);
          })
        ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
        /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => setShowAssignmentForm(false), children: "Cancel" }),
        /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy || !assignmentTeacherId || !selectedAssignments.length, children: busy ? "Assigning..." : `Assign ${selectedAssignments.length ? `(${selectedAssignments.length})` : "teacher"}` })
        ] })
      ] })
    ] }) }),
    isAdmin && classes.length > 0 && /* @__PURE__ */ jsx("div", { className: "floating-assignment", children: /* @__PURE__ */ jsxs("button", { className: "button button-quiet", onClick: () => {
      setAssignmentSubjectId("");
      setAssignmentTeacherId("");
      setSelectedAssignments([]);
      setShowAssignmentForm(true);
    }, children: [
      /* @__PURE__ */ jsx(UserRoundCheck, { size: 16 }),
      " Assign teacher"
    ] }) })
  ] });
}
export {
  SubjectsPage as default
};
