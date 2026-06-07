import Link from "next/link";
import { notFound } from "next/navigation";

import MergeForm from "../../../components/MergeForm";
import {
  clearStageLockAction,
  setStageAction
} from "../../../lib/dashboard-actions";
import { getApplicationDetail } from "../../../lib/dashboard-data";
import { formatConfidence, formatDate, gmailUrl, timeAgo } from "../../../lib/format";
import { stages } from "../../../lib/stages";

export const dynamic = "force-dynamic";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationDetail({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const status = readSingle(query.status);
  const { application, events, mergeTargets } = await getApplicationDetail(id);

  if (!application) {
    notFound();
  }

  const isRecruiterOutreach = application.kind === "recruiter_outreach";

  return (
    <main className="detail-shell">
      <Link className="back-link" href="/">
        Back to board
      </Link>

      {status ? <p className="status-message">{statusMessage(status)}</p> : null}

      <section className={`detail-card ${isRecruiterOutreach ? "outreach-detail" : ""}`}>
        <div className="detail-header">
          <div>
            <p className="eyebrow">
              {isRecruiterOutreach ? "Recruiter outreach" : "Application"}
            </p>
            <h1>{application.company}</h1>
            {application.role ? <p className="detail-role">{application.role}</p> : null}
          </div>
          <div className="badge-row">
            <span className="badge">{application.stage}</span>
            {application.is_orphan ? <span className="badge">Orphan</span> : null}
            {application.stage_locked ? <span className="badge locked">Locked</span> : null}
          </div>
        </div>

        <dl className="detail-grid">
          <div>
            <dt>Last activity</dt>
            <dd>
              {formatDate(application.last_activity)}
              <span>{timeAgo(application.last_activity)}</span>
            </dd>
          </div>
          <div>
            <dt>First seen</dt>
            <dd>{formatDate(application.first_seen)}</dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>{application.source || "Not set"}</dd>
          </div>
          <div>
            <dt>Company domain</dt>
            <dd>{application.company_domain || "Not set"}</dd>
          </div>
          {application.url ? (
            <div>
              <dt>Posting</dt>
              <dd>
                <a href={application.url} target="_blank" rel="noreferrer">
                  Open posting
                </a>
              </dd>
            </div>
          ) : null}
          {application.notes ? (
            <div>
              <dt>Notes</dt>
              <dd>{application.notes}</dd>
            </div>
          ) : null}
        </dl>
      </section>

      {!isRecruiterOutreach ? (
        <section className="action-panel">
          <div>
            <h2>Manual Stage</h2>
            <p className="muted">
              Setting a stage by hand locks it so the worker will not move it automatically.
            </p>
          </div>
          <form action={setStageAction} className="form-row">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="field compact-field">
              <span>Stage</span>
              <select name="stage" defaultValue={application.stage}>
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" type="submit">
              Save and lock
            </button>
          </form>
          {application.stage_locked ? (
            <form action={clearStageLockAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <button className="secondary-button" type="submit">
                Clear lock
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      {application.is_orphan && application.kind === "application" ? (
        <section className="action-panel">
          <div>
            <h2>Merge Orphan</h2>
            <p className="muted">
              Move this orphan's email events into an existing application. Nothing is deleted.
            </p>
          </div>
          <MergeForm orphan={application} targets={mergeTargets} />
        </section>
      ) : null}

      <section className="timeline-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Email history</p>
            <h2>Timeline</h2>
          </div>
          <span>{events.length} events</span>
        </div>
        <div className="timeline">
          {events.length ? (
            events.map((event) => (
              <article className="timeline-item" key={event.id}>
                <div className="timeline-meta">
                  <span>{formatDate(event.received_at)}</span>
                  <a href={gmailUrl(event)} target="_blank" rel="noreferrer">
                    Open in Gmail
                  </a>
                </div>
                <h3>{event.subject || "No subject"}</h3>
                <p className="muted">{event.from_address || "Unknown sender"}</p>
                <div className="badge-row">
                  {event.detected_stage ? <span className="badge">{event.detected_stage}</span> : null}
                  <span className="badge">{formatConfidence(event.confidence)}</span>
                  {event.category ? <span className="badge">{event.category}</span> : null}
                </div>
                {event.summary ? <p>{event.summary}</p> : null}
              </article>
            ))
          ) : (
            <p className="empty-state">No email events are linked yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusMessage(status: string) {
  const messages: Record<string, string> = {
    stage_saved: "Stage saved and locked.",
    lock_cleared: "Automation lock cleared.",
    merged: "Orphan merged into this application.",
    invalid: "That request was not valid.",
    stage_error: "The stage could not be saved.",
    lock_error: "The lock could not be cleared.",
    merge_error: "The merge could not be completed."
  };

  return messages[status] ?? "Done.";
}
