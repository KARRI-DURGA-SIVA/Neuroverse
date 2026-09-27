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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#e6e9f0] bg-white px-4 sm:px-6">
      <Link href="/dashboard" className="flex h-full w-[190px] shrink-0 items-center gap-2.5 border-r border-[#edf0f5] pr-4 lg:w-[208px]">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#5149e8] text-sm font-bold text-white">N</span>
        <span className="text-[17px] font-semibold tracking-tight text-[#26324b]">NeuroVerse</span>
      </Link>
      <span className="hidden min-w-0 flex-1 text-xs text-[#7b8498] xl:block">Learn together. Teach together. Grow together.</span>
      <div className="relative mx-auto hidden w-full max-w-[320px] flex-1 md:block">
        <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8690a4]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          className="w-full rounded-full border border-[#edf0f5] bg-[#f7f8fb] py-2.5 pl-10 pr-3 text-xs text-[#35415b] outline-none transition-colors focus:border-[#aaa7ff] focus:bg-white"
          placeholder="Search courses, skills, people..."
          aria-label="Search courses, skills, and people"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
        <Link href="/wallet" className="hidden items-center gap-2 rounded-full border border-[#edf0f5] px-3 py-2 text-xs font-semibold text-[#39445c] sm:flex">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#fff2ca] text-[#e6a812]">●</span>
          {user?.credits ?? 0} Credits
        </Link>

        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[#68738a] hover:bg-[#f5f6fa]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 18a2 2 0 004 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#fa635f]" />}
          </button>
          {open && (
            <div className="card absolute right-0 z-30 mt-2 max-h-96 w-80 overflow-y-auto p-2">
              <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Notifications</div>
              {notifications.length === 0 && <div className="px-2 py-6 text-center text-sm text-ink-500">No notifications yet</div>}
              {notifications.map((n) => <div key={n.id} className={`rounded-lg px-2 py-2.5 text-sm ${n.is_read ? "text-ink-500" : "bg-accent-50 text-ink-900"}`}>{n.message}</div>)}
            </div>
          )}
        </div>

        <Link href="/profile" aria-label="Open profile" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#e9e7ff] text-sm font-semibold text-[#5149e8]">
            {user?.profile_pic ? <img src={user.profile_pic} alt={user.name} className="h-full w-full object-cover" /> : (user?.name || "U").slice(0, 1).toUpperCase()}
          </div>
          <svg className="hidden h-3.5 w-3.5 text-[#8690a4] sm:block" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </div>
    </header>
  );
}
