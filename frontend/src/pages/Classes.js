import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Pencil, Plus, Users } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function ClassesPage({ isAdmin }) {
  const [classes, setClasses] = useState([]);
  const [years, setYears] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [classData, yearData, teacherData] = await Promise.all([
        api("/school/classes"),
        api("/school/academic-years"),
        isAdmin ? api("/school/teachers") : Promise.resolve([])
      ]);
      setClasses(classData);
      setYears(yearData);
      setTeachers(teacherData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load classes");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function closeForm() {
    setShowForm(false);
    setEditingClass(null);
  }
  async function saveClass(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const sections = String(form.get("sections") || "A").split(",").map((name) => name.trim()).filter(Boolean);
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.get("name"),
        grade: Number(form.get("grade")),
        classTeacherId: form.get("classTeacherId") || (editingClass ? null : void 0)
      };
      if (editingClass) {
        await api(`/school/classes/${editingClass.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        setNotice("Class updated");
      } else {
        await api("/school/classes", { method: "POST", body: JSON.stringify({
          ...payload,
          academicYearId: form.get("academicYearId"),
          sections
        }) });
        setNotice("Class created");
      }
      closeForm();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not ${editingClass ? "update" : "create"} class`);
    } finally {
      setBusy(false);
    }
  }
  async function addSection(schoolClass) {
    const name = window.prompt(`Add a section to ${schoolClass.name} (for example, B):`)?.trim();
    if (!name) return;
    try {
      await api(`/school/classes/${schoolClass.id}/sections`, { method: "POST", body: JSON.stringify({ name }) });
      setNotice(`Section ${name} added to ${schoolClass.name}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add section");
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "ACADEMICS", title: "Classes & sections", description: "Organize grade levels, sections, and class rosters.", actions: isAdmin ? /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => {
      setEditingClass(null);
      setShowForm(true);
    }, children: [
      /* @__PURE__ */ jsx(Plus, { size: 16 }),
      " Create class"
    ] }) : void 0 }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    notice && /* @__PURE__ */ jsxs("div", { className: "success-banner", children: [
      notice,
      /* @__PURE__ */ jsx("button", { onClick: () => setNotice(""), children: "Dismiss" })
    ] }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : classes.length === 0 ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No classes yet", message: "Create an academic year first, then add your classes." }) }) : /* @__PURE__ */ jsx("div", { className: "class-grid", children: classes.map((item) => /* @__PURE__ */ jsxs("article", { className: "class-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "class-card-top", children: [
        /* @__PURE__ */ jsx("div", { className: "grade-mark", children: String(item.grade).padStart(2, "0") }),
        /* @__PURE__ */ jsxs("div", { className: "class-card-actions", children: [
          /* @__PURE__ */ jsx("span", { className: "class-year", children: item.academicYear.name }),
          isAdmin && /* @__PURE__ */ jsx("button", { type: "button", className: "icon-button", onClick: () => {
            setEditingClass(item);
            setShowForm(true);
          }, "aria-label": `Edit ${item.name}`, title: "Edit class", children: /* @__PURE__ */ jsx(Pencil, { size: 15 }) })
        ] })
      ] }),
      /* @__PURE__ */ jsx("h2", { children: item.name }),
      /* @__PURE__ */ jsx("p", { children: item.classTeacher?.fullName ? `Class teacher \xB7 ${item.classTeacher.fullName}` : "Class teacher not assigned" }),
      /* @__PURE__ */ jsxs("div", { className: "class-card-stats", children: [
        /* @__PURE__ */ jsxs("span", { children: [
          /* @__PURE__ */ jsx(Users, { size: 15 }),
          item._count.enrollments,
          " students"
        ] }),
        /* @__PURE__ */ jsxs("span", { children: [
          item.subjects.length,
          " subjects"
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "section-list", children: [
        /* @__PURE__ */ jsx("span", { className: "section-label", children: "SECTIONS" }),
        item.sections.map((section) => /* @__PURE__ */ jsxs("span", { className: "section-chip", children: [
          section.name,
          /* @__PURE__ */ jsx("small", { children: section._count?.enrollments ?? 0 })
        ] }, section.id)),
        isAdmin && /* @__PURE__ */ jsx("button", { className: "section-add", onClick: () => void addSection(item), "aria-label": `Add section to ${item.name}`, children: "+" })
      ] })
    ] }, item.id)) }),
    showForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "ACADEMIC STRUCTURE" }),
          /* @__PURE__ */ jsx("h2", { children: editingClass ? "Edit class" : "Create a class" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: closeForm, "aria-label": "Close form", children: "\xD7" })
      ] }),
      !editingClass && !years.length ? /* @__PURE__ */ jsx("div", { className: "empty-inline", children: "Create an academic year before setting up classes." }) : /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void saveClass(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Class name *" }),
          /* @__PURE__ */ jsx("input", { name: "name", required: true, defaultValue: editingClass?.name ?? "", placeholder: "e.g. Class 8" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Grade level *" }),
          /* @__PURE__ */ jsxs("select", { name: "grade", required: true, defaultValue: editingClass?.grade ?? "", children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Choose grade" }),
            Array.from({ length: 12 }, (_, index) => /* @__PURE__ */ jsxs("option", { value: index + 1, children: [
              "Grade ",
              index + 1
            ] }, index + 1))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: editingClass ? "Academic year" : "Academic year *" }),
          editingClass ? /* @__PURE__ */ jsx("input", { value: editingClass.academicYear.name, disabled: true }) : /* @__PURE__ */ jsxs("select", { name: "academicYearId", required: true, defaultValue: "", children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select year" }),
            years.map((year) => /* @__PURE__ */ jsxs("option", { value: year.id, children: [
              year.name,
              year.isCurrent ? " \xB7 Current" : ""
            ] }, year.id))
          ] })
        ] }),
        !editingClass && /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Sections" }),
          /* @__PURE__ */ jsx("input", { name: "sections", defaultValue: "A, B" }),
          /* @__PURE__ */ jsx("small", { children: "Separate section names with commas." })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Class teacher" }),
          /* @__PURE__ */ jsxs("select", { name: "classTeacherId", defaultValue: editingClass?.classTeacherId ?? "", children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Unassigned" }),
            teachers.map((teacher) => /* @__PURE__ */ jsx("option", { value: teacher.id, children: teacher.fullName }, teacher.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: closeForm, children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy, children: busy ? editingClass ? "Saving..." : "Creating..." : editingClass ? "Save changes" : "Create class" })
        ] })
      ] })
    ] }) })
  ] });
}
export {
  ClassesPage as default
};
