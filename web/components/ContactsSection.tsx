"use client";

import Link from "next/link";

import {
  createContactAction,
  deleteContactAction,
  updateContactAction
} from "../lib/dashboard-actions";
import type {
  ApplicationSummary,
  ContactRow,
  ContactWithApplication
} from "../lib/dashboard-data";
import { relationships } from "../lib/tracker";

type ContactsSectionProps = {
  title?: string;
  eyebrow?: string;
  contacts: Array<ContactRow | ContactWithApplication>;
  applications: ApplicationSummary[];
  returnTo: string;
  linkedApplicationId?: string;
};

export default function ContactsSection({
  title = "Network",
  eyebrow = "People",
  contacts,
  applications,
  returnTo,
  linkedApplicationId
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

      <div className="table-scroll">
        <table className="contacts-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Company</th>
              <th scope="col">Title</th>
              <th scope="col">Relationship</th>
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
                    <td>{contact.company || "Not set"}</td>
                    <td>{contact.title || "Not set"}</td>
                    <td>{relationshipLabel(contact.relationship)}</td>
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
                <td colSpan={8}>
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
