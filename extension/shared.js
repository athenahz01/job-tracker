(function attachShared(global) {
  const settingsKey = "jobTrackerSettings";
  const recentPostsKey = "jobTrackerRecentPosts";
  const recentWindowMs = 14 * 24 * 60 * 60 * 1000;

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  async function getSettings() {
    const result = await storageGet(settingsKey);
    return normalizeSettings(result[settingsKey]);
  }

  async function saveSettings(settings) {
    await storageSet({
      [settingsKey]: normalizeSettings(settings)
    });
  }

  function normalizeSettings(settings) {
    const apiBaseUrl = cleanApiBaseUrl(settings && settings.apiBaseUrl);
    const apiSecret = trimText(settings && settings.apiSecret);
    return { apiBaseUrl, apiSecret };
  }

  function settingsAreReady(settings) {
    return Boolean(settings && settings.apiBaseUrl && settings.apiSecret);
  }

  function cleanApiBaseUrl(value) {
    return trimText(value).replace(/\/+$/, "");
  }

  function trimText(value, maxLength) {
    if (typeof value !== "string") {
      return "";
    }
    const trimmed = value.replace(/\s+/g, " ").trim();
    return maxLength ? trimmed.slice(0, maxLength) : trimmed;
  }

  function cleanJobUrl(value) {
    if (!value) {
      return "";
    }

    try {
      const url = new URL(value);
      for (const key of Array.from(url.searchParams.keys())) {
        const normalized = key.toLowerCase();
        if (
          normalized.startsWith("utm_") ||
          ["fbclid", "gclid", "msclkid", "gh_src", "source", "ref"].includes(normalized)
        ) {
          url.searchParams.delete(key);
        }
      }
      url.hash = "";
      return url.toString();
    } catch {
      return trimText(value);
    }
  }

  async function getRecentPosts() {
    const result = await storageGet(recentPostsKey);
    const now = Date.now();
    const recent = result[recentPostsKey] || {};
    const cleaned = {};

    for (const [url, entry] of Object.entries(recent)) {
      const normalized = normalizeRecentPost(entry);
      if (normalized && now - normalized.timestamp < recentWindowMs) {
        cleaned[url] = normalized;
      }
    }

    await storageSet({ [recentPostsKey]: cleaned });
    return cleaned;
  }

  function normalizeRecentPost(entry) {
    if (typeof entry === "number") {
      return { timestamp: entry, stage: "" };
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const timestamp = Number(entry.timestamp);
    if (!Number.isFinite(timestamp)) {
      return null;
    }

    const stage = entry.stage === "Applied" || entry.stage === "Saved" ? entry.stage : "";
    return { timestamp, stage };
  }

  function recentPostCoversStage(entry, stage) {
    const normalized = normalizeRecentPost(entry);
    if (!normalized) {
      return false;
    }

    if (!normalized.stage) {
      return stage !== "Applied";
    }

    return normalized.stage === stage || normalized.stage === "Applied";
  }

  async function rememberPost(url, stage) {
    if (!url) {
      return;
    }

    const recent = await getRecentPosts();
    recent[url] = {
      timestamp: Date.now(),
      stage: stage === "Applied" ? "Applied" : "Saved"
    };
    await storageSet({ [recentPostsKey]: recent });
  }

  global.JobTrackerShared = {
    cleanApiBaseUrl,
    cleanJobUrl,
    getRecentPosts,
    getSettings,
    recentPostCoversStage,
    rememberPost,
    saveSettings,
    settingsAreReady,
    trimText
  };
})(globalThis);
