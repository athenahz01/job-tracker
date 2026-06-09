import { readFileSync } from "fs";
import { Script, createContext } from "vm";
import { describe, expect, it } from "vitest";

const sharedSource = readFileSync("../extension/shared.js", "utf8");
const scraperSource = readFileSync("../extension/scraper.js", "utf8");
const postingCaptureSource = readFileSync("../extension/posting-capture.js", "utf8");

describe("extension scraper", () => {
  it("extracts salary, location, role, and tags from sample markup", () => {
    const scrape = runScraper({
      hostname: "jobs.lever.co",
      href: "https://jobs.lever.co/acme/123",
      pathname: "/acme/123",
      title: "Senior Product Analyst - Acme",
      markup: `
        <main>
          <div class="posting-headline"><h2>Senior Product Analyst</h2></div>
          <div data-testid="company-name">Acme</div>
          <section data-testid="location">Remote US</section>
          <section data-testid="salary">Compensation: $120,000 - $150,000 per year</section>
          <p>Employment Type: Full-time</p>
          <p>Location Type: Remote</p>
          <article class="posting">Build analytics dashboards for product teams.</article>
        </main>
      `
    });

    expect(scrape.role).toBe("Senior Product Analyst");
    expect(scrape.salary).toBe("$120,000 - $150,000 per year");
    expect(scrape.location).toBe("Remote US");
    expect(scrape.tags).toEqual(expect.arrayContaining(["Remote", "Full-time"]));
  });

  it("extracts salary and location from labeled generic markup", () => {
    const scrape = runScraper({
      hostname: "wellfound.com",
      href: "https://wellfound.com/company/acme/jobs/456",
      pathname: "/company/acme/jobs/456",
      title: "Backend Engineer at Acme",
      markup: `
        <main>
          <h1>Backend Engineer</h1>
          <div data-test="StartupName">Acme</div>
          <div>
            <p>Location</p>
            <p>New York, NY Hybrid</p>
            <p>Pay Range</p>
            <p>$70 - $90 per hour</p>
            <p>Employment Type</p>
            <p>Contract</p>
            <p>Location Type</p>
            <p>Hybrid</p>
          </div>
        </main>
      `
    });

    expect(scrape.company).toBe("Acme");
    expect(scrape.role).toBe("Backend Engineer");
    expect(scrape.salary).toBe("$70 - $90 per hour");
    expect(scrape.location).toBe("New York, NY Hybrid");
    expect(scrape.tags).toEqual(expect.arrayContaining(["Hybrid", "Contract"]));
  });

  it("strips a leading location label from captured location text", () => {
    const scrape = runScraper({
      hostname: "jobs.lever.co",
      href: "https://jobs.lever.co/acme/789",
      pathname: "/acme/789",
      title: "Data Engineer - Acme",
      markup: `
        <main>
          <div class="posting-headline"><h2>Data Engineer</h2></div>
          <section data-testid="location">Location New York, New York</section>
        </main>
      `
    });

    expect(scrape.location).toBe("New York, New York");
  });

  it("derives tags only from labeled employment and workplace fields", () => {
    const scrape = runScraper({
      hostname: "jobs.lever.co",
      href: "https://jobs.lever.co/acme/101",
      pathname: "/acme/101",
      title: "Data Scientist - Acme",
      markup: `
        <main>
          <div class="posting-headline"><h2>Data Scientist</h2></div>
          <div data-testid="company-name">Acme</div>
          <section data-testid="location">Austin, TX</section>
          <p>Employment Type: Full-time</p>
          <p>Location Type: Hybrid</p>
          <p>We are not hiring a part-time contractor for this remote newsletter team.</p>
        </main>
      `
    });

    expect(scrape.tags).toEqual(["Full-time", "Hybrid"]);
  });

  it("discards a confirmation heading instead of using it as the role", () => {
    const scrape = runScraper({
      hostname: "jobs.lever.co",
      href: "https://jobs.lever.co/acme/confirmation",
      pathname: "/acme/confirmation",
      title: "Thank you for applying",
      markup: `
        <main>
          <h1>Thank you for applying</h1>
          <p>Application submitted. We received your application.</p>
        </main>
      `
    });

    expect(scrape.role).toBe("");
  });

  it("uses a real role named in confirmation body text", () => {
    const scrape = runScraper({
      hostname: "jobs.lever.co",
      href: "https://jobs.lever.co/acme/confirmation",
      pathname: "/acme/confirmation",
      title: "Thank you for applying",
      markup: `
        <main>
          <h1>Thank you for applying</h1>
          <p>Your application for the Product Strategy and Operations Associate role has been submitted.</p>
        </main>
      `
    });

    expect(scrape.role).toBe("Product Strategy and Operations Associate");
  });

  it("posting capture only accepts confident posting pages", () => {
    const helpers = runPostingCapture({
      hostname: "jobs.example.com",
      href: "https://jobs.example.com/acme/backend-engineer",
      pathname: "/acme/backend-engineer",
      title: "Backend Engineer at Acme",
      markup: `
        <main>
          <h1>Backend Engineer</h1>
          <div data-testid="company-name">Acme</div>
          <p>$120,000 - $150,000 per year</p>
        </main>
      `
    });
    const confidentPosting = {
      url: "https://jobs.example.com/acme/backend-engineer",
      company: "Acme",
      role: "Backend Engineer",
      salary: "$120,000 - $150,000 per year",
      location: "Remote US",
      confirmation: false,
      genericSubmitted: false
    };

    expect(
      helpers.isConfidentPosting(confidentPosting, "Thank you for applying. Application submitted.")
    ).toBe(false);
    expect(
      helpers.isConfidentPosting(
        { ...confidentPosting, salary: "$120,000 - $150,000 per year", location: "" },
        "Backend Engineer at Acme"
      )
    ).toBe(false);
    expect(
      helpers.isConfidentPosting(
        { ...confidentPosting, salary: "" },
        "Backend Engineer at Acme"
      )
    ).toBe(true);
  });

  it("scrape-with-retry waits for late company and role fields", async () => {
    const scrape = await runScraperWithRetry(
      {
        hostname: "jobs.ashbyhq.com",
        href: "https://jobs.ashbyhq.com/acme/backend-engineer",
        pathname: "/acme/backend-engineer",
        title: "",
        markup: "<main><p>Loading...</p></main>"
      },
      `
        <main>
          <h1>Backend Engineer</h1>
          <div data-testid="company-name">Acme</div>
        </main>
      `,
      { timeoutMs: 40, intervalMs: 1 }
    );

    expect(scrape.company).toBe("Acme");
    expect(scrape.role).toBe("Backend Engineer");
  });

  it("scrape-with-retry gives up cleanly when fields never appear", async () => {
    const scrape = await runScraperWithRetry(
      {
        hostname: "jobs.ashbyhq.com",
        href: "https://jobs.ashbyhq.com/acme/loading",
        pathname: "/acme/loading",
        title: "",
        markup: "<main><p>Loading...</p></main>"
      },
      null,
      { timeoutMs: 5, intervalMs: 1 }
    );

    expect(scrape.company).toBe("Acme");
    expect(scrape.role).toBe("");
  });
});

