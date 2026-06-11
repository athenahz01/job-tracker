import Link from "next/link";
import type { ReactNode } from "react";

import type { DashboardView } from "../lib/table-utils";

type NavItem = {
  view: DashboardView;
  label: string;
  badge?: number;
  badgeTone?: "danger";
  match?: DashboardView[];
};

type NavGroup = {
  label: string | null;
  items: NavItem[];
};

type SidebarProps = {
  view: DashboardView;
  followUpsDue: number;
  children?: ReactNode;
};

export default function Sidebar({ view, followUpsDue, children }: SidebarProps) {
  const groups: NavGroup[] = [
    { label: null, items: [{ view: "today", label: "Today" }] },
    {
      label: "Pipeline",
      items: [
        {
          view: "table",
          label: "Applications",
          match: ["table", "board", "flow"]
        },
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
      {children}
      <nav className="sidebar-nav" aria-label="Dashboard views">
        {groups.map((group) => (
          <div className="sidebar-group" key={group.label ?? "main"}>
            {group.label ? <p className="sidebar-group-label">{group.label}</p> : null}
            {group.items.map((item) => {
              const isActive = item.match ? item.match.includes(view) : view === item.view;
              return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`sidebar-link${isActive ? " active" : ""}`}
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
              );
            })}
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
