import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";

export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmation) return setMessage("Passwords do not match.");
    setLoading(true);
    setMessage("");
    try {
      const result = await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token: router.query.token, password }) });
      setMessage(result.message);
    } catch (err) {
      setMessage(err.message || "Could not reset your password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm card p-8">
        <h1 className="text-lg font-semibold text-ink-900 mb-1">Choose a new password</h1>
        <p className="text-sm text-ink-500 mb-6">Use at least 8 characters.</p>
        <form onSubmit={submit} className="space-y-4">
          <input className="input-field" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" />
          <input className="input-field" type="password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Confirm password" />
          <button className="btn-primary w-full" disabled={loading || !router.query.token}>{loading ? "Updating..." : "Update password"}</button>
        </form>
        {message && <p className="mt-4 text-sm text-ink-600">{message}</p>}
        <Link href="/login" className="mt-6 block text-center text-sm text-accent-600">Back to login</Link>
      </div>
    </div>
  );
}