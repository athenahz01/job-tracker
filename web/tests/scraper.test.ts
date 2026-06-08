import { readFileSync } from "fs";
import { Script, createContext } from "vm";
import { describe, expect, it } from "vitest";

const sharedSource = readFileSync("../extension/shared.js", "utf8");
const scraperSource = readFileSync("../extension/scraper.js", "utf8");

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
            <p>Contract role</p>
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
