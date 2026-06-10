import type { ApplicationRow, ContactRow, EmailEventRow } from "./dashboard-data";
import { gmailUrl } from "./format";
import type { Stage } from "./stages";

export type ApplicationTimelineBadge =
  | {
      kind: "stage";
      label: Stage;
    }
  | {
      kind: "badge";
      label: string;
    };

export type ApplicationTimelineItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string | null;
  href: string | null;
  hrefLabel: string | null;
  badges: ApplicationTimelineBadge[];
};

type ApplicationTimelineInput = {
  application: ApplicationRow;
  events: EmailEventRow[];
  contacts: ContactRow[];
};

export function buildApplicationTimeline({
  application,
  events,
  contacts
}: ApplicationTimelineInput): ApplicationTimelineItem[] {
  const items: ApplicationTimelineItem[] = [];

  for (const event of events) {
    const occurredAt = event.received_at ?? event.processed_at;
    if (!validDate(occurredAt)) {
      continue;
    }
    items.push({
      id: `email-${event.id}`,
      occurredAt,
      title: event.detected_stage ? `${event.detected_stage} email signal` : "Email captured",
      description: event.summary || event.subject || event.from_address || null,
      href: event.gmail_message_id ? gmailUrl(event) : null,
      hrefLabel: event.gmail_message_id ? "Open in Gmail" : null,
      badges: [
        ...(event.detected_stage ? [{ kind: "stage" as const, label: event.detected_stage }] : []),
        ...(event.category ? [{ kind: "badge" as const, label: readableCategory(event.category) }] : []),
        ...(event.confidence !== null && event.confidence !== undefined
          ? [{ kind: "badge" as const, label: `${Math.round(event.confidence * 100)}% confidence` }]
          : [])
      ]
    });
  }

  addApplicationMilestones(items, application);
  addContactMilestones(items, contacts);

  return items.sort((left, right) => {
    const timeDelta = new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
    return timeDelta || left.title.localeCompare(right.title);
  });
}

function addApplicationMilestones(items: ApplicationTimelineItem[], application: ApplicationRow) {
  pushItem(items, {
    id: "current-stage",
    occurredAt: application.updated_at || application.last_activity,
    title: `Current stage: ${application.stage}`,
    description: application.stage_locked
      ? "Stage was set manually and automation is locked."
      : "Latest saved stage for this application.",
    badges: [{ kind: "stage", label: application.stage }]
  });

  pushItem(items, {
    id: "first-seen",
    occurredAt: application.first_seen,
    title: "Application captured",
    description: application.source ? `Source: ${application.source}` : null,
    badges: []
  });

  if (application.scored_at) {
    pushItem(items, {
      id: "fit-score",
      occurredAt: application.scored_at,
      title: "Fit score saved",
      description:
        application.fit_score === null
          ? application.fit_summary
          : `${application.fit_score}/100. ${application.fit_summary || "No verdict saved."}`,
      badges:
        application.fit_score === null
          ? []
          : [{ kind: "badge", label: `${application.fit_score}/100 fit` }]
    });
  }

  if (application.requirements_scored_at) {
    const counts = countRequirementMatches(application.requirement_matches);
    pushItem(items, {
      id: "requirements",
      occurredAt: application.requirements_scored_at,
      title: "Requirement checklist saved",
      description: [
        `${application.requirement_matches.length} requirements checked`,
        counts.missing ? `${counts.missing} gaps` : null,
        counts.partial ? `${counts.partial} partial` : null
      ]
        .filter(Boolean)
        .join(", "),
      badges: []
    });
  }

  if (application.tailored_at) {
    pushItem(items, {
      id: "tailoring",
      occurredAt: application.tailored_at,
      title: "Tailoring drafts generated",
      description: "Resume bullets and cover letter draft were saved.",
      badges: []
    });
  }

  if (application.tailored_resume_at) {
    pushItem(items, {
      id: "tailored-resume",
      occurredAt: application.tailored_resume_at,
      title: "Tailored resume variant generated",
      description: "Resume variant saved for review.",
      badges: []
    });
  }

  if (application.interview_prep_at) {
    const questionCount = application.ai_interview_prep?.likely_questions.length ?? 0;
    pushItem(items, {
      id: "interview-prep",
      occurredAt: application.interview_prep_at,
      title: "Interview prep generated",
      description: questionCount ? `${questionCount} likely questions saved.` : "Prep saved.",
      badges: []
    });
  }
}

function addContactMilestones(items: ApplicationTimelineItem[], contacts: ContactRow[]) {
  for (const contact of contacts) {
    const name = contact.name || "Contact";
    if (contact.last_contacted) {
      pushItem(items, {
        id: `contact-last-${contact.id}`,
        occurredAt: contact.last_contacted,
        title: `Contact outreach: ${name}`,
        description: contact.notes || contact.email || contact.linkedin_url || null,
        badges: contact.outreach_stage
          ? [{ kind: "badge", label: readableCategory(contact.outreach_stage) }]
          : []
      });
      continue;
    }

    pushItem(items, {
      id: `contact-linked-${contact.id}`,
      occurredAt: contact.created_at,
      title: `Contact linked: ${name}`,
      description: [contact.title, contact.company].filter(Boolean).join(" at ") || null,
      badges: contact.outreach_stage
        ? [{ kind: "badge", label: readableCategory(contact.outreach_stage) }]
        : []
    });
  }
}

function pushItem(
  items: ApplicationTimelineItem[],
  item: Omit<ApplicationTimelineItem, "href" | "hrefLabel"> &
    Partial<Pick<ApplicationTimelineItem, "href" | "hrefLabel">>
) {
  if (!validDate(item.occurredAt)) {
    return;
  }

  items.push({
    href: null,
    hrefLabel: null,
    ...item
  });
}

function validDate(value: string | null | undefined) {
  if (!value) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

function countRequirementMatches(matches: ApplicationRow["requirement_matches"]) {
  return matches.reduce(
    (counts, match) => ({
      ...counts,
      [match.status]: counts[match.status] + 1
    }),
    {
      met: 0,
      partial: 0,
      missing: 0
    }
  );
}

function readableCategory(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
