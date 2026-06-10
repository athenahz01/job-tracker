import Link from "next/link";

import type { FollowUpItem } from "../lib/dashboard-data";
import { stageClass } from "../lib/style-utils";

type FollowUpsViewProps = {
  items: FollowUpItem[];
  quietDays: number;
};

export default function FollowUpsView({ items, quietDays }: FollowUpsViewProps) {
  const groups = groupFollowUps(items);

  return (
    <section className="followups-section" aria-labelledby="followups-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attention</p>
          <h2 id="followups-heading">Follow-ups</h2>
          <p className="muted">A daily list of applications and contacts that need a nudge.</p>
        </div>
        <span className="flow-count">{items.length} due</span>
      </div>

      {items.length ? (
        <div className="followup-list">
          {groups.map((group) =>
            group.items.length ? (
              <section className="followup-group" key={group.label}>
                <div className="followup-group-heading">
                  <h3>{group.label}</h3>
                  <span>{group.items.length}</span>
                </div>
                {group.items.map((item) => (
                  <Link
                    className={`followup-item ${item.overdueDays ? "followup-overdue" : ""}`}
                    href={item.href}
                    key={item.id}
                  >
                    <div>
                      <p className="followup-kind">{kindLabel(item.kind)}</p>
                      <h3>{item.title}</h3>
                      <p className="muted">{item.subtitle}</p>
                    </div>
                    <div className="followup-meta">
                      <span className={item.overdueDays ? "followup-date overdue" : "followup-date"}>
                        {item.dueOn}
                      </span>
                      <span>{item.overdueDays ? `${item.overdueDays} days overdue` : "Due today"}</span>
                      {item.stage ? (
                        <span className={`stage-pill ${stageClass(item.stage)}`}>{item.stage}</span>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </section>
            ) : null
          )}
        </div>
      ) : (
        <p className="empty-state">
          You are all caught up. Quiet active applications appear after {quietDays} days.
        </p>
      )}
    </section>
  );
}

function kindLabel(kind: FollowUpItem["kind"]) {
  if (kind === "application_due") {
    return "Application follow-up";
  }
  if (kind === "quiet_application") {
    return "Quiet application";
  }
  return "Contact follow-up";
}

function groupFollowUps(items: FollowUpItem[]) {
  return [
    {
      label: "Overdue",
      items: items.filter((item) => item.overdueDays > 0)
    },
    {
      label: "Due today",
      items: items.filter((item) => item.overdueDays === 0)
    },
    {
      label: "Upcoming",
      items: [] as FollowUpItem[]
    }
  ];
}
