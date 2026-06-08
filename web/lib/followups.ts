import type { ApplicationRow, ContactRow, FollowUpItem } from "./dashboard-data";
import { activeApplicationStages } from "./tracker";

export function buildFollowUpItems(
  applications: ApplicationRow[],
  contacts: ContactRow[],
  today: Date,
  quietDays = 14
): FollowUpItem[] {
  const todayKey = dateKey(today);
  const todayTime = Date.parse(todayKey);
  const items: FollowUpItem[] = [];

  for (const application of applications) {
    if (application.follow_up_on && application.follow_up_on <= todayKey) {
      items.push({
        id: `application-due-${application.id}`,
        kind: "application_due",
        title: application.company,
        subtitle: application.next_action || application.role || "Application follow-up",
        dueOn: application.follow_up_on,
        overdueDays: daysBetween(application.follow_up_on, todayKey),
        href: `/applications/${application.id}`,
        stage: application.stage
      });
    }

    if (activeApplicationStages.includes(application.stage)) {
      const quietDue = addDays(dateKey(new Date(application.last_activity)), quietDays);
      const explicitFollowUpDue =
        Boolean(application.follow_up_on) && application.follow_up_on! <= todayKey;
      if (quietDue <= todayKey && !explicitFollowUpDue) {
        items.push({
          id: `quiet-${application.id}`,
          kind: "quiet_application",
          title: application.company,
          subtitle: `${application.stage} with no activity for ${quietDays} days`,
          dueOn: quietDue,
          overdueDays: Math.max(0, Math.floor((todayTime - Date.parse(quietDue)) / 86400000)),
          href: `/applications/${application.id}`,
          stage: application.stage
        });
      }
    }
  }

  for (const contact of contacts) {
    if (!contact.next_follow_up || contact.next_follow_up > todayKey) {
      continue;
    }
    items.push({
      id: `contact-due-${contact.id}`,
      kind: "contact_due",
      title: contact.name,
      subtitle: [contact.company, contact.relationship].filter(Boolean).join(" / ") || "Contact",
      dueOn: contact.next_follow_up,
      overdueDays: daysBetween(contact.next_follow_up, todayKey),
      href: `/?view=network#contact-${contact.id}`
    });
  }

  return items.sort((left, right) => {
    if (right.overdueDays !== left.overdueDays) {
      return right.overdueDays - left.overdueDays;
    }
    return left.title.localeCompare(right.title);
  });
}

function daysBetween(from: string, to: string) {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 86400000));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
