import { useState } from "react";
import { GraduationCap, KeyRound, LockKeyhole, School, UserPlus } from "lucide-react";
import { api } from "../lib/api";

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [role, setRole] = useState("STUDENT");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "login") {
        const result = await api("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        onLogin(result.user);
      } else if (mode === "signup") {
        const role = String(form.get("role"));
        await api("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
            fullName: form.get("fullName"),
            role,
            ...(role === "TEACHER" ? { employeeNo: form.get("employeeNo") } : {}),
            ...(role === "STUDENT" ? { admissionNo: form.get("admissionNo") } : {}),
            phone: form.get("phone") || undefined
          })
        });
        setNotice("Signup request received. An administrator must approve your account before you can sign in.");
        setMode("login");
        setPassword("");
      } else {
        const result = await api("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email })
        });
        setNotice(result.message);
        setMode("login");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The request could not be completed");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  return (
    <main className="login-page">
      <div className="login-decoration decoration-one" />
      <div className="login-decoration decoration-two" />
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><School size={23} /></div>
          <div><strong>Classroom</strong><span>School management portal</span></div>
        </div>
        <div className="login-welcome">
          <div className="eyebrow">{isSignup ? "REQUEST AN ACCOUNT" : isForgot ? "ACCOUNT RECOVERY" : "WELCOME BACK"}</div>
          <h1>{isSignup ? "Join your school." : isForgot ? "Reset your password." : <>Learning starts<br />with a better view.</>}</h1>
          <p>
            {isSignup
              ? "Send an account request to your school administrator for approval."
              : isForgot
                ? "Password resets are reviewed by a school administrator."
                : "Sign in to manage your school, assessments, and results."}
          </p>
        </div>
        <form className="login-form" onSubmit={(event) => void submit(event)}>
          {error && <div className="error-banner" role="alert">{error}</div>}
          {notice && <div className="success-banner" role="status">{notice}</div>}
          {isSignup && <>
            <label className="field"><span>Full name</span><input name="fullName" autoComplete="name" required minLength={2} maxLength={120} /></label>
            <label className="field"><span>Account type</span>
              <select name="role" value={role} onChange={(event) => { setRole(event.target.value); setError(""); }}>
                <option value="STUDENT">Student</option>
                <option value="TEACHER">Teacher</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
            <RoleFields role={role} />
            <label className="field"><span>Phone (optional)</span><input name="phone" autoComplete="tel" maxLength={30} /></label>
          </>}
          <label className="field"><span>Email address</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@school.edu" required /></label>
          {!isForgot && <label className="field"><span>Password</span><input type="password" autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isSignup ? "At least 12 characters" : "Enter your password"} required minLength={isSignup ? 12 : undefined} maxLength={128} /></label>}
          <button className="button button-primary login-submit" disabled={loading}>
            {loading ? <span className="spinner spinner-white" /> : isSignup ? <UserPlus size={16} /> : isForgot ? <KeyRound size={16} /> : <LockKeyhole size={16} />}
            {loading ? "Please wait..." : isSignup ? "Request account" : isForgot ? "Request password reset" : "Sign in to portal"}
          </button>
        </form>
        <div className="auth-links">
          {mode === "login" && <>
            <button type="button" onClick={() => { setMode("forgot"); setError(""); setNotice(""); }}>Forgot password?</button>
            <span>·</span>
            <button type="button" onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create account</button>
          </>}
          {(isSignup || isForgot) && <button type="button" onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Back to sign in</button>}
        </div>
        <div className="login-footer"><GraduationCap size={16} /> A connected school community</div>
      </section>
      <div className="login-caption">SECURE SCHOOL MANAGEMENT</div>
    </main>
  );
}

function RoleFields({ role }) {
  return (
    <>
      {role === "STUDENT" && <label className="field"><span>Admission number</span><input name="admissionNo" required maxLength={40} /></label>}
      {role === "TEACHER" && <label className="field"><span>Employee number</span><input name="employeeNo" required maxLength={40} /></label>}
    </>
  );
}
