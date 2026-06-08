(function attachScraper(global) {
  const shared = global.JobTrackerShared;

  function scrapeCurrentPage() {
    const url = shared.cleanJobUrl(location.href);
    const ats = detectAts();
    const bodyText = document.body ? document.body.innerText : "";
    const role = findRole();
    const company = findCompany(ats);
    const description = findDescription();
    const confirmation = Boolean(ats && hasConfirmationSignal(bodyText, ats));
    const genericSubmitted = Boolean(!ats && hasConfirmationSignal(bodyText, "generic"));

    return {
      ats,
      company,
      role,
      url,
      notes: description,
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

  function findRole() {
    const candidates = [
      "[data-testid='job-title']",
      "[data-qa='job-title']",
      ".job-title",
      ".posting-headline h2",
      ".app-title",
      "main h1",
      "h1"
    ];
    return firstVisibleText(candidates, 180) || cleanTitle(document.title);
  }

  function findCompany(ats) {
    const fromUrl = companyFromUrl(ats);
    if (fromUrl) {
      return fromUrl;
    }

    const selectors = [
      "[data-testid='company-name']",
      "[data-qa='company-name']",
      ".company-name",
      ".posting-company",
      ".header-company",
      ".app-title"
    ];
    return (
      firstVisibleText(selectors, 140) ||
      metaContent("og:site_name") ||
      metaContent("application-name")
    );
  }

  function companyFromUrl(ats) {
    const host = location.hostname.toLowerCase();
    const pathParts = location.pathname.split("/").filter(Boolean);

    if ((ats === "greenhouse" || ats === "lever") && pathParts[0]) {
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
      ".job-description",
      ".job__description",
      ".posting-page",
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
      const element = document.querySelector(selector);
      if (!element) {
        continue;
      }
      const text = shared.trimText(element.innerText || element.textContent || "", maxLength);
      if (text) {
        return text;
      }
    }
    return "";
  }

  function metaContent(name) {
    const selector = `meta[property='${name}'], meta[name='${name}']`;
    const element = document.querySelector(selector);
    return element ? shared.trimText(element.getAttribute("content") || "", 140) : "";
  }

  function cleanTitle(title) {
    const parts = title.split(/\s+[|-]\s+/).map((part) => shared.trimText(part));
    return parts[0] || shared.trimText(title, 180);
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