function runScraper(input: {
  hostname: string;
  href: string;
  pathname: string;
  title: string;
  markup: string;
}) {
  const context = createContext({
    chrome: {
      storage: {
        local: {
          get: () => undefined,
          set: () => undefined
        }
      }
    },
    document: createDocument(input.markup, input.title),
    globalThis: null,
    location: {
      hostname: input.hostname,
      href: input.href,
      pathname: input.pathname,
      search: ""
    },
    URL,
    URLSearchParams
  });
  context.globalThis = context;

  new Script(sharedSource).runInContext(context);
  new Script(scraperSource).runInContext(context);

  return context.JobTrackerScraper.scrapeCurrentPage();
}

function runPostingCapture(input: {
  hostname: string;
  href: string;
  pathname: string;
  title: string;
  markup: string;
}) {
  const context = createContext({
    chrome: {
      storage: {
        local: {
          get: () => undefined,
          set: () => undefined
        }
      }
    },
    document: createDocument(input.markup, input.title),
    globalThis: null,
    location: {
      hostname: input.hostname,
      href: input.href,
      pathname: input.pathname,
      search: ""
    },
    URL,
    URLSearchParams
  });
  context.globalThis = context;

  new Script(sharedSource).runInContext(context);
  new Script(scraperSource).runInContext(context);
  new Script(postingCaptureSource).runInContext(context);

  return context.JobTrackerPostingCapture;
}

