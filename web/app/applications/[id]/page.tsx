import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import ContactsSection from "../../../components/ContactsSection";
import DraftActionPanel from "../../../components/DraftActionPanel";
import FitScoreBadge from "../../../components/FitScoreBadge";
import MergeForm from "../../../components/MergeForm";
import {
  buildApplicationTimeline,
  type ApplicationTimelineItem
} from "../../../lib/application-timeline";
import {
  clearStageLockAction,
  generateInterviewPrepAction,
  generateTailoredResumeAction,
  renameCompanyAction,
  setStageAction,
  scoreApplicationFitAction,
  scoreApplicationRequirementsAction,
  tailorApplicationAction,
  updateApplicationUrlAction,
  updateApplicationRoleAction,
  updateApplicationTrackerFieldsAction
} from "../../../lib/dashboard-actions";
import { getApplicationDetail } from "../../../lib/dashboard-data";
import { formatDate, timeAgo } from "../../../lib/format";
import type { InterviewPrep, InterviewPrepQuestion } from "../../../lib/interview-prep-shape";
import { outreachStageLabel, type WarmPathMatch } from "../../../lib/networking";
import { buildPostingBreakdown, type PostingBreakdown } from "../../../lib/posting-breakdown";
import { buildResumeDiff, type ResumeDiffLine } from "../../../lib/resume-diff";
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
  const { application, events, mergeTargets, contacts, warmPathMatches, masterResumeText } =
    await getApplicationDetail(id);

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
  const tailoredResumeDiff = application.ai_tailored_resume
    ? buildResumeDiff(masterResumeText, application.ai_tailored_resume)
    : [];
  const postingBreakdown = buildPostingBreakdown({
    notes: application.notes,
    salary: application.salary,
    location: application.location
  });
  const activityTimeline = buildApplicationTimeline({
    application,
    events,
    contacts
  });

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

        <details className="inline-editor company-rename-editor">
          <summary>Edit role</summary>
          <form action={updateApplicationRoleAction} className="form-row">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="field compact-field">
              <span>Role</span>
              <input name="role" defaultValue={application.role ?? ""} />
            </label>
            <button className="primary-button" type="submit">
              Save role
            </button>
          </form>
        </details>

        <details className="inline-editor company-rename-editor">
          <summary>Edit posting link</summary>
          <form action={updateApplicationUrlAction} className="form-row">
            <input type="hidden" name="applicationId" value={application.id} />
            <label className="field compact-field">
              <span>Posting URL</span>
              <input name="url" type="url" defaultValue={application.url ?? ""} />
            </label>
            <button className="primary-button" type="submit">
              Save link
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
        </dl>
      </section>

      <div className="detail-main-grid">
        <div className="detail-left-column">
          {!isRecruiterOutreach ? <PostingBreakdownPanel breakdown={postingBreakdown} /> : null}

          <section className="timeline-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Activity</p>
                <h2>Timeline</h2>
              </div>
              <span>{activityTimeline.length} items</span>
            </div>
            <div className="timeline">
              {activityTimeline.length ? (
                activityTimeline.map((item) => <TimelineActivityItem item={item} key={item.id} />)
              ) : (
                <p className="empty-state">No activity is linked yet.</p>
              )}
            </div>
          </section>
        </div>

        <aside className="detail-right-column" aria-label="Application intelligence and actions">

      {!isRecruiterOutreach ? (
        <section className="action-panel ai-action-panel">
          <div className="section-heading ai-heading">
            <div>
              <p className="eyebrow">Outreach</p>
              <h2>Draft helpers</h2>
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
              <h2>Fit score</h2>
            </div>
            <div className="form-actions">
              <form action={scoreApplicationFitAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button className="primary-button" type="submit">
                  Score fit
                </button>
              </form>
              <form action={scoreApplicationRequirementsAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button className="secondary-button" type="submit">
                  Score requirements
                </button>
              </form>
            </div>
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
          <RequirementChecklist
            matches={application.requirement_matches}
            scoredAt={application.requirements_scored_at}
          />
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
            <div className="form-actions">
              <form action={tailorApplicationAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button className="primary-button" type="submit">
                  Generate tailoring
                </button>
              </form>
              <form action={generateTailoredResumeAction}>
                <input type="hidden" name="applicationId" value={application.id} />
                <button className="secondary-button" type="submit">
                  Generate resume variant
                </button>
              </form>
            </div>
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
          <TailoredResumePanel
            tailoredResume={application.ai_tailored_resume}
            generatedAt={application.tailored_resume_at}
            diff={tailoredResumeDiff}
          />
        </section>
      ) : null}

      {!isRecruiterOutreach ? (
        <InterviewPrepPanel
          applicationId={application.id}
          prep={application.ai_interview_prep}
          generatedAt={application.interview_prep_at}
        />
      ) : null}

      {!isRecruiterOutreach ? (
        <section className="action-panel tracker-editor">
          <div>
            <h2>Tracker fields</h2>
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
            <h2>Manual stage</h2>
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
            <h2>Merge orphan</h2>
            <p className="muted">
              Move this orphan's email events into an existing application. Nothing is deleted.
            </p>
          </div>
          <MergeForm orphan={application} targets={mergeTargets} />
        </section>
      ) : null}

      {!isRecruiterOutreach ? (
        <WhoCanHelpPanel applicationId={application.id} matches={warmPathMatches} />
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

        </aside>
      </div>
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

function PostingBreakdownPanel({ breakdown }: { breakdown: PostingBreakdown }) {
  if (!breakdown.sections.length && !breakdown.rawNotes) {
    return (
      <section className="action-panel posting-breakdown-panel">
        <div>
          <p className="eyebrow">Posting</p>
          <h2>Job description</h2>
        </div>
        <p className="empty-state">No posting text has been saved yet.</p>
      </section>
    );
  }

  return (
    <section className="action-panel posting-breakdown-panel" aria-labelledby="posting-breakdown-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Posting</p>
          <h2 id="posting-breakdown-heading">Job description</h2>
          <p className="muted">Structured from saved posting text. Raw notes stay unchanged below.</p>
        </div>
      </div>

      {breakdown.sections.length ? (
        <div className="posting-breakdown-grid">
          {breakdown.sections.map((section) => (
            <article className="posting-breakdown-card" key={section.key}>
              <h3>{section.label}</h3>
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : breakdown.rawNotes ? (
        <div className="posting-raw-notes">
          <h3>Raw notes</h3>
          <p>{breakdown.rawNotes}</p>
        </div>
      ) : null}
    </section>
  );
}

function TimelineActivityItem({ item }: { item: ApplicationTimelineItem }) {
  return (
    <article className="timeline-item" key={item.id}>
      <div className="timeline-meta">
        <span>{formatDate(item.occurredAt)}</span>
        {item.href && item.hrefLabel ? (
          <a href={item.href} target="_blank" rel="noreferrer">
            {item.hrefLabel}
          </a>
        ) : null}
      </div>
      <h3>{item.title}</h3>
      {item.description ? <p>{item.description}</p> : null}
      {item.badges.length ? (
        <div className="badge-row">
          {item.badges.map((badge) =>
            badge.kind === "stage" ? (
              <span className={`stage-pill ${stageClass(badge.label)}`} key={badge.label}>
                {badge.label}
              </span>
            ) : (
              <span className="badge" key={badge.label}>
                {badge.label}
              </span>
            )
          )}
        </div>
      ) : null}
    </article>
  );
}

function WhoCanHelpPanel({
  applicationId,
  matches
}: {
  applicationId: string;
  matches: WarmPathMatch[];
}) {
  return (
    <section className="action-panel who-can-help-panel" aria-labelledby="who-can-help-heading">
      <div className="section-heading ai-heading">
        <div>
          <p className="eyebrow">Warm path</p>
          <h2 id="who-can-help-heading">Who can help</h2>
          <p className="muted">Only contacts you entered yourself. Drafts are copy-only.</p>
        </div>
        <span className="flow-count">{matches.length} matches</span>
      </div>

      {matches.length ? (
        <div className="warm-path-list">
          {matches.map((match) => (
            <article className="warm-path-card" key={match.contact.id}>
              <div className="warm-path-top">
                <div>
                  <h3>{match.contact.name}</h3>
                  <p className="muted">
                    {[match.contact.title, match.contact.company].filter(Boolean).join(" at ") ||
                      "Contact"}
                  </p>
                </div>
                <span className={`outreach-pill ${outreachClass(match.contact.outreach_stage)}`}>
                  {outreachStageLabel(match.contact.outreach_stage)}
                </span>
              </div>
              <div className="chip-row">
                {match.reasons.map((reason) => (
                  <span className="tag-chip" key={reason}>
                    {reason}
                  </span>
                ))}
              </div>
              {match.contact.past_companies.length ? (
                <p className="muted">Past: {match.contact.past_companies.join(", ")}</p>
              ) : null}
              <div className="warm-draft-grid">
                <DraftActionPanel
                  compact
                  kind="networking"
                  variant="referral_request"
                  label="Referral ask"
                  contactId={match.contact.id}
                  applicationId={applicationId}
                />
                <DraftActionPanel
                  compact
                  kind="networking"
                  variant="warm_intro"
                  label="Intro ask"
                  contactId={match.contact.id}
                  applicationId={applicationId}
                />
                <DraftActionPanel
                  compact
                  kind="networking"
                  variant="coffee_chat"
                  label="Coffee chat"
                  contactId={match.contact.id}
                  applicationId={applicationId}
                />
                <DraftActionPanel
                  compact
                  kind="networking"
                  variant="follow_up_nudge"
                  label="Follow-up"
                  contactId={match.contact.id}
                  applicationId={applicationId}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">
          No warm-path contacts found yet. Add contacts with current companies, past companies, or
          schools in the Network tab.
        </p>
      )}
    </section>
  );
}

function InterviewPrepPanel({
  applicationId,
  prep,
  generatedAt
}: {
  applicationId: string;
  prep: InterviewPrep | null;
  generatedAt: string | null;
}) {
  const grouped = groupInterviewQuestions(prep?.likely_questions ?? []);

  return (
    <section className="action-panel interview-prep-panel" aria-labelledby="interview-prep-heading">
      <div className="section-heading ai-heading">
        <div>
          <p className="eyebrow">Interview</p>
          <h2 id="interview-prep-heading">Interview prep</h2>
          <p className="muted">Role-specific prep grounded in your resume and the posting.</p>
        </div>
        <form action={generateInterviewPrepAction}>
          <input type="hidden" name="applicationId" value={applicationId} />
          <button className="primary-button" type="submit">
            Generate prep
          </button>
        </form>
      </div>

      {generatedAt ? <p className="muted">Generated {formatDate(generatedAt)}</p> : null}

      {prep ? (
        <div className="interview-prep-stack">
          <section className="interview-prep-block" aria-labelledby="interview-questions-heading">
            <h3 id="interview-questions-heading">Likely questions</h3>
            {grouped.map((group) => (
              <div className="question-group" key={group.category}>
                <h4>{group.category}</h4>
                <div className="question-list">
                  {group.questions.map((question) => (
                    <article className="question-card" key={question.question}>
                      <div>
                        <strong>{question.question}</strong>
                        <ul>
                          {question.talking_points.map((point) => (
                            <li key={point}>{point}</li>
                          ))}
                        </ul>
                      </div>
                      <DraftActionPanel
                        compact
                        kind="interview-practice"
                        label="Practice answer"
                        applicationId={applicationId}
                        question={question.question}
                      />
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </section>

          <PrepList
            heading="Company and role insights"
            items={prep.company_insights}
            emptyText="No company insights saved yet."
          />
          <PrepList
            heading="Focus areas"
            items={prep.focus_areas}
            emptyText="No focus areas saved yet."
          />
        </div>
      ) : (
        <p className="empty-state">No interview prep generated yet.</p>
      )}
    </section>
  );
}

function PrepList({
  heading,
  items,
  emptyText
}: {
  heading: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <section className="interview-prep-block">
      <h3>{heading}</h3>
      {items.length ? (
        <ul className="prep-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  );
}

function groupInterviewQuestions(questions: InterviewPrepQuestion[]) {
  const groups = new Map<string, InterviewPrepQuestion[]>();
  for (const question of questions) {
    const category = question.category || "General";
    const rows = groups.get(category) ?? [];
    rows.push(question);
    groups.set(category, rows);
  }
  return Array.from(groups.entries()).map(([category, rows]) => ({
    category,
    questions: rows
  }));
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function RequirementChecklist({
  matches,
  scoredAt
}: {
  matches: {
    requirement: string;
    status: "met" | "partial" | "missing";
    evidence: string;
  }[];
  scoredAt: string | null;
}) {
  return (
    <section className="requirement-panel" aria-labelledby="requirement-checklist-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Requirements</p>
          <h3 id="requirement-checklist-heading">Checklist</h3>
        </div>
        {scoredAt ? <span className="muted">Scored {formatDate(scoredAt)}</span> : null}
      </div>

      {matches.length ? (
        <ul className="requirement-list">
          {matches.map((match) => (
            <li className={`requirement-item requirement-${match.status}`} key={match.requirement}>
              <span className="requirement-marker" aria-hidden="true" />
              <div>
                <strong>{match.requirement}</strong>
                <p>{match.evidence}</p>
              </div>
              <span>{statusLabel(match.status)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">No requirement checklist saved yet.</p>
      )}
    </section>
  );
}

function TailoredResumePanel({
  tailoredResume,
  generatedAt,
  diff
}: {
  tailoredResume: string | null;
  generatedAt: string | null;
  diff: ResumeDiffLine[];
}) {
  return (
    <section className="tailored-resume-panel" aria-labelledby="tailored-resume-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Resume variant</p>
          <h3 id="tailored-resume-heading">Review diff</h3>
        </div>
        {generatedAt ? <span className="muted">Generated {formatDate(generatedAt)}</span> : null}
      </div>

      {tailoredResume ? (
        <div className="tailored-resume-stack">
          <div className="resume-diff" aria-label="Tailored resume changes">
            {diff.length ? (
              diff.map((line) => (
                <div className={`resume-diff-line diff-${line.type}`} key={line.key}>
                  <span>{diffPrefix(line.type)}</span>
                  <code>{line.text || " "}</code>
                </div>
              ))
            ) : (
              <p className="empty-state">No line-level changes detected.</p>
            )}
          </div>
          <label className="field wide-field">
            <span>Tailored resume text</span>
            <textarea
              readOnly
              rows={Math.min(26, Math.max(10, tailoredResume.split("\n").length + 1))}
              defaultValue={tailoredResume}
            />
          </label>
        </div>
      ) : (
        <p className="empty-state">No tailored resume variant saved yet.</p>
      )}
    </section>
  );
}

function statusLabel(status: "met" | "partial" | "missing") {
  const labels = {
    met: "Met",
    partial: "Partial",
    missing: "Gap"
  };
  return labels[status];
}

function diffPrefix(type: ResumeDiffLine["type"]) {
  if (type === "added") {
    return "+";
  }
  if (type === "removed") {
    return "-";
  }
  return " ";
}

function outreachClass(value: WarmPathMatch["contact"]["outreach_stage"]) {
  return value ? `outreach-${value.replace("_", "-")}` : "outreach-empty";
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
    requirements_saved: "Requirement checklist saved.",
    requirements_error: "The requirement checklist could not be saved.",
    tailor_saved: "Tailoring drafts saved.",
    tailor_error: "The tailoring drafts could not be saved.",
    tailored_resume_saved: "Tailored resume variant saved.",
    tailored_resume_error: "The tailored resume variant could not be saved.",
    interview_prep_saved: "Interview prep saved.",
    interview_prep_error: "Interview prep could not be saved.",
    url_saved: "Posting link saved.",
    url_invalid: "Enter a valid http or https posting link.",
    url_error: "The posting link could not be saved.",
    company_saved: "Company name saved.",
    company_error: "The company name could not be saved.",
    role_saved: "Role saved.",
    role_error: "The role could not be saved.",
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
