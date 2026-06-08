(function runOptions() {
  const shared = window.JobTrackerShared;
  const form = document.getElementById("options-form");
  const apiBaseUrl = document.getElementById("api-base-url");
  const apiSecret = document.getElementById("api-secret");
  const status = document.getElementById("status");

  init();

  async function init() {
    const settings = await shared.getSettings();
    apiBaseUrl.value = settings.apiBaseUrl || "";
    apiSecret.value = settings.apiSecret || "";
    form.addEventListener("submit", saveOptions);
  }

  async function saveOptions(event) {
    event.preventDefault();
    await shared.saveSettings({
      apiBaseUrl: apiBaseUrl.value,
      apiSecret: apiSecret.value
    });
    status.textContent = "Options saved.";
  }
})();
