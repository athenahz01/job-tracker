import Link from "next/link";

import type { FollowUpItem } from "../lib/dashboard-data";
import { stageClass } from "../lib/style-utils";

type FollowUpsViewProps = {
  items: FollowUpItem[];
  quietDays: number;
};

export default function FollowUpsView({ items, quietDays }: FollowUpsViewProps) {
  return (
    <section className="followups-section" aria-labelledby="followups-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Attention</p>
          <h2 id="followups-heading">Follow-ups</h2>
        </div>
        <span className="flow-count">{items.length} due</span>
      </div>

      {items.length ? (
        <div className="followup-list">
          {items.map((item) => (
            <Link className="followup-item" href={item.href} key={item.id}>
              <div>
                <p className="followup-kind">{kindLabel(item.kind)}</p>
                <h3>{item.title}</h3>
                <p className="muted">{item.subtitle}</p>
              </div>
              <div className="followup-meta">
                {item.stage ? (
                  <span className={`stage-pill ${stageClass(item.stage)}`}>{item.stage}</span>
                ) : null}
                <span>{item.overdueDays ? `${item.overdueDays} days overdue` : "Due today"}</span>
                <span>{item.dueOn}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          Nothing needs a nudge right now. Quiet active applications appear after {quietDays} days.
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
