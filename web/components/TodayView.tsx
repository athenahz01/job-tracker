import Link from "next/link";

import type { ApplicationRow, FollowUpItem } from "../lib/dashboard-data";
import { timeAgo } from "../lib/format";
import { stageClass } from "../lib/style-utils";

const staleAfterDays = 10;
const recentWindowHours = 48;

export type TodayData = {
  dueFollowUps: FollowUpItem[];
  staleSaved: ApplicationRow[];
  recentUpdates: ApplicationRow[];
  itemCount: number;
};

export function buildTodayData(
  applications: ApplicationRow[],
  followUps: FollowUpItem[]
): TodayData {
  const now = Date.now();

  const dueFollowUps = followUps.slice(0, 6);
  const staleSaved = applications.filter(
    (application) =>
      application.stage === "Saved" &&
      now - (Date.parse(application.last_activity) || now) > staleAfterDays * 86400000
  );
  const followUpIds = new Set(dueFollowUps.map((item) => item.id));
  const recentUpdates = applications
    .filter(
      (application) =>
        application.stage !== "Saved" &&
        !followUpIds.has(application.id) &&
        now - (Date.parse(application.last_activity) || 0) < recentWindowHours * 3600000
    )
    .slice(0, 4);

  return {
    dueFollowUps,
    staleSaved,
    recentUpdates,
    itemCount: dueFollowUps.length + recentUpdates.length + (staleSaved.length ? 1 : 0)
  };
}

export default function TodayView({ data }: { data: TodayData }) {
  return (
    <section className="today-view" aria-label="Needs attention">
      <div className="today-header">
        <h2>Needs attention</h2>
        <p>
          {data.itemCount === 0
            ? "All clear"
            : `${data.itemCount} item${data.itemCount === 1 ? "" : "s"}`}
        </p>
      </div>
      {data.itemCount === 0 ? (
        <p className="empty-state">
          Nothing needs you right now. Save a new job from the extension, or review the board.
        </p>
      ) : (
        <div className="today-list">
          {data.dueFollowUps.map((item) => (
            <Link className="today-row" href={item.href} key={`${item.kind}-${item.id}`}>
              <span
                className={`today-row-dot${item.overdueDays > 0 ? " overdue" : ""}`}
                aria-hidden="true"
              />
              <span className="today-row-body">
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </span>
              <span className="today-row-meta">
                {item.overdueDays > 0 ? `${item.overdueDays}d overdue` : "Due now"}
              </span>
            </Link>
          ))}
          {data.recentUpdates.map((application) => (
            <Link
              className="today-row"
              href={`/applications/${application.id}`}
              key={application.id}
            >
              <span className="today-row-dot" aria-hidden="true" />
              <span className="today-row-body">
                <strong>
                  {application.company}
                  {application.role ? ` · ${application.role}` : ""}
                </strong>
                <span>Recent activity — review the latest update</span>
              </span>
              <span className="today-row-meta">
                <span className={`stage-pill ${stageClass(application.stage)}`}>
                  {application.stage}
                </span>
                {timeAgo(application.last_activity)}
              </span>
            </Link>
          ))}
          {data.staleSaved.length ? (
            <Link className="today-row" href="/?view=table&stage=Saved">
              <span className="today-row-dot muted" aria-hidden="true" />
              <span className="today-row-body">
                <strong>
                  {data.staleSaved.length} saved job
                  {data.staleSaved.length === 1 ? " is" : "s are"} going stale
                </strong>
                <span>
                  Saved over {staleAfterDays} days ago and never applied — apply or archive
                </span>
              </span>
              <span className="today-row-meta">Triage</span>
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
