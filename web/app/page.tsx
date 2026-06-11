import Link from "next/link";

import ApplicationFlowSankey from "../components/ApplicationFlowSankey";
import ApplicationTableView from "../components/ApplicationTableView";
import AssistantView from "../components/AssistantView";
import CommandPalette from "../components/CommandPalette";
import ContactsSection from "../components/ContactsSection";
import FitScoreBadge from "../components/FitScoreBadge";
import FollowUpsView from "../components/FollowUpsView";
import InsightsView from "../components/InsightsView";
import PerformanceView from "../components/PerformanceView";
import PeekPanel from "../components/PeekPanel";
import ProfileView from "../components/ProfileView";
import Sidebar from "../components/Sidebar";
import TodayView, { buildTodayData } from "../components/TodayView";
import {
  getApplicationFlowData,
  getDashboardData,
  getFollowUpsData,
  getInsightsData,
  getNetworkData,
  getPerformanceData,
  getProfileData,
  type ApplicationRow
} from "../lib/dashboard-data";
import { timeAgo } from "../lib/format";
import { priorityClass, stageClass } from "../lib/style-utils";
import { filterAndSortApplications, parseTableState, type DashboardView } from "../lib/table-utils";
import { type Stage, stages } from "../lib/stages";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const state = parseTableState(params);
  const status = readSingle(params.status);
  const [
    { applications, recruiterOutreach },
    applicationFlow,
    followUps,
    network,
    profileData,
    performance,
    insights
  ] = await Promise.all([
      getDashboardData(),
      getApplicationFlowData(),
      getFollowUpsData(state.quietDays),
      getNetworkData(),
      state.view === "profile" ? getProfileData() : Promise.resolve(null),
      state.view === "performance" ? getPerformanceData() : Promise.resolve(null),
      getInsightsData()
    ]);
  const boardApplications = filterAndSortApplications(
    [...applications],
    state.filters,
    "last_activity",
    "desc"
  );
  const todayData = buildTodayData(applications, followUps);
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });
  const peekId = readSingle(params.peek);
  const peekApplication = peekId
    ? (applications.find((application) => application.id === peekId) ?? null)
    : null;
  const peekCloseHref = buildQueryHref(params, { peek: null });

  const paletteApplications = applications.map((application) => ({
    id: application.id,
    company: application.company,
    role: application.role,
    stage: application.stage as string
  }));

  return (
    <div className="app-frame">
      <Sidebar view={state.view} followUpsDue={followUps.length}>
        <CommandPalette applications={paletteApplications} />
      </Sidebar>
      <main className="app-main">
      {status ? <p className="status-message">{statusMessage(status)}</p> : null}

      {state.view === "today" ? (
        <>
          <header className="page-header">
            <div>
              <p className="eyebrow">{todayLabel}</p>
              <h1>Today</h1>
            </div>
            <div className="topbar-counts">
              <span>{applications.length} applications</span>
              <span>{recruiterOutreach.length} outreach</span>
              <span>{network.contacts.length} contacts</span>
            </div>
          </header>
          <DashboardSummary
            applied={insights.totalApplied}
            tracked={applications.length}
            responseRate={insights.rates.response.display}
            responded={insights.rates.response.numerator}
            responseDenominator={insights.rates.response.denominator}
            followUpsDue={followUps.length}
            appliedTrend={insights.dailyApplications.map((entry) => entry.count)}
          />
          <TodayView data={todayData} />
        </>
      ) : null}

      {state.view === "table" || state.view === "board" || state.view === "flow" ? (
        <PipelineSwitcher view={state.view} />
      ) : null}

      {state.view === "table" ? (
        peekApplication ? (
          <div className="peek-layout">
            <div className="peek-main">
              <ApplicationTableView applications={applications} state={state} />
            </div>
            <PeekPanel application={peekApplication} closeHref={peekCloseHref} />
          </div>
        ) : (
          <ApplicationTableView applications={applications} state={state} />
        )
      ) : null}

      {state.view === "board" ? (
        peekApplication ? (
          <div className="peek-layout">
            <div className="peek-main">
              <BoardFilters state={state} />
              <ApplicationBoard
                applications={boardApplications}
                cardHref={(id) => buildQueryHref(params, { peek: id })}
              />
            </div>
            <PeekPanel application={peekApplication} closeHref={peekCloseHref} />
          </div>
        ) : (
          <>
            <BoardFilters state={state} />
            <ApplicationBoard
              applications={boardApplications}
              cardHref={(id) => buildQueryHref(params, { peek: id })}
            />
          </>
        )
      ) : null}

      {state.view === "flow" ? <ApplicationFlowSankey data={applicationFlow} /> : null}

      {state.view === "assistant" ? (
        <AssistantView initialQuestion={readSingle(params.ask) ?? ""} />
      ) : null}

      {state.view === "insights" ? <InsightsView data={insights} /> : null}

      {state.view === "performance" && performance ? (
        <PerformanceView data={performance} />
      ) : null}

      {state.view === "follow-ups" ? (
        <>
          <QuietDaysForm quietDays={state.quietDays} />
          <FollowUpsView items={followUps} quietDays={state.quietDays} />
        </>
      ) : null}

      {state.view === "network" ? (
        <>
          <ContactsSection
            contacts={network.contacts}
            applications={network.applications}
            returnTo="/?view=network"
            showReferralCheatSheet
          />
          <RecruiterOutreach outreach={recruiterOutreach} />
        </>
      ) : null}

      {state.view === "profile" ? (
        <ProfileView
          profile={profileData?.profile ?? null}
          education={profileData?.education ?? []}
          workExperience={profileData?.workExperience ?? []}
          answers={profileData?.answers ?? []}
        />
      ) : null}
      </main>
    </div>
  );
}

