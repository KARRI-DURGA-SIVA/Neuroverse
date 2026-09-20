import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
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
    return <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">Loading NeuroVerse...</div>;
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} />
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          {typeof children === "function" ? children({ user, setUser }) : children}
        </main>
      </div>
    </div>
  );
}
