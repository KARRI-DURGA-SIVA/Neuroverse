import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
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
          <h1 className="text-lg font-semibold text-ink-900 mb-1">Welcome back</h1>
          <p className="text-sm text-ink-500 mb-6">Log in to continue learning and teaching.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input-field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input-field" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="text-sm text-ink-500 text-center mt-6">
            New to NeuroVerse?{" "}
            <Link href="/signup" className="text-accent-600 font-medium">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