function DashboardSummary({
  applied,
  tracked,
  responseRate,
  responded,
  responseDenominator,
  followUpsDue,
  appliedTrend
}: {
  applied: number;
  tracked: number;
  responseRate: string;
  responded: number;
  responseDenominator: number;
  followUpsDue: number;
  appliedTrend: number[];
}) {
  return (
    <section className="summary-bar" aria-label="Dashboard summary">
      <div className="summary-card accent-teal">
        <div className="summary-head">
          <span className="summary-label">Applied</span>
          <span className="summary-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7z" />
            </svg>
          </span>
        </div>
        <strong>{applied}</strong>
        <Sparkline values={appliedTrend} />
        <p className="summary-context">{tracked} tracked in total</p>
      </div>
      <div className="summary-card accent-amber">
        <div className="summary-head">
          <span className="summary-label">Response rate</span>
          <span className="summary-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </span>
        </div>
        <strong>{responseRate}</strong>
        <p className="summary-context">
          {responseDenominator > 0
            ? `${responded} of ${responseDenominator} replied`
            : "No replies yet"}
        </p>
      </div>
      <div className="summary-card accent-green">
        <div className="summary-head">
          <span className="summary-label">Follow-ups due</span>
          <span className="summary-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </div>
        <strong>{followUpsDue}</strong>
        <p className="summary-context">
          {followUpsDue === 0 ? "You are all caught up" : "Needs your attention"}
        </p>
      </div>
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const cleaned = values.filter((value) => Number.isFinite(value));
  if (cleaned.length < 2) {
    return null;
  }

  const width = 120;
  const height = 22;
  const max = Math.max(...cleaned, 1);
  const points = cleaned
    .map((value, index) => {
      const x = (index / (cleaned.length - 1)) * width;
      const y = height - (value / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      className="summary-spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline points={points} fill="none" stroke="var(--accent-bright)" strokeWidth="2" />
    </svg>
  );
}

function BoardFilters({ state }: { state: ReturnType<typeof parseTableState> }) {
  return (
    <section className="filter-panel" aria-label="Board filters">
      <form className="filters" action="/" method="get">
        <input type="hidden" name="view" value="board" />
        <label className="field">
          <span>Stage</span>
          <select name="stage" defaultValue={state.filters.stage ?? ""}>
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Company</span>
          <input name="q" defaultValue={state.filters.query ?? ""} placeholder="Search company" />
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="orphan"
            value="1"
            defaultChecked={state.filters.orphanOnly}
          />
          <span>Orphans only</span>
        </label>
        <button className="primary-button" type="submit">
          Apply
        </button>
        <Link className="secondary-link" href="/?view=board">
          Clear
        </Link>
      </form>
    </section>
  );
}

function PipelineSwitcher({ view }: { view: DashboardView }) {
  const options: { view: DashboardView; label: string }[] = [
    { view: "table", label: "List" },
    { view: "board", label: "Board" },
    { view: "flow", label: "Flow" }
  ];

  return (
    <nav className="pipeline-switcher" aria-label="Pipeline views">
      {options.map((option) => (
        <Link
          aria-current={view === option.view ? "page" : undefined}
          className={view === option.view ? "active" : ""}
          href={`/?view=${option.view}`}
          key={option.view}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function ApplicationBoard({
  applications,
  cardHref
}: {
  applications: ApplicationRow[];
  cardHref: (id: string) => string;
}) {
  const grouped = new Map<Stage, ApplicationRow[]>();
  for (const stage of stages) {
    grouped.set(stage, []);
  }
  for (const application of applications) {
    grouped.get(application.stage)?.push(application);
  }

  return (
    <section className="board" aria-label="Application board">
      {stages.map((stage) => {
        const stageApplications = grouped.get(stage) ?? [];
        return (
          <section className="stage-column" key={stage}>
            <div className="stage-header">
              <h2>{stage}</h2>
              <span>{stageApplications.length}</span>
            </div>
            <div className="card-stack">
              {stageApplications.length ? (
                stageApplications.map((application) => (
                  <Link
                    className={`application-card board-card-${stageClass(application.stage)} ${application.priority ? `board-${priorityClass(application.priority)}` : ""}`}
                    href={cardHref(application.id)}
                    key={application.id}
                    scroll={false}
                  >
                    <div>
                      <h3>{application.company}</h3>
                      {application.role ? <p>{application.role}</p> : null}
                    </div>
                    <p className="muted">
                      {application.next_action || application.source || "Tracked application"}
                    </p>
                    <div className="badge-row">
                      <span className={`stage-pill ${stageClass(application.stage)}`}>
                        {application.stage}
                      </span>
                      {application.priority ? (
                        <span className={`priority-pill priority-${application.priority.toLowerCase()}`}>
                          {application.priority}
                        </span>
                      ) : null}
                      {application.is_orphan ? <span className="badge">Orphan</span> : null}
                      {application.stage_locked ? <span className="badge locked">Locked</span> : null}
                    </div>
                    <div className="board-card-footer">
                      <FitScoreBadge score={application.fit_score} />
                      <span>{timeAgo(application.last_activity)}</span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="empty-column">No applications here.</p>
              )}
            </div>
          </section>
        );
      })}
    </section>
  );
}

function QuietDaysForm({ quietDays }: { quietDays: number }) {
  return (
    <section className="filter-panel" aria-label="Follow-up settings">
      <form className="filters" action="/" method="get">
        <input type="hidden" name="view" value="follow-ups" />
        <label className="field">
          <span>Quiet after</span>
          <input min="1" name="quietDays" type="number" defaultValue={quietDays} />
        </label>
        <button className="primary-button" type="submit">
          Apply
        </button>
      </form>
    </section>
  );
}

function RecruiterOutreach({ outreach }: { outreach: ApplicationRow[] }) {
  return (
    <section className="outreach-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Separate bucket</p>
          <h2>Recruiter outreach</h2>
        </div>
        <p className="muted">Personal outreach that is not part of the application board.</p>
      </div>
      <div className="outreach-list">
        {outreach.length ? (
          outreach.map((item) => (
            <Link className="outreach-row" href={`/applications/${item.id}`} key={item.id}>
              <div>
                <h3>{item.company}</h3>
                {item.role ? <p>{item.role}</p> : null}
              </div>
              <span>{timeAgo(item.last_activity)}</span>
            </Link>
          ))
        ) : (
          <p className="empty-state">No recruiter outreach captured yet.</p>
        )}
      </div>
    </section>
  );
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildQueryHref(
  params: Record<string, string | string[] | undefined>,
  overrides: Record<string, string | null>
) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined) {
      search.set(key, single);
    }
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      search.delete(key);
    } else {
      search.set(key, value);
    }
  }
  const query = search.toString();
  return query ? `/?${query}` : "/";
}

function statusMessage(status: string) {
  const messages: Record<string, string> = {
    contact_saved: "Contact saved.",
    contact_deleted: "Contact deleted.",
    contact_invalid: "That contact request was not valid.",
    contact_error: "The contact could not be saved.",
    profile_saved: "Master resume saved.",
    profile_error: "The master resume could not be saved.",
    application_profile_saved: "Application details saved.",
    application_profile_error: "Application details could not be saved.",
    equal_employment_saved: "Equal employment answers saved.",
    equal_employment_error: "Equal employment answers could not be saved.",
    skills_saved: "Skills saved.",
    skills_error: "Skills could not be saved.",
    education_saved: "Education saved.",
    education_deleted: "Education deleted.",
    education_invalid: "That education request was not valid.",
    education_error: "Education could not be saved.",
    work_saved: "Work experience saved.",
    work_deleted: "Work experience deleted.",
    work_invalid: "That work experience request was not valid.",
    work_error: "Work experience could not be saved.",
    answer_saved: "Answer saved.",
    answer_deleted: "Answer deleted.",
    answer_invalid: "That answer request was not valid.",
    answer_error: "The answer could not be saved."
  };

  return messages[status] ?? "Done.";
}
