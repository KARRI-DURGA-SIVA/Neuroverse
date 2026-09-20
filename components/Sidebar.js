import Link from "next/link";
import { useRouter } from "next/router";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "grid" },
  { href: "/explore", label: "Explore Skills", icon: "compass" },
  { href: "/my-learning", label: "My Learning", icon: "book" },
  { href: "/teach", label: "Teach", icon: "mic" },
  { href: "/mentoring", label: "Mentoring", icon: "users" },
  { href: "/messages", label: "Messages", icon: "chat" },
  { href: "/wallet", label: "Wallet", icon: "wallet" },
  { href: "/profile", label: "Profile", icon: "user" },
];

const ICONS = {
  grid: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6"/></svg>
  ),
  compass: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="M15 9l-2 5-5 2 2-5 5-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
  ),
  book: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><path d="M4 5.5A2.5 2.5 0 016.5 3H20v15H6.5A2.5 2.5 0 004 15.5v-10z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M4 18.5A2.5 2.5 0 006.5 21H20" stroke="currentColor" strokeWidth="1.6"/></svg>
  ),
  mic: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6"/><path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  users: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><circle cx="17.5" cy="8.5" r="2.6" stroke="currentColor" strokeWidth="1.6"/><path d="M15.5 14.7c2.4.4 4 2.1 4.7 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  chat: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><path d="M4 5h16v11H8l-4 4V5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
  ),
  wallet: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="13" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M3 10h18M16 14.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  user: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
};

export default function Sidebar() {
  const router = useRouter();
  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 border-r border-gray-200 bg-white flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-accent-500 flex items-center justify-center text-white font-bold text-sm">N</div>
        <span className="font-semibold text-ink-900 text-[15px] tracking-tight">NeuroVerse</span>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = router.pathname === item.href;
          const Icon = ICONS[item.icon];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-accent-50 text-accent-700"
                  : "text-ink-700 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-4.5 h-4.5 ${active ? "text-accent-600" : "text-ink-500"}`} width={18} height={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-100 text-xs text-ink-500">
        © {new Date().getFullYear()} NeuroVerse
      </div>
    </aside>
  );
}
