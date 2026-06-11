import Link from "next/link";

import FitScoreBadge from "./FitScoreBadge";
import type { ApplicationRow } from "../lib/dashboard-data";
import { timeAgo } from "../lib/format";
import { priorityClass, stageClass } from "../lib/style-utils";

type PeekPanelProps = {
  application: ApplicationRow;
  closeHref: string;
};

export default function PeekPanel({ application, closeHref }: PeekPanelProps) {
  return (
    <aside className="peek-panel" aria-label={`${application.company} preview`}>
      <div className="peek-head">
        <div>
          <h2>{application.company}</h2>
          {application.role ? <p className="muted">{application.role}</p> : null}
        </div>
        <Link aria-label="Close preview" className="peek-close" href={closeHref} scroll={false}>
          ×
        </Link>
      </div>

      <div className="chip-row">
        <span className={`stage-pill ${stageClass(application.stage)}`}>
          {application.stage}
        </span>
        {application.priority ? (
          <span className={`priority-pill ${priorityClass(application.priority)}`}>
            {application.priority}
          </span>
        ) : null}
        <FitScoreBadge score={application.fit_score} />
      </div>

      {application.next_action || application.follow_up_on ? (
        <div className="peek-next">
          <p className="peek-label">Next action</p>
          <p className="peek-text">
            {application.next_action ?? "Follow up"}
            {application.follow_up_on ? ` · by ${application.follow_up_on}` : ""}
          </p>
        </div>
      ) : null}

      {application.fit_summary ? (
        <div className="peek-section">
          <p className="peek-label">Fit verdict</p>
          <p className="peek-text">{application.fit_summary}</p>
          {application.missing_keywords.length ? (
            <span className="chip-row">
              {application.missing_keywords.slice(0, 6).map((keyword) => (
                <span className="tag-chip" key={keyword}>
                  {keyword}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="peek-section">
        <p className="peek-label">Details</p>
        <dl className="peek-details">
          <div>
            <dt>Salary</dt>
            <dd>{application.salary || "Not set"}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{application.location || "Not set"}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{application.source || "Not set"}</dd>
          </div>
          <div>
            <dt>Last activity</dt>
            <dd>{timeAgo(application.last_activity)}</dd>
          </div>
        </dl>
      </div>

      {application.notes ? (
        <div className="peek-section">
          <p className="peek-label">Notes</p>
          <p className="peek-text">{application.notes}</p>
        </div>
      ) : null}

      <div className="peek-footer">
        <Link className="primary-button" href={`/applications/${application.id}`}>
          Open full page
        </Link>
        {application.url ? (
          <a className="secondary-link" href={application.url} target="_blank" rel="noreferrer">
            Posting
          </a>
        ) : null}
      </div>
    </aside>
  );
}
