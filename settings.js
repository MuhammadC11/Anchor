document.addEventListener("DOMContentLoaded", () => {
  const workInput = document.getElementById("workDuration");
  const breakInput = document.getElementById("breakDuration");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("saveSettings");
  const confirm = document.getElementById("saveConfirm");

  chrome.storage.local.get(["pomodoroSettings", "apiKey"], (result) => {
    if (result.pomodoroSettings) {
      workInput.value = result.pomodoroSettings.workDuration / 60;
      breakInput.value = result.pomodoroSettings.breakDuration / 60;
    }
    if (result.apiKey) {
      apiKeyInput.value = result.apiKey;
    }
  });

  saveBtn.addEventListener("click", () => {
    const workMins = parseInt(workInput.value, 10);
    const breakMins = parseInt(breakInput.value, 10);
    const apiKey = apiKeyInput.value.trim();

    if (isNaN(workMins) || isNaN(breakMins) || workMins < 1 || breakMins < 1) {
      alert("Please enter valid Pomodoro durations (at least 1 minute each).");
      return;
    }

    if (!apiKey) {
      alert("Please enter your Gemini API key.");
      return;
    }

    chrome.storage.local.set(
      {
        pomodoroSettings: {
          workDuration: workMins * 60,
          breakDuration: breakMins * 60,
        },
        apiKey,
      },
      () => {
        confirm.textContent = "Settings saved!";
        confirm.style.display = "block";
        setTimeout(() => {
          confirm.style.display = "none";
        }, 2000);
      },
    );
  });
});
