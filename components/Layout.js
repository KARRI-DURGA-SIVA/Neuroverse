import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import AIAssistant from "./AIAssistant";
import { apiFetch } from "../lib/api-client";

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7fb] px-6">
        <div className="mx-auto flex min-h-screen max-w-[1440px] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 px-5 py-3 shadow-[0_18px_48px_rgba(20,30,70,0.08)] backdrop-blur-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-violet-500" aria-hidden="true" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-600">Loading NeuroVerse</span>
          </div>
        </div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#f8f9fc]">
      <Topbar user={user} />
      <div className="flex min-h-[calc(100vh-64px)]">
        <Sidebar user={user} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-7">
          <div className="mx-auto w-full max-w-[1500px]">
            {typeof children === "function" ? children({ user, setUser }) : children}
          </div>
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}
