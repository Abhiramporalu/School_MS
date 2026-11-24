import { useEffect, useState } from "react";
import { Check, KeyRound, X } from "lucide-react";
import { api } from "../lib/api";
import { ErrorBanner, EmptyState } from "./Frame";

export default function AdminRequests() {
  const [registrations, setRegistrations] = useState([]);
  const [resets, setResets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [notice, setNotice] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError("");
    try {
      const [registrationData, resetData] = await Promise.all([
        api("/auth/admin/registration-requests"),
        api("/auth/admin/password-reset-requests")
      ]);
      setRegistrations(registrationData);
      setResets(resetData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load account requests");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refreshTimer = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(refreshTimer);
  }, []);

  async function reviewRegistration(request, action) {
    if (action === "reject" && !window.confirm(`Reject the signup request for ${request.email}?`)) return;
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      await api(`/auth/admin/registration-requests/${request.id}/${action}`, { method: "POST" });
      setNotice(action === "approve" ? `Approved ${request.fullName}'s ${request.requestedRole.toLowerCase()} account.` : "Signup request rejected.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not review signup request");
    } finally {
      setBusyId("");
    }
  }

  async function completeReset(request) {
    const action = request.requiresAccountCreation ? "Create a student login and set its password" : "Reset the password";
    if (!window.confirm(`${action} for ${request.email}? Verify their identity before sharing the temporary password.`)) return;
    setBusyId(request.id);
    setError("");
    setNotice("");
    setTemporaryPassword("");
    try {
      const result = await api(`/auth/admin/password-reset-requests/${request.id}/complete`, { method: "POST" });
      setTemporaryPassword(result.temporaryPassword);
      setNotice(`${result.accountCreated ? "Student login created. " : ""}${result.message}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not reset password");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="account-requests">
      <div className="account-requests-heading">
        <div><div className="eyebrow">ACCOUNT SUPPORT</div><h2>Sign-up & password requests</h2><p>Approve new sign-ups and assist with password resets. New requests refresh automatically.</p></div>
        <button className="button button-quiet" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </div>
      {error && <ErrorBanner message={error} />}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {temporaryPassword && <div className="temporary-password" role="status">
        <strong>Temporary password</strong><code>{temporaryPassword}</code>
        <span>Copy this now and share it with the verified requester through a trusted channel. It will not be shown again.</span>
      </div>}
      {loading ? <div className="loading-state"><span className="spinner" /> Loading account requests...</div> : (
        <div className="account-request-grid">
          <section className="panel account-request-panel">
            <div className="panel-heading"><div><h2>Sign-up requests</h2><p>New accounts remain inactive until approved.</p></div><span className="request-count">{registrations.length}</span></div>
            {!registrations.length ? <EmptyState title="No pending signup requests" message="New requests will appear here for review." /> : registrations.map((request) => (
              <article className="account-request-row" key={request.id}>
                <div className="account-request-details">
                  <strong>{request.fullName}</strong><span>{request.email}</span>
                  <small>{request.requestedRole}{request.employeeNo ? ` · Employee ${request.employeeNo}` : ""}{request.admissionNo ? ` · Admission ${request.admissionNo}` : ""}</small>
                </div>
                <div className="account-request-actions">
                  <button className="button button-small button-success" disabled={busyId === request.id} onClick={() => void reviewRegistration(request, "approve")}><Check size={14} /> Approve</button>
                  <button className="button button-small button-quiet" disabled={busyId === request.id} onClick={() => void reviewRegistration(request, "reject")}><X size={14} /> Reject</button>
                </div>
              </article>
            ))}
          </section>
          <section className="panel account-request-panel">
            <div className="panel-heading"><div><h2>Password reset requests</h2><p>Verify identity before giving a temporary password.</p></div><span className="request-count">{resets.length}</span></div>
            {!resets.length ? <EmptyState title="No pending reset requests" message="Password-help requests will appear here." /> : resets.map((request) => (
              <article className="account-request-row" key={request.id}>
                <div className="account-request-details">
                  <strong>{request.fullName}</strong><span>{request.email}</span>
                  <small>{request.role ?? "Account"} · {new Date(request.createdAt).toLocaleDateString()}</small>
                </div>
                <button className="button button-small button-primary" disabled={busyId === request.id || !request.role} onClick={() => void completeReset(request)}><KeyRound size={14} /> {request.requiresAccountCreation ? "Create login" : "Reset"}</button>
              </article>
            ))}
          </section>
        </div>
      )}
    </section>
  );
}
