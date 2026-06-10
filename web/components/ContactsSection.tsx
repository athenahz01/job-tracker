"use client";

import Link from "next/link";

import {
  createContactAction,
  deleteContactAction,
  updateContactAction
} from "../lib/dashboard-actions";
import DraftActionPanel from "./DraftActionPanel";
import type {
  ApplicationSummary,
  ContactRow,
  ContactWithApplication
} from "../lib/dashboard-data";
import {
  outreachStageLabel,
  outreachStages,
  type OutreachStage
} from "../lib/networking";
import { relationships } from "../lib/tracker";

type ContactsSectionProps = {
  title?: string;
  eyebrow?: string;
  contacts: Array<ContactRow | ContactWithApplication>;
  applications: ApplicationSummary[];
  returnTo: string;
  linkedApplicationId?: string;
  showReferralCheatSheet?: boolean;
};

export default function ContactsSection({
  title = "Network",
  eyebrow = "People",
  contacts,
  applications,
  returnTo,
  linkedApplicationId,
  showReferralCheatSheet = false
}: ContactsSectionProps) {
  return (
    <section className="network-section" aria-labelledby="network-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id="network-heading">{title}</h2>
        </div>
        <span className="flow-count">{contacts.length} contacts</span>
      </div>

      <details className="inline-editor" open={contacts.length === 0}>
        <summary>Add a contact</summary>
        <ContactForm
          action={createContactAction}
          applications={applications}
          returnTo={returnTo}
          linkedApplicationId={linkedApplicationId}
        />
      </details>

      {showReferralCheatSheet ? <ReferralCheatSheet /> : null}

      <div className="table-scroll">
        <table className="contacts-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Company</th>
              <th scope="col">Title</th>
              <th scope="col">Relationship</th>
              <th scope="col">Pipeline</th>
              <th scope="col">School</th>
              <th scope="col">Linked application</th>
              <th scope="col">Last contacted</th>
              <th scope="col">Next follow-up</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length ? (
              contacts.map((contact) => {
                const application = contactApplication(contact, applications);
                return (
                  <tr id={`contact-${contact.id}`} key={contact.id}>
                    <td>
                      <strong>{contact.name}</strong>
                      {contact.email ? <p className="muted">{contact.email}</p> : null}
                    </td>
                    <td>
                      {contact.company || "Not set"}
                      {contact.past_companies.length ? (
                        <p className="muted">Past: {contact.past_companies.join(", ")}</p>
                      ) : null}
                    </td>
                    <td>{contact.title || "Not set"}</td>
                    <td>{relationshipLabel(contact.relationship)}</td>
                    <td>
                      <span className={`outreach-pill ${outreachClass(contact.outreach_stage)}`}>
                        {outreachStageLabel(contact.outreach_stage)}
                      </span>
                    </td>
                    <td>{contact.school || "Not set"}</td>
                    <td>
                      {application ? (
                        <Link href={`/applications/${application.id}`}>
                          {application.company}
                          {application.role ? `, ${application.role}` : ""}
                        </Link>
                      ) : (
                        "Not linked"
                      )}
                    </td>
                    <td>{contact.last_contacted || "Not set"}</td>
                    <td>{contact.next_follow_up || "Not set"}</td>
                    <td>
                      <DraftActionPanel
                        compact
                        kind="contact-outreach"
                        label="Draft outreach"
                        contactId={contact.id}
                      />
                      <DraftActionPanel
                        compact
                        kind="networking"
                        variant="follow_up_nudge"
                        label="Draft nudge"
                        contactId={contact.id}
                        applicationId={application?.id}
                      />
                      <details className="row-editor">
                        <summary>Edit</summary>
                        <ContactForm
                          action={updateContactAction}
                          applications={applications}
                          contact={contact}
                          returnTo={returnTo}
                          linkedApplicationId={linkedApplicationId}
                        />
                      </details>
                      <form
                        action={deleteContactAction}
                        onSubmit={(event) => {
                          if (!window.confirm(`Delete ${contact.name}?`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="contactId" value={contact.id} />
                        <input
                          type="hidden"
                          name="applicationId"
                          value={contact.application_id ?? ""}
                        />
                        <input type="hidden" name="returnTo" value={returnTo} />
                        <button className="text-danger-button" type="submit">
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10}>
                  <p className="empty-state">No contacts yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ContactForm({
  action,
  applications,
  contact,
  returnTo,
  linkedApplicationId
}: {
  action: (formData: FormData) => void;
  applications: ApplicationSummary[];
  contact?: ContactRow | ContactWithApplication;
  returnTo: string;
  linkedApplicationId?: string;
}) {
  return (
    <form action={action} className="contact-form">
      {contact ? <input type="hidden" name="contactId" value={contact.id} /> : null}
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="field">
        <span>Name</span>
        <input name="name" defaultValue={contact?.name ?? ""} required />
      </label>
      <label className="field">
        <span>Company</span>
        <input name="company" defaultValue={contact?.company ?? ""} />
      </label>
      <label className="field">
        <span>Title</span>
        <input name="title" defaultValue={contact?.title ?? ""} />
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" defaultValue={contact?.email ?? ""} />
      </label>
      <label className="field">
        <span>LinkedIn</span>
        <input name="linkedinUrl" type="url" defaultValue={contact?.linkedin_url ?? ""} />
      </label>
      <label className="field">
        <span>Relationship</span>
        <select name="relationship" defaultValue={contact?.relationship ?? ""}>
          <option value="">Not set</option>
          {relationships.map((relationship) => (
            <option key={relationship} value={relationship}>
              {relationshipLabel(relationship)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Outreach stage</span>
        <select name="outreachStage" defaultValue={contact?.outreach_stage ?? ""}>
          <option value="">Not set</option>
          {outreachStages.map((stage) => (
            <option key={stage} value={stage}>
              {outreachStageLabel(stage)}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>School</span>
        <input name="school" defaultValue={contact?.school ?? ""} />
      </label>
      <label className="field">
        <span>Past companies</span>
        <input name="pastCompanies" defaultValue={contact?.past_companies.join(", ") ?? ""} />
      </label>
      {linkedApplicationId ? (
        <input type="hidden" name="applicationId" value={linkedApplicationId} />
      ) : (
        <label className="field">
          <span>Linked application</span>
          <select name="applicationId" defaultValue={contact?.application_id ?? ""}>
            <option value="">None</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.company}
                {application.role ? `, ${application.role}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="field">
        <span>Last contacted</span>
        <input name="lastContacted" type="date" defaultValue={contact?.last_contacted ?? ""} />
      </label>
      <label className="field">
        <span>Next follow-up</span>
        <input name="nextFollowUp" type="date" defaultValue={contact?.next_follow_up ?? ""} />
      </label>
      <label className="field wide-field">
        <span>Notes</span>
        <textarea name="notes" defaultValue={contact?.notes ?? ""} rows={3} />
      </label>
      <button className="primary-button" type="submit">
        {contact ? "Save contact" : "Add contact"}
      </button>
    </form>
  );
}

function ReferralCheatSheet() {
  return (
    <section className="referral-cheat-sheet" aria-labelledby="referral-cheat-sheet-heading">
      <div>
        <p className="eyebrow">Referral cheat sheet</p>
        <h3 id="referral-cheat-sheet-heading">Make The Ask</h3>
      </div>
      <div className="referral-cheat-grid">
        <article>
          <h4>Talking points</h4>
          <p>Lead with the role, why it fits, and the one specific help you are asking for.</p>
        </article>
        <article>
          <h4>Informational call</h4>
          <p>Ask for 15 minutes, offer two windows, and make it easy for them to say no.</p>
        </article>
        <article>
          <h4>Referral ask</h4>
          <p>Attach the posting and resume, then ask whether they feel comfortable referring you.</p>
        </article>
        <article>
          <h4>Follow up</h4>
          <p>Send one short nudge after a few days, then let it rest unless they reply.</p>
        </article>
      </div>
    </section>
  );
}

function contactApplication(
  contact: ContactRow | ContactWithApplication,
  applications: ApplicationSummary[]
) {
  if ("application" in contact && contact.application) {
    return contact.application;
  }
  return applications.find((application) => application.id === contact.application_id) ?? null;
}

function relationshipLabel(value: string | null) {
  if (!value) {
    return "Not set";
  }
  return value
    .split("_")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function outreachClass(value: OutreachStage | null) {
  return value ? `outreach-${value.replace("_", "-")}` : "outreach-empty";
}
