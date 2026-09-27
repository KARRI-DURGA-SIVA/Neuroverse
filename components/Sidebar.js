import Link from "next/link";
import { useRouter } from "next/router";

const NAV_GROUPS = [
  { label: "", items: [
    { href: "/dashboard", label: "Home", icon: "grid" },
    { href: "/explore", label: "Explore", icon: "compass" },
    { href: "/courses", label: "Courses", icon: "book" },
    { href: "/teach", label: "Teach", icon: "mic" },
    { href: "/my-learning", label: "Sessions", icon: "calendar" },
    { href: "/mentoring", label: "Community", icon: "users" },
  ] },
  { label: "", items: [
    { href: "/wallet", label: "Credits", icon: "wallet" },
    { href: "/profile", label: "Reputation", icon: "star" },
    { href: "/messages", label: "Messages", icon: "chat" },
  ] },
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
  calendar: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/><path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/><path d="M8 14h3M8 17h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
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
  star: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></svg>
  ),
  user: (p) => (
    <svg {...p} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6"/><path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
};

export default function Sidebar({ user }) {
  const router = useRouter();
  return (
    <aside className="sticky top-16 flex h-[calc(100vh-64px)] w-14 shrink-0 flex-col border-r border-[#e6e9f0] bg-white lg:w-[208px]">
      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-5 lg:px-3">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className={groupIndex ? "border-t border-[#edf0f5] pt-4" : ""}>
            {group.label && <p className="hidden px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#a1a8b7] lg:block">{group.label}</p>}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = router.pathname === item.href;
                const Icon = ICONS[item.icon];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-center gap-3 rounded-lg px-2 py-2.5 text-[13px] font-medium transition-colors lg:justify-start lg:px-3 ${active ? "bg-[#f0efff] text-[#5149e8]" : "text-[#68738a] hover:bg-[#f7f8fb] hover:text-[#35415b]"}`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" width={18} height={18} />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <Link href="/profile" className="flex items-center justify-center gap-2 border-t border-[#edf0f5] px-2 py-3 lg:justify-start lg:px-3" title={user?.name || "Profile"}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#e9e7ff] text-xs font-semibold text-[#5149e8]">
          {user?.profile_pic ? <img src={user.profile_pic} alt="" className="h-full w-full object-cover" /> : (user?.name || "U").slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden min-w-0 lg:block"><span className="block truncate text-xs font-semibold text-[#39445c]">{user?.name}</span><span className="block truncate text-[10px] text-[#929bae]">Your profile</span></span>
      </Link>
    </aside>
  );
}
