import Link from "next/link";

import type { DashboardView } from "../lib/table-utils";

type NavItem = {
  view: DashboardView;
  label: string;
  badge?: number;
  badgeTone?: "danger";
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

type SidebarProps = {
  view: DashboardView;
  followUpsDue: number;
};

export default function Sidebar({ view, followUpsDue }: SidebarProps) {
  const groups: NavGroup[] = [
    { label: null, items: [{ view: "today", label: "Today" }] },
    {
      label: "Pipeline",
      items: [
        { view: "table", label: "Applications" },
        { view: "board", label: "Board" },
        { view: "flow", label: "Flow" },
        {
          view: "follow-ups",
          label: "Follow-ups",
          badge: followUpsDue,
          badgeTone: "danger"
        }
      ]
    },
    {
      label: "Intelligence",
      items: [
        { view: "insights", label: "Insights" },
        { view: "performance", label: "Performance" },
        { view: "assistant", label: "Assistant" }
      ]
    },
    { label: "People", items: [{ view: "network", label: "Network" }] }
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-glyph" aria-hidden="true">JT</span>
        <strong>Job Tracker</strong>
      </div>
      <nav className="sidebar-nav" aria-label="Dashboard views">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label ?? "main"}>
            {group.label ? <p className="sidebar-group-label">{group.label}</p> : null}
            {group.items.map((item) => (
              <Link
                aria-current={view === item.view ? "page" : undefined}
                className={`sidebar-link${view === item.view ? " active" : ""}`}
                href={viewHref(item.view)}
                key={item.view}
              >
                {item.label}
                {item.badge ? (
                  <span
                    className={`sidebar-badge${item.badgeTone === "danger" ? " danger" : ""}`}
                  >
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        <Link
          aria-current={view === "profile" ? "page" : undefined}
          className={`sidebar-link${view === "profile" ? " active" : ""}`}
          href={viewHref("profile")}
        >
          Profile &amp; resume
        </Link>
      </div>
    </aside>
  );
}

function viewHref(view: DashboardView) {
  return view === "today" ? "/" : `/?view=${view}`;
}
