import { buildFollowUpItems } from "./followups";
import { type Stage, stages } from "./stages";
import { activeApplicationStages } from "./tracker";
import type { ApplicationRow, ContactRow } from "./dashboard-data";

export type CopilotContextInput = {
  applications: ApplicationRow[];
  contacts: ContactRow[];
  today: Date;
  quietDays?: number;
};

export function buildPipelineCopilotContext({
  applications,
  contacts,
  today,
  quietDays = 14
}: CopilotContextInput) {
  const applied = applications.filter((application) => application.stage !== "Saved");
  const counts = countByStage(applications);
  const followUps = buildFollowUpItems(applications, contacts, today, quietDays);
  const todayKey = dateKey(today);
  const stale = applications
    .filter((application) => activeApplicationStages.includes(application.stage))
    .map((application) => ({
      application,
      daysQuiet: daysBetween(dateKey(new Date(application.last_activity)), todayKey)
    }))
    .filter((item) => item.daysQuiet >= Math.max(7, quietDays - 4))
    .sort((left, right) => right.daysQuiet - left.daysQuiet)
    .slice(0, 8);
  const highFit = applications
    .filter((application) => (application.fit_score ?? -1) >= 70)
    .sort((left, right) => (right.fit_score ?? 0) - (left.fit_score ?? 0))
    .slice(0, 8);
  const lowFit = applications
    .filter((application) => application.fit_score !== null && application.fit_score < 40)
    .sort((left, right) => (left.fit_score ?? 0) - (right.fit_score ?? 0))
    .slice(0, 8);
  const contactsDue = contacts
    .filter((contact) => Boolean(contact.next_follow_up) && contact.next_follow_up! <= todayKey)
    .sort((left, right) =>
      (left.next_follow_up ?? "").localeCompare(right.next_follow_up ?? "") ||
      left.name.localeCompare(right.name)
    )
    .slice(0, 8);

  return [
    `Today: ${todayKey}`,
    `Applications total: ${applications.length}`,
    `Applied or beyond: ${applied.length}`,
    `Contacts total: ${contacts.length}`,
    "",
    "Counts by stage:",
    ...stages.map((stage) => `- ${stage}: ${counts[stage] ?? 0}`),
    "",
    "Follow-ups due:",
    ...listOrEmpty(
      followUps.slice(0, 10).map(
        (item) =>
          `- ${item.title}: ${item.subtitle}, due ${item.dueOn}, ${item.overdueDays} days overdue`
      )
    ),
    "",
    "Applications going stale:",
    ...listOrEmpty(
      stale.map(
        ({ application, daysQuiet }) =>
          `- ${application.company}${roleSuffix(application.role)}: ${application.stage}, ${daysQuiet} days quiet`
      )
    ),
    "",
    "Contacts due:",
    ...listOrEmpty(
      contactsDue.map(
        (contact) =>
          `- ${contact.name}${contact.company ? ` at ${contact.company}` : ""}: due ${contact.next_follow_up}`
      )
    ),
    "",
    "High fit applications:",
    ...listOrEmpty(
      highFit.map(
        (application) =>
          `- ${application.company}${roleSuffix(application.role)}: ${application.fit_score}`
      )
    ),
    "",
    "Low fit applications:",
    ...listOrEmpty(
      lowFit.map(
        (application) =>
          `- ${application.company}${roleSuffix(application.role)}: ${application.fit_score}`
      )
    )
  ].join("\n");
}

function countByStage(applications: ApplicationRow[]) {
  const counts: Partial<Record<Stage, number>> = {};
  for (const application of applications) {
    counts[application.stage] = (counts[application.stage] ?? 0) + 1;
  }
  return counts;
}

function listOrEmpty(lines: string[]) {
  return lines.length ? lines : ["- None in the tracker context."];
}

function roleSuffix(role: string | null) {
  return role ? `, ${role}` : "";
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000));
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
