import type {
  PerformanceBreakdown,
  PerformanceData,
  PerformanceGroup,
  PerformanceRate,
  SkillGap
} from "../lib/performance-calc";

type PerformanceViewProps = {
  data: PerformanceData;
};

export default function PerformanceView({ data }: PerformanceViewProps) {
  return (
    <section className="insights-section performance-section" aria-labelledby="performance-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Response analytics</p>
          <h2 id="performance-heading">Performance</h2>
        </div>
        <span className="flow-count">{data.totalApplied} applied</span>
      </div>

      {data.totalApplied ? (
        <section className="insight-panel" aria-labelledby="performance-summary-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">What is working</p>
              <h3 id="performance-summary-heading">Honest read</h3>
            </div>
          </div>
          <div className="performance-summary-grid">
            <SummaryCard label="Resume version" value={data.summary.resumeVersion} />
            <SummaryCard label="Source" value={data.summary.source} />
            <SummaryCard label="Tag" value={data.summary.tag} />
          </div>
        </section>
      ) : (
        <p className="empty-state">
          Apply to a few roles and this page will compare response performance by resume version,
          source, and tag.
        </p>
      )}

      <SkillGapPanel gaps={data.skillGaps} />

      {data.breakdowns.map((breakdown) => (
        <PerformanceBreakdownTable breakdown={breakdown} key={breakdown.key} />
      ))}
    </section>
  );
}

function SkillGapPanel({ gaps }: { gaps: SkillGap[] }) {
  return (
    <section className="insight-panel" aria-labelledby="skill-gaps-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">What to learn</p>
          <h3 id="skill-gaps-heading">Recurring skill gaps</h3>
        </div>
      </div>

      {gaps.length ? (
        <ol className="skill-gap-list">
          {gaps.map((gap) => (
            <li key={gap.key}>
              <span>{gap.label}</span>
              <strong>{gap.count} {gap.count === 1 ? "role" : "roles"}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">
          Run fit scoring or requirement matching on a few roles and recurring gaps will appear
          here.
        </p>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="performance-summary-card">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function PerformanceBreakdownTable({ breakdown }: { breakdown: PerformanceBreakdown }) {
  return (
    <section className="insight-panel" aria-labelledby={`${breakdown.key}-performance-heading`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Comparison</p>
          <h3 id={`${breakdown.key}-performance-heading`}>{breakdown.label}</h3>
        </div>
      </div>

      {breakdown.groups.length ? (
        <div className="performance-table-wrap">
          <table className="performance-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Count</th>
                <th>Response</th>
                <th>Interview</th>
                <th>Offer</th>
                <th>Median first response</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.groups.map((group) => (
                <PerformanceRow group={group} key={group.key} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-state">
          No {breakdown.label.toLowerCase()} data is available yet.
        </p>
      )}
    </section>
  );
}

function PerformanceRow({ group }: { group: PerformanceGroup }) {
  return (
    <tr>
      <td>
        <strong>{group.label}</strong>
      </td>
      <td>{group.count}</td>
      <td>
        <RateCell metric={group.response} />
      </td>
      <td>
        <RateCell metric={group.interview} />
      </td>
      <td>
        <RateCell metric={group.offer} />
      </td>
      <td>{group.medianDaysDisplay}</td>
    </tr>
  );
}

function RateCell({ metric }: { metric: PerformanceRate }) {
  return (
    <div className="performance-rate-cell">
      <div className="performance-rate-top">
        <strong>{metric.display}</strong>
        <span>{metric.denominator ? `${metric.numerator} of ${metric.denominator}` : "-"}</span>
      </div>
      <div className="performance-bar-track" aria-hidden="true">
        <span
          className="performance-bar-fill"
          style={{ width: `${metric.percentage ?? 0}%` }}
        />
      </div>
    </div>
  );
}
