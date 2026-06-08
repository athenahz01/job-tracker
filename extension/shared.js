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

    for (const [url, timestamp] of Object.entries(recent)) {
      if (typeof timestamp === "number" && now - timestamp < recentWindowMs) {
        cleaned[url] = timestamp;
      }
    }

    await storageSet({ [recentPostsKey]: cleaned });
    return cleaned;
  }

  async function rememberPost(url) {
    if (!url) {
      return;
    }

    const recent = await getRecentPosts();
    recent[url] = Date.now();
    await storageSet({ [recentPostsKey]: recent });
  }

  global.JobTrackerShared = {
    cleanApiBaseUrl,
    cleanJobUrl,
    getRecentPosts,
    getSettings,
    rememberPost,
    saveSettings,
    settingsAreReady,
    trimText
  };
})(globalThis);
