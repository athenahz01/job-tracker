import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import ContactsSection from "../../../components/ContactsSection";
import DraftActionPanel from "../../../components/DraftActionPanel";
import FitScoreBadge from "../../../components/FitScoreBadge";
import MergeForm from "../../../components/MergeForm";
import {
  clearStageLockAction,
  renameCompanyAction,
  setStageAction,
  scoreApplicationFitAction,
  tailorApplicationAction,
  updateApplicationTrackerFieldsAction
} from "../../../lib/dashboard-actions";
import { getApplicationDetail } from "../../../lib/dashboard-data";
import { formatConfidence, formatDate, gmailUrl, timeAgo } from "../../../lib/format";
import { priorityClass, stageClass } from "../../../lib/style-utils";
import { stages } from "../../../lib/stages";
import { priorities } from "../../../lib/tracker";

export const dynamic = "force-dynamic";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ApplicationDetail({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const query = (await searchParams) ?? {};
  const status = readSingle(query.status);
  const { application, events, mergeTargets, contacts } = await getApplicationDetail(id);

  if (!application) {
    notFound();
  }

  const isRecruiterOutreach = application.kind === "recruiter_outreach";
  const applicationSummary = {
    id: application.id,
    company: application.company,
    role: application.role,
    stage: application.stage
  };

  return (
    <main className="detail-shell">
      <Link className="back-link" href="/">
        Back to dashboard
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
            <span className={`stage-pill ${stageClass(application.stage)}`}>
              {application.stage}
            </span>
            {application.priority ? (
              <span className={`priority-pill ${priorityClass(application.priority)}`}>
                {application.priority}
              </span>
            ) : null}
            {application.is_orphan ? <span className="badge">Orphan</span> : null}
            {application.stage_locked ? <span className="badge locked">Locked</span> : null}
          </div>
        </div>

        <details className="inline-editor company-rename-editor">
          <summary>Edit company name</summary>
          <form action={renameCompanyAction} className="form-row">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="field compact-field">
              <span>Company</span>
              <input name="company" defaultValue={application.company} required />
            </label>
            <button className="primary-button" type="submit">
              Save company
            </button>
          </form>
        </details>

        <dl className="detail-grid">
          <DetailValue label="Last activity">
            {formatDate(application.last_activity)}
            <span>{timeAgo(application.last_activity)}</span>
          </DetailValue>
          <DetailValue label="First seen">{formatDate(application.first_seen)}</DetailValue>
          <DetailValue label="Source">{application.source || "Not set"}</DetailValue>
          <DetailValue label="Fit">
            <FitScoreBadge score={application.fit_score} />
          </DetailValue>
          <DetailValue label="Company domain">
            {application.company_domain || "Not set"}
          </DetailValue>
          <DetailValue label="Next action">{application.next_action || "Not set"}</DetailValue>
          <DetailValue label="Follow-up">{application.follow_up_on || "Not set"}</DetailValue>
          <DetailValue label="Salary">{application.salary || "Not set"}</DetailValue>
          <DetailValue label="Location">{application.location || "Not set"}</DetailValue>
          <DetailValue label="Deadline">{application.deadline || "Not set"}</DetailValue>
          <DetailValue label="Resume">{application.resume_version || "Not set"}</DetailValue>
          <DetailValue label="Tags">
            <span className="chip-row">
              {application.tags.length ? (
                application.tags.map((tag) => (
                  <span className="tag-chip" key={tag}>
                    {tag}
                  </span>
                ))
              ) : (
                "No tags"
              )}
            </span>
          </DetailValue>
          {application.url ? (
            <DetailValue label="Posting">
              <a href={application.url} target="_blank" rel="noreferrer">
                Open posting
              </a>
            </DetailValue>
          ) : null}
          {application.notes ? <DetailValue label="Notes">{application.notes}</DetailValue> : null}
        </dl>
      </section>

      {!isRecruiterOutreach ? (
        <section className="action-panel ai-action-panel">
          <div className="section-heading ai-heading">
            <div>
              <p className="eyebrow">Outreach</p>
              <h2>Draft Helpers</h2>
              <p className="muted">Suggestions only. Review and copy before sending.</p>
            </div>
          </div>
          <div className="draft-helper-grid">
            <DraftActionPanel
              kind="follow-up"
              label="Draft follow-up"
              description="Short email based on this application stage and activity."
              applicationId={application.id}
            />
            <DraftActionPanel
              kind="cold-outreach"
              label="Who to reach out to"
              description="Suggests a contact type and drafts a short cold message."
              applicationId={application.id}
            />
          </div>
        </section>
      ) : null}

      {!isRecruiterOutreach ? (
        <section className="action-panel ai-action-panel">
          <div className="section-heading ai-heading">
            <div>
              <p className="eyebrow">Resume match</p>
              <h2>Fit Score</h2>
            </div>
            <form action={scoreApplicationFitAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <button className="primary-button" type="submit">
                Score fit
              </button>
            </form>
          </div>
          <dl className="ai-result-grid">
            <div>
              <dt>Score</dt>
              <dd>
                <FitScoreBadge score={application.fit_score} />
                {application.scored_at ? (
                  <span className="muted">Scored {formatDate(application.scored_at)}</span>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Verdict</dt>
              <dd>{application.fit_summary || "Not scored yet."}</dd>
            </div>
            <div>
              <dt>Gaps to close</dt>
              <dd>
                <span className="chip-row">
                  {application.missing_keywords.length ? (
                    application.missing_keywords.map((keyword) => (
                      <span className="tag-chip" key={keyword}>
                        {keyword}
                      </span>
                    ))
                  ) : (
                    <span className="muted">None saved</span>
                  )}
                </span>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {!isRecruiterOutreach ? (
        <section className="action-panel ai-action-panel">
          <div className="section-heading ai-heading">
            <div>
              <p className="eyebrow">Drafts</p>
              <h2>Tailoring</h2>
              <p className="muted">Drafts to adapt before using.</p>
            </div>
            <form action={tailorApplicationAction}>
              <input type="hidden" name="applicationId" value={application.id} />
              <button className="primary-button" type="submit">
                Generate tailoring
              </button>
            </form>
          </div>
          <div className="draft-grid">
            <label className="field wide-field">
              <span>Resume bullets</span>
              <textarea
                readOnly
                rows={Math.max(5, application.ai_tailored_bullets.length + 1)}
                defaultValue={
                  application.ai_tailored_bullets.length
                    ? application.ai_tailored_bullets.map((bullet) => `- ${bullet}`).join("\n")
                    : ""
                }
                placeholder="No tailoring bullets saved yet."
              />
            </label>
            <label className="field wide-field">
              <span>Cover letter draft</span>
              <textarea
                readOnly
                rows={8}
                defaultValue={application.ai_cover_letter ?? ""}
                placeholder="No cover letter draft saved yet."
              />
            </label>
            {application.tailored_at ? (
              <p className="muted">Generated {formatDate(application.tailored_at)}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {!isRecruiterOutreach ? (
        <section className="action-panel tracker-editor">
          <div>
            <h2>Tracker Fields</h2>
            <p className="muted">Manual notes for planning, follow-ups, and search context.</p>
          </div>
          <form action={updateApplicationTrackerFieldsAction} className="tracker-form">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="field">
              <span>Next action</span>
              <input name="nextAction" defaultValue={application.next_action ?? ""} />
            </label>
            <label className="field">
              <span>Follow-up date</span>
              <input name="followUpOn" type="date" defaultValue={application.follow_up_on ?? ""} />
            </label>
            <label className="field">
              <span>Salary</span>
              <input name="salary" defaultValue={application.salary ?? ""} />
            </label>
            <label className="field">
              <span>Location</span>
              <input name="location" defaultValue={application.location ?? ""} />
            </label>
            <label className="field">
              <span>Deadline</span>
              <input name="deadline" type="date" defaultValue={application.deadline ?? ""} />
            </label>
            <label className="field">
              <span>Priority</span>
              <select name="priority" defaultValue={application.priority ?? ""}>
                <option value="">None</option>
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tags</span>
              <input name="tags" defaultValue={application.tags.join(", ")} />
            </label>
            <label className="field">
              <span>Resume version</span>
              <input name="resumeVersion" defaultValue={application.resume_version ?? ""} />
            </label>
            <label className="field wide-field">
              <span>Notes</span>
              <textarea name="notes" defaultValue={application.notes ?? ""} rows={5} />
            </label>
            <button className="primary-button" type="submit">
              Save fields
            </button>
          </form>
        </section>
      ) : null}

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

      {!isRecruiterOutreach ? (
        <ContactsSection
          eyebrow="Network"
          title="Linked Contacts"
          contacts={contacts}
          applications={[applicationSummary]}
          returnTo={`/applications/${application.id}`}
          linkedApplicationId={application.id}
        />
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
                  {event.detected_stage ? (
                    <span className={`stage-pill ${stageClass(event.detected_stage)}`}>
                      {event.detected_stage}
                    </span>
                  ) : null}
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

function DetailValue({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
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
    tracker_saved: "Tracker fields saved.",
    fit_scored: "Fit score saved.",
    resume_missing: "Save a master resume in Profile first.",
    fit_error: "The fit score could not be saved.",
    tailor_saved: "Tailoring drafts saved.",
    tailor_error: "The tailoring drafts could not be saved.",
    company_saved: "Company name saved.",
    company_error: "The company name could not be saved.",
    contact_saved: "Contact saved.",
    contact_deleted: "Contact deleted.",
    contact_invalid: "That contact request was not valid.",
    invalid: "That request was not valid.",
    stage_error: "The stage could not be saved.",
    lock_error: "The lock could not be cleared.",
    merge_error: "The merge could not be completed.",
    tracker_error: "The tracker fields could not be saved.",
    contact_error: "The contact could not be saved."
  };

  return messages[status] ?? "Done.";
}
