(function attachScraper(global) {
  const shared = global.JobTrackerShared;

  function scrapeCurrentPage() {
    const url = shared.cleanJobUrl(location.href);
    const ats = detectAts();
    const bodyText = document.body ? document.body.innerText : "";
    const role = findRole(ats);
    const company = findCompany(ats, role);
    const description = findDescription();
    const salary = findSalary(bodyText);
    const jobLocation = findLocation(bodyText);
    const confirmation = Boolean(ats && hasConfirmationSignal(bodyText, ats));
    const genericSubmitted = Boolean(!ats && hasConfirmationSignal(bodyText, "generic"));

    return {
      ats,
      company,
      role,
      url,
      notes: description,
      salary,
      location: jobLocation,
      tags: [],
      confirmation,
      genericSubmitted
    };
  }

  function detectAts() {
    const host = location.hostname.toLowerCase();
    if (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") {
      return "greenhouse";
    }
    if (host === "jobs.lever.co") {
      return "lever";
    }
    if (host.endsWith(".ashbyhq.com")) {
      return "ashby";
    }
    if (host.includes("myworkdayjobs.com")) {
      return "workday";
    }
    return "";
  }

  function findRole(ats) {
    const selectorsByAts = {
      greenhouse: [
        "[data-mapped='title']",
        ".app-title",
        ".job__title",
        ".job-title",
        "main h1",
        "h1"
      ],
      lever: [
        ".posting-headline h2",
        ".posting-headline h1",
        "[data-qa='posting-name']",
        "main h1",
        "h1"
      ],
      ashby: [
        "[data-testid='job-title']",
        "[class*='JobPostingTitle']",
        "main h1",
        "h1"
      ],
      workday: [
        "[data-automation-id='jobPostingHeader']",
        "[data-automation-id='jobTitle']",
        "main h1",
        "h1"
      ]
    };
    const candidates = [
      ...(selectorsByAts[ats] || []),
      "[data-testid='job-title']",
      "[data-qa='job-title']",
      "[data-automation-id*='jobTitle']",
      "[class*='job-title']",
      "[class*='JobTitle']",
      ".job-title",
      ".posting-headline h2",
      ".app-title",
      "main h1",
      "article h1",
      "h1"
    ];
    return (
      firstVisibleText(candidates, 180) ||
      metaContent("og:title", 180) ||
      roleFromTitle(document.title) ||
      cleanTitle(document.title)
    );
  }

  function findCompany(ats, role) {
    const fromUrl = companyFromUrl(ats);
    if (fromUrl) {
      return fromUrl;
    }

    const selectorsByAts = {
      greenhouse: [
        ".company-name",
        ".app-title + div",
        ".job__company",
        "[data-mapped='company']"
      ],
      lever: [
        ".main-header-logo img",
        ".posting-company",
        ".posting-headline .sort-by-time"
      ],
      ashby: [
        "[data-testid='company-name']",
        "[class*='CompanyName']",
        "header a[href='/']"
      ],
      workday: [
        "[data-automation-id='jobPostingCompany']",
        "[data-automation-id='company']"
      ]
    };
    const selectorText = firstVisibleText(
      [
        ...(selectorsByAts[ats] || []),
        "[data-testid='company-name']",
        "[data-qa='company-name']",
        "[data-automation-id*='company']",
        ".company-name",
        ".posting-company",
        ".header-company",
        "[class*='company']",
        "[class*='Company']"
      ],
      140
    );
    return (
      cleanCompany(selectorText, role) ||
      metaContent("og:site_name", 140) ||
      metaContent("application-name", 140) ||
      companyFromTitle(document.title, role)
    );
  }

  function companyFromUrl(ats) {
    const host = location.hostname.toLowerCase();
    const pathParts = location.pathname.split("/").filter(Boolean);

    if (ats === "greenhouse") {
      const fromQuery = new URLSearchParams(location.search).get("for");
      if (fromQuery) {
        return humanizeSlug(fromQuery);
      }
      if (pathParts[0] && !["embed", "job_app"].includes(pathParts[0])) {
        return humanizeSlug(pathParts[0]);
      }
    }

    if (ats === "lever" && pathParts[0]) {
      return humanizeSlug(pathParts[0]);
    }

    if (ats === "ashby") {
      const tenant = host.split(".")[0];
      if (tenant && tenant !== "jobs" && tenant !== "job-boards") {
        return humanizeSlug(tenant);
      }
      if (pathParts[0]) {
        return humanizeSlug(pathParts[0]);
      }
      return "";
    }

    if (ats === "workday") {
      const tenant = host.split(".")[0];
      return tenant ? humanizeSlug(tenant) : "";
    }

    return "";
  }

  function findDescription() {
    const selectors = [
      "[data-testid='job-description']",
      "[data-qa='job-description']",
      "[data-automation-id='jobPostingDescription']",
      ".job-description",
      ".job__description",
      ".posting-page",
      ".posting",
      "#content",
      "main",
      "article"
    ];
    const description = firstVisibleText(selectors, 9000);
    if (description) {
      return description;
    }

    return shared.trimText(document.body ? document.body.innerText : "", 9000);
  }

  function findSalary(bodyText) {
    return (
      firstVisibleText(
        [
          "[data-testid*='salary' i]",
          "[data-testid*='compensation' i]",
          "[data-qa*='salary' i]",
          "[data-qa*='compensation' i]",
          "[data-automation-id*='compensation' i]",
          "[data-automation-id*='salary' i]",
          "[class*='salary' i]",
          "[class*='compensation' i]",
          "[class*='pay' i]"
        ],
        160
      ) ||
      labelValue(bodyText, ["compensation", "salary", "pay range", "pay", "base pay"], 160) ||
      payRangeFromText(bodyText)
    );
  }

  function findLocation(bodyText) {
    const value =
      firstVisibleText(
        [
          "[data-testid*='location' i]",
          "[data-testid*='workplace' i]",
          "[data-qa*='location' i]",
          "[data-qa*='workplace' i]",
          "[data-automation-id='locations']",
          "[data-automation-id*='location' i]",
          "[class*='location' i]",
          "[class*='workplace' i]",
          ".posting-categories .location"
        ],
        180
      ) ||
      labelValue(bodyText, ["location", "locations", "workplace", "office"], 180) ||
      remoteFromText(bodyText);

    return cleanLocation(value);
  }

  function hasConfirmationSignal(text, ats) {
    const normalized = shared.trimText(text).toLowerCase();
    if (!normalized) {
      return false;
    }

    const confirmationPatterns = [
      "thank you for applying",
      "thanks for applying",
      "application received",
      "application submitted",
      "application has been submitted",
      "your application was submitted",
      "your application has been submitted",
      "we have received your application",
      "you have successfully submitted your application"
    ];
    const hasTextSignal = confirmationPatterns.some((pattern) =>
      normalized.includes(pattern)
    );

    if (!hasTextSignal) {
      return false;
    }

    const path = location.pathname.toLowerCase();
    if (ats === "generic") {
      return true;
    }

    return (
      path.includes("confirmation") ||
      path.includes("thank") ||
      path.includes("apply") ||
      path.includes("application") ||
      path.includes("submit")
    );
  }

  function firstVisibleText(selectors, maxLength) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector)).slice(0, 4);
      for (const element of elements) {
        const text = textFromElement(element, maxLength);
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  function textFromElement(element, maxLength) {
    if (!element) {
      return "";
    }

    const attrText =
      element.getAttribute("aria-label") ||
      element.getAttribute("alt") ||
      element.getAttribute("title") ||
      "";
    const text = shared.trimText(
      attrText || element.innerText || element.textContent || "",
      maxLength
    );
    if (!text) {
      return "";
    }

    return cleanLabeledText(text, maxLength);
  }

  function labelValue(text, labels, maxLength) {
    const lines = text
      .split(/\n+/)
      .map((line) => shared.trimText(line, maxLength))
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lower = line.toLowerCase();
      const label = labels.find((item) => lower === item || lower.startsWith(`${item}:`));
      if (!label) {
        continue;
      }

      const afterLabel = line.slice(label.length).replace(/^[:\s]+/, "");
      if (afterLabel) {
        return shared.trimText(afterLabel, maxLength);
      }

      const next = lines[index + 1] || "";
      if (next && next.length <= maxLength) {
        return shared.trimText(next, maxLength);
      }
    }

    return "";
  }

  function payRangeFromText(text) {
    const normalized = shared.trimText(text, 20000);
    const rangePattern =
      /(?:USD\s*)?\$\s?\d{2,3}(?:,\d{3})?(?:\.\d+)?\s?(?:k|K)?\s?(?:-|to)\s?(?:USD\s*)?\$?\s?\d{2,3}(?:,\d{3})?(?:\.\d+)?\s?(?:k|K)?(?:\s?(?:\/|per)\s?(?:year|yr|hour|hr|annum))?/;
    const singlePattern =
      /(?:USD\s*)?\$\s?\d{2,3}(?:,\d{3})?(?:\.\d+)?\s?(?:k|K)?(?:\s?(?:\/|per)\s?(?:year|yr|hour|hr|annum))/;
    const match = normalized.match(rangePattern) || normalized.match(singlePattern);
    return match ? shared.trimText(match[0], 160) : "";
  }

  function remoteFromText(text) {
    const normalized = shared.trimText(text, 20000).toLowerCase();
    if (/\bremote\b/.test(normalized)) {
      return "Remote";
    }
    if (/\bhybrid\b/.test(normalized)) {
      return "Hybrid";
    }
    return "";
  }

  function metaContent(name, maxLength) {
    const selector = `meta[property='${name}'], meta[name='${name}']`;
    const element = document.querySelector(selector);
    return element ? shared.trimText(element.getAttribute("content") || "", maxLength) : "";
  }

  function cleanTitle(title) {
    const parts = title.split(/\s+[|-]\s+/).map((part) => shared.trimText(part));
    return parts[0] || shared.trimText(title, 180);
  }

  function roleFromTitle(title) {
    const parts = title.split(/\s+[|-]\s+/).map((part) => shared.trimText(part, 180));
    if (parts.length > 1) {
      return parts[0];
    }
    const atParts = title.split(/\s+at\s+/i).map((part) => shared.trimText(part, 180));
    return atParts.length > 1 ? atParts[0] : "";
  }

  function companyFromTitle(title, role) {
    const cleanedTitle = shared.trimText(title, 220);
    const atParts = cleanedTitle.split(/\s+at\s+/i).map((part) => shared.trimText(part, 140));
    if (atParts.length > 1) {
      return cleanCompany(atParts[1], role);
    }

    const parts = cleanedTitle.split(/\s+[|-]\s+/).map((part) => shared.trimText(part, 140));
    const candidate = parts.find((part) => part && part !== role && !/jobs?|careers?/i.test(part));
    return cleanCompany(candidate || "", role);
  }

  function cleanCompany(value, role) {
    const text = shared
      .trimText(value, 140)
      .replace(/\bcareers?\b/gi, "")
      .replace(/\bjobs?\b/gi, "")
      .replace(/\bopenings?\b/gi, "")
      .trim();
    if (!text || text === role) {
      return "";
    }
    return text;
  }

  function cleanLocation(value) {
    return shared
      .trimText(value, 180)
      .replace(/^locations?:\s*/i, "")
      .replace(/^workplace:\s*/i, "")
      .replace(/^office:\s*/i, "")
      .trim();
  }

  function cleanLabeledText(value, maxLength) {
    return shared
      .trimText(value, maxLength)
      .replace(/^(compensation|salary|pay range|pay|location|locations|workplace|office):\s*/i, "")
      .trim();
  }

  function humanizeSlug(value) {
    return shared
      .trimText(value.replace(/[-_]+/g, " "), 140)
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  global.JobTrackerScraper = {
    scrapeCurrentPage
  };
})(globalThis);
