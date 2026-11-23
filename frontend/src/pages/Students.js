import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Search, Upload, X } from "lucide-react";
import { api, csvDownload } from "../lib/api";
import { getInitials } from "../lib/display";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value.trim());
      value = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else value += char;
  }
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift()?.map((header) => header.replace(/^\uFEFF/, "")) ?? [];
  return rows.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}
function StudentsPage({ isAdmin }) {
  const [data, setData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [editing, setEditing] = useState(null);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ pageSize: "25", page: String(page) });
      if (search) params.set("search", search);
      if (classId) params.set("classId", classId);
      const [students, classData] = await Promise.all([
        api(`/students?${params}`),
        api("/school/classes")
      ]);
      setData(students);
      setClasses(classData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load students");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [search, classId, page]);
  const activeClasses = useMemo(() => classes.filter((item) => item.academicYear?.isCurrent), [classes]);
  const visibleStudents = useMemo(() => [...data?.items ?? []].sort((a, b) => {
    const valueA = sortKey === "name" ? a.fullName : sortKey === "admission" ? a.admissionNo : a.enrollments[0]?.rollNumber ?? "";
    const valueB = sortKey === "name" ? b.fullName : sortKey === "admission" ? b.admissionNo : b.enrollments[0]?.rollNumber ?? "";
    return valueA.localeCompare(valueB, void 0, { numeric: true }) * (sortAsc ? 1 : -1);
  }), [data, sortKey, sortAsc]);
  function changeSort(key) {
    if (sortKey === key) setSortAsc((current) => !current);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }
  async function createStudent(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedClass = classes.find((item) => item.id === form.get("classId"));
    setBusy(true);
    setError("");
    try {
      const payload = {
        admissionNo: editing ? form.get("admissionNo") : void 0,
        fullName: form.get("fullName"),
        dateOfBirth: form.get("dateOfBirth") || void 0,
        gender: form.get("gender") || void 0,
        email: form.get("email") || void 0,
        guardianName: form.get("guardianName") || void 0,
        guardianPhone: form.get("guardianPhone") || void 0,
        guardianEmail: form.get("guardianEmail") || void 0,
        address: form.get("address") || void 0,
        photoUrl: form.get("photoUrl") || void 0,
        admissionDate: form.get("admissionDate") || void 0,
        enrollment: {
          classId: selectedClass?.id,
          academicYearId: selectedClass?.academicYearId,
          sectionId: form.get("sectionId"),
          rollNumber: form.get("rollNumber")
        }
      };
      if (editing) {
        await api(`/students/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            ...payload,
            email: payload.email,
            status: form.get("status"),
            enrollment: selectedClass ? payload.enrollment : void 0
          })
        });
        setNotice("Student details updated");
      } else {
        const created = await api("/students", {
          method: "POST",
          body: JSON.stringify({ ...payload, loginPassword: form.get("loginPassword") || void 0 })
        });
        setNotice(`Student added successfully. Admission number: ${created.admissionNo}`);
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add student");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file) {
    if (!file) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const rows = parseCsv(await file.text()).map((row) => ({
        admissionNo: row.admissionNo,
        fullName: row.fullName,
        email: row.email || void 0,
        guardianName: row.guardianName || void 0,
        guardianPhone: row.guardianPhone || void 0,
        guardianEmail: row.guardianEmail || void 0,
        enrollment: {
          classId: row.classId,
          sectionId: row.sectionId,
          academicYearId: row.academicYearId,
          rollNumber: row.rollNumber
        }
      }));
      const result = await api("/students/import", { method: "POST", body: JSON.stringify({ rows }) });
      setNotice(`${result.imported} students imported`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not import the CSV file");
    } finally {
      setBusy(false);
    }
  }
  function downloadTemplate() {
    csvDownload("student-import-template.csv", [[
      "admissionNo",
      "fullName",
      "email",
      "guardianName",
      "guardianPhone",
      "guardianEmail",
      "classId",
      "sectionId",
      "academicYearId",
      "rollNumber"
    ]]);
  }
  async function deactivate(student) {
    if (!window.confirm(`Deactivate ${student.fullName}?`)) return;
    try {
      await api(`/students/${student.id}`, { method: "DELETE" });
      setNotice(`${student.fullName} deactivated`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not deactivate student");
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "PEOPLE", title: "Students", description: `${data?.total ?? 0} students in the school directory.`, actions: isAdmin && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("button", { className: "button button-quiet", onClick: downloadTemplate, children: [
        /* @__PURE__ */ jsx(Download, { size: 16 }),
        " CSV template"
      ] }),
      /* @__PURE__ */ jsxs("label", { className: `button button-quiet ${busy ? "disabled" : ""}`, children: [
        /* @__PURE__ */ jsx(Upload, { size: 16 }),
        " Import CSV",
        /* @__PURE__ */ jsx("input", { type: "file", accept: ".csv,text/csv", hidden: true, disabled: busy, onChange: (event) => {
          void importFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        } })
      ] }),
      /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => setShowForm(true), children: [
        /* @__PURE__ */ jsx(Plus, { size: 16 }),
        " Add student"
      ] })
    ] }) }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    notice && /* @__PURE__ */ jsxs("div", { className: "success-banner", children: [
      notice,
      /* @__PURE__ */ jsx("button", { onClick: () => setNotice(""), "aria-label": "Dismiss", children: /* @__PURE__ */ jsx(X, { size: 15 }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "toolbar", children: [
        /* @__PURE__ */ jsxs("label", { className: "search-field", children: [
          /* @__PURE__ */ jsx(Search, { size: 17 }),
          /* @__PURE__ */ jsx("input", { placeholder: "Search name, admission no. or roll no.", value: search, onChange: (event) => {
            setSearch(event.target.value);
            setPage(1);
          } })
        ] }),
        /* @__PURE__ */ jsxs("select", { className: "input-select filter-select", value: classId, onChange: (event) => {
          setClassId(event.target.value);
          setPage(1);
        }, children: [
          /* @__PURE__ */ jsx("option", { value: "", children: "All classes" }),
          classes.map((item) => /* @__PURE__ */ jsxs("option", { value: item.id, children: [
            item.name,
            " \xB7 ",
            item.academicYear?.name
          ] }, item.id))
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx(LoadingState, {}) : !data?.items.length ? /* @__PURE__ */ jsx(EmptyState, { title: "No students found", message: "Try a different search, or add your first student." }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("div", { className: "table-scroll", children: /* @__PURE__ */ jsxs("table", { children: [
          /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("th", { children: /* @__PURE__ */ jsxs("button", { className: "sort-button", onClick: () => changeSort("name"), children: [
              "STUDENT ",
              sortKey === "name" ? sortAsc ? "\u2191" : "\u2193" : ""
            ] }) }),
            /* @__PURE__ */ jsx("th", { children: /* @__PURE__ */ jsxs("button", { className: "sort-button", onClick: () => changeSort("admission"), children: [
              "ADMISSION NO. ",
              sortKey === "admission" ? sortAsc ? "\u2191" : "\u2193" : ""
            ] }) }),
            /* @__PURE__ */ jsx("th", { children: "CLASS / SECTION" }),
            /* @__PURE__ */ jsx("th", { children: /* @__PURE__ */ jsxs("button", { className: "sort-button", onClick: () => changeSort("roll"), children: [
              "ROLL NO. ",
              sortKey === "roll" ? sortAsc ? "\u2191" : "\u2193" : ""
            ] }) }),
            /* @__PURE__ */ jsx("th", { children: "GUARDIAN" }),
            /* @__PURE__ */ jsx("th", { children: "STATUS" }),
            /* @__PURE__ */ jsx("th", {})
          ] }) }),
          /* @__PURE__ */ jsx("tbody", { children: visibleStudents.map((student) => {
            const enrollment = student.enrollments[0];
            return /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsxs("div", { className: "table-person", children: [
                /* @__PURE__ */ jsx("div", { className: "avatar avatar-small", children: getInitials(student.fullName) }),
                /* @__PURE__ */ jsxs("div", { children: [
                  /* @__PURE__ */ jsx("strong", { children: student.fullName }),
                  /* @__PURE__ */ jsx("span", { children: student.email || "No email address" })
                ] })
              ] }) }),
              /* @__PURE__ */ jsx("td", { className: "mono", children: student.admissionNo }),
              /* @__PURE__ */ jsx("td", { children: enrollment ? /* @__PURE__ */ jsxs(Fragment, { children: [
                /* @__PURE__ */ jsx("strong", { children: enrollment.schoolClass.name }),
                /* @__PURE__ */ jsxs("span", { className: "cell-subtle", children: [
                  enrollment.section.name,
                  " \xB7 ",
                  enrollment.academicYear.name
                ] })
              ] }) : "\u2014" }),
              /* @__PURE__ */ jsx("td", { children: enrollment?.rollNumber ?? "\u2014" }),
              /* @__PURE__ */ jsxs("td", { children: [
                student.parent?.fullName || "\u2014",
                /* @__PURE__ */ jsx("span", { className: "cell-subtle", children: student.parent?.phone || "" })
              ] }),
              /* @__PURE__ */ jsx("td", { children: /* @__PURE__ */ jsx("span", { className: `status-pill ${student.status === "ACTIVE" ? "status-green" : "status-grey"}`, children: student.status.toLowerCase() }) }),
              /* @__PURE__ */ jsx("td", { children: isAdmin && /* @__PURE__ */ jsxs("div", { className: "row-actions", children: [
                /* @__PURE__ */ jsx("button", { className: "text-button", onClick: () => {
                  setEditing(student);
                  setSelectedClassId(enrollment?.schoolClass.id ?? "");
                  setSelectedSectionId(enrollment?.section.id ?? "");
                  setShowForm(true);
                }, children: "Edit" }),
                student.status === "ACTIVE" && /* @__PURE__ */ jsx("button", { className: "text-button danger-text", onClick: () => void deactivate(student), children: "Deactivate" })
              ] }) })
            ] }, student.id);
          }) })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "pagination", children: [
          /* @__PURE__ */ jsxs("span", { children: [
            "Showing ",
            data.total ? (data.page - 1) * 25 + 1 : 0,
            "\u2013",
            Math.min(data.page * 25, data.total),
            " of ",
            data.total,
            " students"
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("button", { className: "button button-quiet button-small", disabled: page <= 1, onClick: () => setPage((current) => current - 1), children: "Previous" }),
            /* @__PURE__ */ jsxs("span", { children: [
              "Page ",
              page,
              " of ",
              Math.max(data.pages, 1)
            ] }),
            /* @__PURE__ */ jsx("button", { className: "button button-quiet button-small", disabled: page >= data.pages, onClick: () => setPage((current) => current + 1), children: "Next" })
          ] })
        ] })
      ] })
    ] }),
    showForm && isAdmin && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", onMouseDown: (event) => {
      if (event.target === event.currentTarget) {
        setShowForm(false);
        setEditing(null);
      }
    }, children: /* @__PURE__ */ jsxs("div", { className: "modal-card modal-wide", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "STUDENT RECORD" }),
          /* @__PURE__ */ jsx("h2", { children: editing ? "Edit student" : "Add a student" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => {
          setShowForm(false);
          setEditing(null);
        }, "aria-label": "Close", children: /* @__PURE__ */ jsx(X, { size: 19 }) })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void createStudent(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Full name *" }),
          /* @__PURE__ */ jsx("input", { name: "fullName", required: true, minLength: 2, defaultValue: editing?.fullName ?? "", placeholder: "Student name" })
        ] }),
        editing ? /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Admission number" }),
          /* @__PURE__ */ jsx("input", { name: "admissionNo", required: true, defaultValue: editing.admissionNo })
        ] }) : /* @__PURE__ */ jsxs("div", { className: "field admission-auto-note", children: [
          /* @__PURE__ */ jsx("span", { children: "Admission number" }),
          /* @__PURE__ */ jsx("input", { value: "Generated automatically when the student is saved", readOnly: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Date of birth" }),
          /* @__PURE__ */ jsx("input", { name: "dateOfBirth", type: "date", defaultValue: editing?.dateOfBirth?.slice(0, 10) ?? "" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Gender" }),
          /* @__PURE__ */ jsxs("select", { name: "gender", defaultValue: editing?.gender ?? "", children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Not specified" }),
            /* @__PURE__ */ jsx("option", { children: "Female" }),
            /* @__PURE__ */ jsx("option", { children: "Male" }),
            /* @__PURE__ */ jsx("option", { children: "Other" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Email" }),
          /* @__PURE__ */ jsx("input", { name: "email", type: "email", defaultValue: editing?.email ?? "", placeholder: "student@example.com" })
        ] }),
        !editing && /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Student login password" }),
          /* @__PURE__ */ jsx("input", { name: "loginPassword", type: "password", minLength: 12, placeholder: "At least 12 characters" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Parent / guardian" }),
          /* @__PURE__ */ jsx("input", { name: "guardianName", defaultValue: editing?.parent?.fullName ?? "", placeholder: "Guardian name" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Guardian contact" }),
          /* @__PURE__ */ jsx("input", { name: "guardianPhone", defaultValue: editing?.parent?.phone ?? "", placeholder: "Phone number" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Guardian email" }),
          /* @__PURE__ */ jsx("input", { name: "guardianEmail", type: "email", defaultValue: editing?.parent?.email ?? "", placeholder: "parent@example.com" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Admission date" }),
          /* @__PURE__ */ jsx("input", { name: "admissionDate", type: "date", defaultValue: editing?.admissionDate?.slice(0, 10) ?? "" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Student status" }),
          /* @__PURE__ */ jsxs("select", { name: "status", defaultValue: editing?.status ?? "ACTIVE", children: [
            /* @__PURE__ */ jsx("option", { value: "ACTIVE", children: "Active" }),
            /* @__PURE__ */ jsx("option", { value: "INACTIVE", children: "Inactive" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Address" }),
          /* @__PURE__ */ jsx("input", { name: "address", defaultValue: editing?.address ?? "", placeholder: "Street, city, postal code" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Photograph URL" }),
          /* @__PURE__ */ jsx("input", { name: "photoUrl", type: "url", defaultValue: editing?.photoUrl ?? "", placeholder: "https://school.example/student.jpg" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Class *" }),
          /* @__PURE__ */ jsxs("select", { name: "classId", required: true, value: selectedClassId, onChange: (event) => {
            setSelectedClassId(event.target.value);
            setSelectedSectionId("");
          }, children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select class" }),
            (editing ? classes : activeClasses.length ? activeClasses : classes).map((item) => /* @__PURE__ */ jsxs("option", { value: item.id, children: [
              item.name,
              " \xB7 ",
              item.academicYear.name
            ] }, item.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Section *" }),
          /* @__PURE__ */ jsxs("select", { name: "sectionId", required: true, value: selectedSectionId, onChange: (event) => setSelectedSectionId(event.target.value), children: [
            /* @__PURE__ */ jsx("option", { value: "", disabled: true, children: "Select section" }),
            classes.find((item) => item.id === selectedClassId)?.sections.map((section) => /* @__PURE__ */ jsx("option", { value: section.id, children: section.name }, section.id))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Roll number *" }),
          /* @__PURE__ */ jsx("input", { name: "rollNumber", required: true, defaultValue: editing?.enrollments[0]?.rollNumber ?? "", placeholder: "e.g. 08" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => {
            setShowForm(false);
            setEditing(null);
          }, children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { type: "submit", className: "button button-primary", disabled: busy, children: busy ? "Saving..." : editing ? "Save changes" : "Save student" })
        ] })
      ] })
    ] }) })
  ] });
}
export {
  StudentsPage as default
};
