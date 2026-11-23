import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import {
  BookOpen,
  ChartNoAxesCombined,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookTabs,
  School,
  Settings,
  Users,
  X
} from "lucide-react";
import { getInitials } from "../lib/display";
const navigation = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard, roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { key: "students", label: "Students", icon: Users, roles: ["ADMIN", "TEACHER"] },
  { key: "classes", label: "Classes", icon: School, roles: ["ADMIN", "TEACHER"] },
  { key: "subjects", label: "Subjects", icon: BookOpen, roles: ["ADMIN", "TEACHER"] },
  { key: "exams", label: "Examinations", icon: NotebookTabs, roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { key: "marks", label: "Marks entry", icon: GraduationCap, roles: ["ADMIN", "TEACHER"] },
  { key: "results", label: "Results & reports", icon: ChartNoAxesCombined, roles: ["ADMIN", "TEACHER", "STUDENT"] },
  { key: "teachers", label: "Teaching staff", icon: Users, roles: ["ADMIN"] },
  { key: "settings", label: "School settings", icon: Settings, roles: ["ADMIN"] }
];
function Frame({
  user,
  page,
  onNavigate,
  onLogout,
  children
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = navigation.find((item) => item.key === page)?.label ?? "Overview";
  return /* @__PURE__ */ jsxs("div", { className: "app-shell", children: [
    open && /* @__PURE__ */ jsx("button", { className: "mobile-backdrop", onClick: () => setOpen(false), "aria-label": "Close menu" }),
    /* @__PURE__ */ jsxs("aside", { className: `sidebar ${open ? "sidebar-open" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "brand", children: [
        /* @__PURE__ */ jsx("div", { className: "brand-mark", children: /* @__PURE__ */ jsx(School, { size: 22 }) }),
        /* @__PURE__ */ jsxs("div", { children: [
          /* @__PURE__ */ jsx("strong", { children: "Classroom" }),
          /* @__PURE__ */ jsx("small", { children: "School portal" })
        ] }),
        /* @__PURE__ */ jsx("button", { className: "icon-button mobile-close", onClick: () => setOpen(false), "aria-label": "Close navigation", children: /* @__PURE__ */ jsx(X, { size: 18 }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "nav-caption", children: "WORKSPACE" }),
      /* @__PURE__ */ jsx("nav", { className: "nav-list", "aria-label": "Main navigation", children: navigation.filter((item) => item.roles.includes(user.role)).map(({ key, label, icon: Icon }) => /* @__PURE__ */ jsxs("button", { className: `nav-item ${page === key ? "active" : ""}`, onClick: () => {
        onNavigate(key);
        setOpen(false);
      }, children: [
        /* @__PURE__ */ jsx(Icon, { size: 18, strokeWidth: 1.9 }),
        /* @__PURE__ */ jsx("span", { children: label })
      ] }, key)) }),
      /* @__PURE__ */ jsxs("div", { className: "sidebar-bottom", children: [
        /* @__PURE__ */ jsxs("div", { className: "school-note", children: [
          /* @__PURE__ */ jsx("span", { className: "online-dot" }),
          /* @__PURE__ */ jsxs("span", { children: [
            "Academic year",
            /* @__PURE__ */ jsx("br", {}),
            /* @__PURE__ */ jsx("strong", { children: "School workspace" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "profile-block", children: [
          /* @__PURE__ */ jsx("div", { className: "avatar", children: getInitials(user.fullName) }),
          /* @__PURE__ */ jsxs("div", { className: "profile-text", children: [
            /* @__PURE__ */ jsx("strong", { children: user.fullName }),
            /* @__PURE__ */ jsx("span", { children: user.role.toLowerCase() })
          ] }),
          /* @__PURE__ */ jsx("button", { className: "icon-button logout-button", onClick: onLogout, "aria-label": "Sign out", title: "Sign out", children: /* @__PURE__ */ jsx(LogOut, { size: 17 }) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "main-shell", children: [
      /* @__PURE__ */ jsxs("header", { className: "topbar", children: [
        /* @__PURE__ */ jsx("button", { className: "icon-button menu-button", onClick: () => setOpen(true), "aria-label": "Open navigation", children: /* @__PURE__ */ jsx(Menu, { size: 21 }) }),
        /* @__PURE__ */ jsxs("div", { className: "breadcrumb", children: [
          /* @__PURE__ */ jsx("span", { children: "School" }),
          /* @__PURE__ */ jsx("span", { className: "crumb-slash", children: "/" }),
          /* @__PURE__ */ jsx("strong", { children: currentLabel })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "topbar-right", children: [
          /* @__PURE__ */ jsx("span", { className: "today-label", children: (/* @__PURE__ */ new Date()).toLocaleDateString(void 0, { weekday: "short", month: "short", day: "numeric" }) }),
          /* @__PURE__ */ jsx("div", { className: "top-avatar", children: user.fullName[0]?.toUpperCase() })
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "page-content", children })
    ] })
  ] });
}
function PageHeading({ eyebrow, title, description, actions }) {
  return /* @__PURE__ */ jsxs("div", { className: "page-heading", children: [
    /* @__PURE__ */ jsxs("div", { children: [
      eyebrow && /* @__PURE__ */ jsx("div", { className: "eyebrow", children: eyebrow }),
      /* @__PURE__ */ jsx("h1", { children: title }),
      description && /* @__PURE__ */ jsx("p", { children: description })
    ] }),
    actions && /* @__PURE__ */ jsx("div", { className: "heading-actions", children: actions })
  ] });
}
function EmptyState({ title, message }) {
  return /* @__PURE__ */ jsxs("div", { className: "empty-state", children: [
    /* @__PURE__ */ jsx("div", { className: "empty-icon", children: /* @__PURE__ */ jsx(NotebookTabs, { size: 21 }) }),
    /* @__PURE__ */ jsx("strong", { children: title }),
    /* @__PURE__ */ jsx("p", { children: message })
  ] });
}
function LoadingState() {
  return /* @__PURE__ */ jsxs("div", { className: "loading-state", children: [
    /* @__PURE__ */ jsx("span", { className: "spinner" }),
    " Loading school data..."
  ] });
}
function ErrorBanner({ message }) {
  return message ? /* @__PURE__ */ jsx("div", { className: "error-banner", role: "alert", children: message }) : null;
}
export {
  EmptyState,
  ErrorBanner,
  Frame,
  LoadingState,
  PageHeading
};
