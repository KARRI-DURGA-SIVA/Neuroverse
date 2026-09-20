import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { apiFetch } from "../lib/api-client";

export default function Topbar({ user }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    apiFetch("/api/notifications").then((d) => setNotifications(d.notifications || [])).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <header className="h-16 border-b border-gray-200 bg-white/90 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-6">
      <div className="flex-1 max-w-md">
        <div className="relative">
          <svg className="w-4 h-4 text-ink-500 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            className="w-full bg-ink-100/60 border border-transparent focus:border-accent-500 focus:bg-white rounded-lg pl-9 pr-3 py-2 text-sm outline-none transition-colors"
            placeholder="Search skills, mentors, courses..."
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 bg-accent-50 text-accent-700 rounded-full px-3 py-1.5 text-sm font-semibold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {user?.credits ?? 0} credits
        </div>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="relative w-9 h-9 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-80 card p-2 z-30 max-h-96 overflow-y-auto">
              <div className="px-2 py-1.5 text-xs font-semibold text-ink-500 uppercase tracking-wide">Notifications</div>
              {notifications.length === 0 && (
                <div className="px-2 py-6 text-sm text-ink-500 text-center">No notifications yet</div>
              )}
              {notifications.map((n) => (
                <div key={n.id} className={`px-2 py-2.5 rounded-lg text-sm ${n.is_read ? "text-ink-500" : "text-ink-900 bg-accent-50/50"}`}>
                  {n.message}
                </div>
              ))}
            </div>
          )}
        </div>

        <Link href="/profile" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-accent-100 text-accent-700 flex items-center justify-center font-semibold text-sm overflow-hidden">
            {user?.profile_pic ? (
              <img src={user.profile_pic} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              (user?.name || "U").slice(0, 1).toUpperCase()
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}
