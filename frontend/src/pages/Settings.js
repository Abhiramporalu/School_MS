import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Save, School } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner, PageHeading } from "../components/Frame";
function SettingsPage() {
  const [profile, setProfile] = useState({ name: "", address: "", logoUrl: "", principalName: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [years, setYears] = useState([]);
  async function loadYears() {
    try {
      setYears(await api("/school/academic-years"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load academic years");
    }
  }
  useEffect(() => {
    Promise.all([
      api("/school/profile").then((data) => {
        if (data) setProfile(data);
      }),
      loadYears()
    ]).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load settings")).finally(() => setLoading(false));
  }, []);
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      setProfile(await api("/school/profile", { method: "PUT", body: JSON.stringify(profile) }));
      setNotice("School profile saved. Report cards will use these details.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save school profile");
    } finally {
      setSaving(false);
    }
  }
  async function createYear(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api("/school/academic-years", { method: "POST", body: JSON.stringify({
        name: form.get("yearName"),
        startsOn: form.get("startsOn"),
        endsOn: form.get("endsOn"),
        isCurrent: form.get("isCurrent") === "on"
      }) });
      setNotice("Academic year created");
      formElement.reset();
      await loadYears();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create academic year");
    } finally {
      setSaving(false);
    }
  }
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(PageHeading, { eyebrow: "ADMINISTRATION", title: "School settings", description: "Customize the school identity displayed on student reports." }),
    error && /* @__PURE__ */ jsx(ErrorBanner, { message: error }),
    notice && /* @__PURE__ */ jsxs("div", { className: "success-banner", children: [
      notice,
      /* @__PURE__ */ jsx("button", { onClick: () => setNotice(""), children: "Dismiss" })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "panel settings-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "settings-intro", children: [
        /* @__PURE__ */ jsx("div", { className: "settings-icon", children: /* @__PURE__ */ jsx(School, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: "School profile" }),
          /* @__PURE__ */ jsx("p", { children: "These details are shown on printable report cards." })
        ] })
      ] }),
      loading ? /* @__PURE__ */ jsx("div", { className: "loading-state", children: "Loading school profile..." }) : /* @__PURE__ */ jsxs("form", { className: "form-grid settings-form", onSubmit: (event) => void save(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "School name *" }),
          /* @__PURE__ */ jsx("input", { value: profile.name, onChange: (event) => setProfile({ ...profile, name: event.target.value }), required: true, minLength: 2, maxLength: 120 })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Principal name" }),
          /* @__PURE__ */ jsx("input", { value: profile.principalName ?? "", onChange: (event) => setProfile({ ...profile, principalName: event.target.value }), maxLength: 120 })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "School address" }),
          /* @__PURE__ */ jsx("input", { value: profile.address ?? "", onChange: (event) => setProfile({ ...profile, address: event.target.value }), maxLength: 300 })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field full-field", children: [
          /* @__PURE__ */ jsx("span", { children: "Logo image URL" }),
          /* @__PURE__ */ jsx("input", { type: "url", value: profile.logoUrl ?? "", onChange: (event) => setProfile({ ...profile, logoUrl: event.target.value }), placeholder: "https://school.example/logo.png" })
        ] }),
        profile.logoUrl && /* @__PURE__ */ jsxs("div", { className: "logo-preview full-field", children: [
          /* @__PURE__ */ jsx("img", { src: profile.logoUrl, alt: "School logo preview" }),
          /* @__PURE__ */ jsx("span", { children: "Logo preview" })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "form-actions", children: /* @__PURE__ */ jsxs("button", { className: "button button-primary", disabled: saving, children: [
          /* @__PURE__ */ jsx(Save, { size: 15 }),
          saving ? "Saving..." : "Save profile"
        ] }) })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { className: "panel settings-panel academic-years-panel", children: [
      /* @__PURE__ */ jsxs("div", { className: "settings-intro", children: [
        /* @__PURE__ */ jsx("div", { className: "settings-icon", children: /* @__PURE__ */ jsx(School, { size: 20 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("h2", { children: "Academic years" }),
          /* @__PURE__ */ jsx("p", { children: "Set the year used for classes, student enrollment, and examination records." })
        ] })
      ] }),
      years.length > 0 && /* @__PURE__ */ jsx("div", { className: "year-list", children: years.map((year) => /* @__PURE__ */ jsxs("div", { className: "year-row", children: [
        /* @__PURE__ */ jsx("strong", { children: year.name }),
        /* @__PURE__ */ jsxs("span", { children: [
          new Date(year.startsOn).toLocaleDateString(),
          " \u2013 ",
          new Date(year.endsOn).toLocaleDateString()
        ] }),
        year.isCurrent && /* @__PURE__ */ jsx("span", { className: "status-pill status-green", children: "current" })
      ] }, year.id)) }),
      /* @__PURE__ */ jsxs("form", { className: "form-grid settings-form", onSubmit: (event) => void createYear(event), children: [
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Academic year name *" }),
          /* @__PURE__ */ jsx("input", { name: "yearName", required: true, placeholder: "2027-2028" })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Starts on *" }),
          /* @__PURE__ */ jsx("input", { name: "startsOn", type: "date", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "field", children: [
          /* @__PURE__ */ jsx("span", { children: "Ends on *" }),
          /* @__PURE__ */ jsx("input", { name: "endsOn", type: "date", required: true })
        ] }),
        /* @__PURE__ */ jsxs("label", { className: "current-year-check", children: [
          /* @__PURE__ */ jsx("input", { name: "isCurrent", type: "checkbox" }),
          " Set as current academic year"
        ] }),
        /* @__PURE__ */ jsx("div", { className: "form-actions", children: /* @__PURE__ */ jsxs("button", { className: "button button-quiet", disabled: saving, children: [
          /* @__PURE__ */ jsx(Save, { size: 15 }),
          saving ? "Saving..." : "Add academic year"
        ] }) })
      ] })
    ] })
  ] });
}
export {
  SettingsPage as default
};
