import type { InsightsData, RateMetric } from "../lib/insights-calc";

type InsightsViewProps = {
  data: InsightsData;
};

const dailyChartWidth = 760;
const dailyChartHeight = 220;
const dailyChartPadding = {
  top: 18,
  right: 16,
  bottom: 42,
  left: 28
};

export default function InsightsView({ data }: InsightsViewProps) {
  const hasApplied = data.totalApplied > 0;

  return (
    <section className="insights-section" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personal analytics</p>
          <h2 id="insights-heading">Insights</h2>
        </div>
        <span className="flow-count">{data.totalApplied} applied</span>
      </div>

      {!hasApplied ? (
        <p className="empty-state">
          Apply to a few roles and this page will start showing response rates, drop-off, and
          daily activity.
        </p>
      ) : null}

      <section className="insight-panel" aria-labelledby="headline-numbers-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Overview</p>
            <h3 id="headline-numbers-heading">Search health</h3>
          </div>
        </div>
        <div className="insight-headline-grid" aria-label="Headline numbers and rates">
          {data.headlines.slice(1, 3).map((metric) => (
            <article className="insight-stat" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
          <RateCard label="Response rate" metric={data.rates.response} />
          <article className="insight-feature-card">
            <p>Applied</p>
            <strong>{data.totalApplied || "-"}</strong>
            <span>{data.savedBacklog} saved for later</span>
          </article>
        </div>
      </section>

      <section className="insight-panel" aria-labelledby="daily-applications-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Momentum</p>
            <h3 id="daily-applications-heading">Applications over time</h3>
            {data.dailyApplications.length ? (
              <p className="muted">{formatMonthLabel(data.dailyApplications[0].day)}</p>
            ) : null}
          </div>
        </div>
        {data.dailyApplications.length ? (
          <DailyApplicationsChart data={data.dailyApplications} />
        ) : (
          <p className="empty-state">Dates are not available yet for a daily trend.</p>
        )}
      </section>

      <section className="insight-panel" aria-labelledby="insight-highlights-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Highlights</p>
            <h3 id="insight-highlights-heading">What the numbers say</h3>
          </div>
        </div>
        <ul className="insight-highlight-list">
          <HighlightItem text={`${data.rates.response.display} response rate across ${data.totalApplied} applied applications.`} />
          <HighlightItem text={`${data.rates.interview.display} interview rate based on phone screens and later stages.`} />
          <HighlightItem text={dropOffHighlight(data)} />
        </ul>
      </section>

      <section className="insight-panel" aria-labelledby="location-applications-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Location</p>
            <h3 id="location-applications-heading">Applications by location</h3>
          </div>
        </div>
        {data.locationApplications.length ? (
          <LocationApplicationsList data={data.locationApplications} total={data.totalApplied} />
        ) : (
          <p className="empty-state">No clean location data is available yet.</p>
        )}
      </section>
    </section>
  );
}

function RateCard({ label, metric }: { label: string; metric: RateMetric }) {
  return (
    <article className="insight-rate-card">
      <p>{label}</p>
      <strong>{metric.display}</strong>
      <span className="muted">
        {metric.denominator ? `${metric.numerator} of ${metric.denominator}` : "No denominator"}
      </span>
    </article>
  );
}

function DailyApplicationsChart({ data }: { data: InsightsData["dailyApplications"] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);
  const chartInnerWidth = dailyChartWidth - dailyChartPadding.left - dailyChartPadding.right;
  const chartInnerHeight = dailyChartHeight - dailyChartPadding.top - dailyChartPadding.bottom;
  const slotWidth = chartInnerWidth / data.length;
  const barWidthValue = Math.max(3, Math.min(10, slotWidth * 0.5));
  const tickEvery = data.length > 30 ? 5 : data.length > 20 ? 4 : 3;

  return (
    <div className="daily-chart-wrap">
      <svg
        className="daily-chart"
        role="img"
        aria-labelledby="daily-applications-title"
        viewBox={`0 0 ${dailyChartWidth} ${dailyChartHeight}`}
      >
        <title id="daily-applications-title">
          Daily applications in {formatMonthLabel(data[0].day)}
        </title>
        <line
          className="daily-axis"
          x1={dailyChartPadding.left}
          x2={dailyChartWidth - dailyChartPadding.right}
          y1={dailyChartHeight - dailyChartPadding.bottom}
          y2={dailyChartHeight - dailyChartPadding.bottom}
        />
        {data.map((item, index) => {
          const barHeight = (item.count / maxCount) * chartInnerHeight;
          const x = dailyChartPadding.left + index * slotWidth + (slotWidth - barWidthValue) / 2;
          const y = dailyChartPadding.top + chartInnerHeight - barHeight;
          const dayNumber = index + 1;
          const showTick =
            index === 0 || index === data.length - 1 || (dayNumber - 1) % tickEvery === 0;
          return (
            <g key={item.day}>
              <rect
                className={`daily-bar ${item.count === maxCount ? "daily-bar-peak" : ""}`}
                height={barHeight}
                rx="4"
                width={barWidthValue}
                x={x}
                y={y}
              />
              <title>
                {item.count} {item.count === 1 ? "application" : "applications"} on {item.day}
              </title>
              <text className="daily-count" textAnchor="middle" x={x + barWidthValue / 2} y={y - 6}>
                {item.count || ""}
              </text>
              {showTick ? (
                <text
                  className="daily-label"
                  textAnchor="middle"
                  x={x + barWidthValue / 2}
                  y={dailyChartHeight - 16}
                >
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function HighlightItem({ text }: { text: string }) {
  return (
    <li>
      <span aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <p>{text}</p>
    </li>
  );
}

function LocationApplicationsList({
  data,
  total
}: {
  data: InsightsData["locationApplications"];
  total: number;
}) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <div className="location-list">
      {data.map((item) => (
        <div className="location-row" key={item.location}>
          <div className="location-row-top">
            <strong>{item.location}</strong>
            <span>
              {item.count} {item.count === 1 ? "application" : "applications"}
            </span>
          </div>
          <div className="location-bar-track" aria-hidden="true">
            <span
              className="location-bar-fill"
              style={{ width: `${barWidth(item.count, maxCount)}%` }}
            />
          </div>
        </div>
      ))}
      {data.reduce((sum, item) => sum + item.count, 0) < total ? (
        <p className="muted">Some applications do not have a clean saved location yet.</p>
      ) : null}
    </div>
  );
}

function dropOffHighlight(data: InsightsData) {
  const biggestDrop = data.funnel
    .map((step, index) => {
      const previous = index > 0 ? data.funnel[index - 1] : null;
      return {
        label: previous ? `${previous.label} to ${step.label}` : step.label,
        dropped: previous ? Math.max(0, previous.count - step.count) : 0
      };
    })
    .sort((left, right) => right.dropped - left.dropped)[0];

  if (!biggestDrop || biggestDrop.dropped === 0) {
    return "No major drop-off is visible yet.";
  }

  return `${biggestDrop.dropped} applications drop from ${biggestDrop.label}.`;
}

function barWidth(count: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.max(4, Math.round((count / total) * 100));
}

function formatMonthLabel(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "selected month";
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}
