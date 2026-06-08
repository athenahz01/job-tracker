import Link from "next/link";

import ApplicationFlowSankey from "../components/ApplicationFlowSankey";
import {
  getApplicationFlowData,
  getDashboardData,
  parseFilters
} from "../lib/dashboard-data";
import { timeAgo } from "../lib/format";
import { Stage, stages } from "../lib/stages";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const filters = parseFilters(params);
  const [{ applications, recruiterOutreach }, applicationFlow] = await Promise.all([
    getDashboardData(filters),
    getApplicationFlowData()
  ]);

  const grouped = new Map<Stage, typeof applications>();
  for (const stage of stages) {
    grouped.set(stage, []);
  }
  for (const application of applications) {
    grouped.get(application.stage)?.push(application);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Personal pipeline</p>
          <h1>Job Tracker</h1>
        </div>
        <div className="topbar-counts">
          <span>{applications.length} applications</span>
          <span>{recruiterOutreach.length} outreach</span>
        </div>
      </header>

      <section className="filter-panel" aria-label="Board filters">
        <form className="filters" action="/" method="get">
          <label className="field">
            <span>Stage</span>
            <select name="stage" defaultValue={filters.stage ?? ""}>
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
            <input name="q" defaultValue={filters.query ?? ""} placeholder="Search company" />
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              name="orphan"
              value="1"
              defaultChecked={filters.orphanOnly}
            />
            <span>Orphans only</span>
          </label>
          <button className="primary-button" type="submit">
            Apply
          </button>
          <Link className="secondary-link" href="/">
            Clear
          </Link>
        </form>
      </section>

      <ApplicationFlowSankey data={applicationFlow} />

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
                      className="application-card"
                      href={`/applications/${application.id}`}
                      key={application.id}
                    >
                      <div>
                        <h3>{application.company}</h3>
                        {application.role ? <p>{application.role}</p> : null}
                      </div>
                      <p className="muted">{timeAgo(application.last_activity)}</p>
                      <div className="badge-row">
                        {application.is_orphan ? <span className="badge">Orphan</span> : null}
                        {application.stage_locked ? <span className="badge locked">Locked</span> : null}
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

      <section className="outreach-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Separate bucket</p>
            <h2>Recruiter Outreach</h2>
          </div>
          <p className="muted">Personal outreach that is not part of the application board.</p>
        </div>
        <div className="outreach-list">
          {recruiterOutreach.length ? (
            recruiterOutreach.map((item) => (
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
    </main>
  );
}
