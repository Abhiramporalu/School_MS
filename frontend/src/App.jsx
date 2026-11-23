import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "./lib/api";
import { Frame } from "./components/Frame";
import AuthScreen from "./components/AuthScreen";
import AdminRequests from "./components/AdminRequests";

const DashboardPage = lazy(() => import("./pages/Dashboard"));
const StudentsPage = lazy(() => import("./pages/Students"));
const ClassesPage = lazy(() => import("./pages/Classes"));
const SubjectsPage = lazy(() => import("./pages/Subjects"));
const TeachersPage = lazy(() => import("./pages/Teachers"));
const ExamsPage = lazy(() => import("./pages/Exams"));
const MarksPage = lazy(() => import("./pages/Marks"));
const ResultsPage = lazy(() => import("./pages/Results"));
const SettingsPage = lazy(() => import("./pages/Settings"));

export default function App() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api("/auth/me")
      .then((response) => setUser(response.user))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setPage("dashboard");
    }
  }

  if (checking) return <div className="startup-loading"><span className="spinner" /><span>Opening your school workspace...</span></div>;
  if (!user) return <AuthScreen onLogin={setUser} />;

  return (
    <Frame user={user} page={page} onNavigate={setPage} onLogout={() => void logout()}>
      <Suspense fallback={<div className="loading-state"><span className="spinner" /> Loading page...</div>}>
        {page === "dashboard" && <DashboardPage user={user} />}
        {page === "students" && <StudentsPage isAdmin={user.role === "ADMIN"} />}
        {page === "classes" && <ClassesPage isAdmin={user.role === "ADMIN"} />}
        {page === "subjects" && <SubjectsPage isAdmin={user.role === "ADMIN"} />}
        {page === "teachers" && <><AdminRequests /><TeachersPage /></>}
        {page === "exams" && <ExamsPage isAdmin={user.role === "ADMIN"} teacherId={user.role === "TEACHER" ? user.profileId ?? undefined : undefined} />}
        {page === "marks" && <MarksPage />}
        {page === "results" && <ResultsPage isTeacher={user.role === "TEACHER"} />}
        {page === "settings" && <SettingsPage />}
      </Suspense>
    </Frame>
  );
}
