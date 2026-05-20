document.addEventListener("DOMContentLoaded", () => {
  const workInput = document.getElementById("workDuration");
  const breakInput = document.getElementById("breakDuration");
  const saveBtn = document.getElementById("saveSettings");
  const confirm = document.getElementById("saveConfirm");

  // Load existing settings
  chrome.storage.local.get("pomodoroSettings", (result) => {
    if (result.pomodoroSettings) {
      workInput.value = result.pomodoroSettings.workDuration / 60;
      breakInput.value = result.pomodoroSettings.breakDuration / 60;
    }
  });

  saveBtn.addEventListener("click", () => {
    const workMins = parseInt(workInput.value);
    const breakMins = parseInt(breakInput.value);

    if (isNaN(workMins) || isNaN(breakMins) || workMins < 1 || breakMins < 1) {
      alert("Please enter valid durations.");
      return;
    }

    chrome.storage.local.set(
      {
        pomodoroSettings: {
          workDuration: workMins * 60,
          breakDuration: breakMins * 60,
        },
      },
      () => {
        confirm.style.display = "block";
        setTimeout(() => (confirm.style.display = "none"), 2000);
      },
    );
  });
});
