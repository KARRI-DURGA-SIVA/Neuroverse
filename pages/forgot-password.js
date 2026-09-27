import { useState } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setResetUrl("");
    try {
      const result = await apiFetch("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) });
      setMessage(result.message);
      setResetUrl(result.resetUrl || "");
    } catch (err) {
      setMessage(err.message || "Could not prepare the reset link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-9 h-9 rounded-lg bg-accent-500 flex items-center justify-center text-white font-bold">N</div>
          <span className="font-semibold text-xl text-ink-900 tracking-tight">NeuroVerse</span>
        </div>
        <div className="card p-8">
          <h1 className="text-lg font-semibold text-ink-900 mb-1">Reset your password</h1>
          <p className="text-sm text-ink-500 mb-6">Enter your account email and we will prepare a secure reset link.</p>
          <form onSubmit={submit} className="space-y-4">
            <input className="input-field" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <button className="btn-primary w-full" disabled={loading}>{loading ? "Preparing..." : "Send reset link"}</button>
          </form>
          {message && <p className="mt-4 text-sm text-ink-600">{message}</p>}
          {resetUrl && <Link href={resetUrl} className="mt-3 block break-all text-sm font-medium text-accent-600">Open reset link</Link>}
          <Link href="/login" className="mt-6 block text-center text-sm text-accent-600">Back to login</Link>
        </div>
      </div>
    </div>
  );
}