async function runScraperWithRetry(
  input: {
    hostname: string;
    href: string;
    pathname: string;
    title: string;
    markup: string;
  },
  nextMarkup: string | null,
  options: { timeoutMs: number; intervalMs: number }
) {
  let currentDocument = createDocument(input.markup, input.title);
  let swapped = false;
  const documentProxy = {
    get body() {
      return currentDocument.body;
    },
    get title() {
      return currentDocument.title;
    },
    querySelector: (selector: string) => currentDocument.querySelector(selector),
    querySelectorAll: (selector: string) => currentDocument.querySelectorAll(selector)
  };
  const context = createContext({
    chrome: {
      storage: {
        local: {
          get: () => undefined,
          set: () => undefined
        }
      }
    },
    document: documentProxy,
    globalThis: null,
    location: {
      hostname: input.hostname,
      href: input.href,
      pathname: input.pathname,
      search: ""
    },
    setTimeout: (callback: () => void, ms: number) => {
      if (nextMarkup && !swapped) {
        swapped = true;
        currentDocument = createDocument(nextMarkup, input.title);
      }
      return setTimeout(callback, ms);
    },
    URL,
    URLSearchParams
  });
  context.globalThis = context;

  new Script(sharedSource).runInContext(context);
  new Script(scraperSource).runInContext(context);

  return context.JobTrackerScraper.scrapeCurrentPageWithRetry(options);
}

function createDocument(markup: string, title: string) {
  const elements = parseElements(markup);
  return {
    body: {
      innerText: textFromMarkup(markup)
    },
    title,
    querySelector: (selector: string) => querySelectorAll(elements, selector)[0] ?? null,
    querySelectorAll: (selector: string) => querySelectorAll(elements, selector)
  };
}

function parseElements(markup: string) {
  const elements: Array<{
    tag: string;
    attrs: Record<string, string>;
    text: string;
  }> = [];
  const pattern = /<([a-z0-9]+)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markup))) {
    elements.push({
      tag: match[1].toLowerCase(),
      attrs: parseAttrs(match[2]),
      text: textFromMarkup(match[3])
    });
    elements.push(...parseElements(match[3]));
  }
  return elements;
}

function parseAttrs(value: string) {
  const attrs: Record<string, string> = {};
  const pattern = /([a-zA-Z0-9_-]+)=["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

function querySelectorAll(
  elements: Array<{ tag: string; attrs: Record<string, string>; text: string }>,
  selector: string
) {
  return elements.filter((element) => matchesSelector(element, selector)).map(toElement);
}

function matchesSelector(
  element: { tag: string; attrs: Record<string, string> },
  selector: string
) {
  if (selector === "h1" || selector.endsWith(" h1")) {
    return element.tag === "h1";
  }
  if (selector === ".posting-headline h2") {
    return element.tag === "h2";
  }
  if (selector.includes("data-testid")) {
    return attrMatches(element.attrs, "data-testid", selector);
  }
  if (selector.includes("data-test")) {
    return attrMatches(element.attrs, "data-test", selector);
  }
  if (selector.includes("class*='job-title'")) {
    return (element.attrs.class || "").toLowerCase().includes("job-title");
  }
  if (selector.includes("class*='company'")) {
    return (element.attrs.class || "").toLowerCase().includes("company");
  }
  return false;
}

function attrMatches(attrs: Record<string, string>, attr: string, selector: string) {
  const value = attrs[attr]?.toLowerCase() || "";
  const exact = selector.match(new RegExp(`${attr}=['"]([^'"]+)['"]`, "i"));
  if (exact) {
    return value === exact[1].toLowerCase();
  }
  const partial = selector.match(new RegExp(`${attr}\\*=['"]([^'"]+)['"]`, "i"));
  return partial ? value.includes(partial[1].toLowerCase()) : false;
}

function toElement(element: { attrs: Record<string, string>; text: string }) {
  return {
    getAttribute: (name: string) => element.attrs[name.toLowerCase()] || "",
    innerText: element.text,
    textContent: element.text
  };
}

function textFromMarkup(markup: string) {
  return markup
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h1|h2|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
