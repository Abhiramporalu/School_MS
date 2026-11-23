import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState, ErrorBanner, LoadingState, PageHeading } from "../components/Frame";
function TeachersPage() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);
  async function load() {
    setLoading(true);
    try {
      setTeachers(await api("/school/teachers"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load teachers");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function createTeacher(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api("/school/teachers", { method: "POST", body: JSON.stringify({
        fullName: form.get("fullName"),
        employeeNo: form.get("employeeNo"),
        email: form.get("email"),
        phone: form.get("phone") || void 0,
        password: form.get("password")
      }) });
      setShowForm(false);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create teacher account");
    } finally {
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "PEOPLE", title: "Teaching staff", description: `${teachers.length} teacher accounts.`, actions: /* @__PURE__ */ jsxs("button", { className: "button button-primary", onClick: () => setShowForm(true), children: [
      /* @__PURE__ */ jsx(Plus, { size: 16 }),
      " Add teacher"
    ] }) }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    loading ? /* @__PURE__ */ jsx(LoadingState, {}) : teachers.length === 0 ? /* @__PURE__ */ jsx("section", { className: "panel", children: /* @__PURE__ */ jsx(EmptyState, { title: "No teachers found", message: "Create a teacher account to assign subjects and classes." }) }) : /* @__PURE__ */ jsx("section", { className: "panel staff-grid", children: teachers.map((teacher) => /* @__PURE__ */ jsxs("article", { className: "staff-card", children: [
      /* @__PURE__ */ jsx("div", { className: "staff-icon", children: /* @__PURE__ */ jsx(UserRound, { size: 20 }) }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("strong", { children: teacher.fullName }),
        /* @__PURE__ */ jsxs("span", { children: [
          teacher.employeeNo,
          " \xB7 ",
          teacher.user.email
        ] }),
        /* @__PURE__ */ jsx("small", { children: teacher.phone || "Phone not provided" })
      ] })
    ] }, teacher.id)) }),
    showForm && /* @__PURE__ */ jsx("div", { className: "modal-backdrop", children: /* @__PURE__ */ jsxs("div", { className: "modal-card", children: [
      /* @__PURE__ */ jsxs("div", { className: "modal-heading", children: [
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("div", { className: "eyebrow", children: "STAFF ACCOUNT" }),
          /* @__PURE__ */ jsx("h2", { children: "Add teacher" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button", onClick: () => setShowForm(false), children: "\xD7" })
      ] }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid", onSubmit: (event) => void createTeacher(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Full name *" }),
          /* @__PURE__ */ jsx("input", { name: "fullName", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Employee number *" }),
          /* @__PURE__ */ jsx("input", { name: "employeeNo", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Email *" }),
          /* @__PURE__ */ jsx("input", { name: "email", type: "email", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Phone" }),
          /* @__PURE__ */ jsx("input", { name: "phone" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Temporary password *" }),
          /* @__PURE__ */ jsx("input", { name: "password", type: "password", minLength: 12, required: true }),
          /* @__PURE__ */ jsx("small", { children: "Use at least 12 characters. Provide it to the teacher securely." })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "form-actions", children: [
          /* @__PURE__ */ jsx("button", { type: "button", className: "button button-quiet", onClick: () => setShowForm(false), children: "Cancel" }),
          /* @__PURE__ */ jsx("button", { className: "button button-primary", disabled: busy, children: busy ? "Creating..." : "Create account" })
        ] })
      ] })
    ] }) })
  ] });
}
export {
  TeachersPage as default
};
