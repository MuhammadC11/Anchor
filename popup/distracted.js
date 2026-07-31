const QUIPS = [
  "Caught in the web of distraction.",
  "Scroll of shame...",
  "Top 10 browser betrayals",
  "...How did we even get here?",
  "Succumbed to temptation.",
  "Side eye.",
  "EMERGENCY MEETING!! We caught u lacking.",
];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("random-sentence").textContent =
    QUIPS[Math.floor(Math.random() * QUIPS.length)];

  chrome.storage.local.get("focusState", (result) => {
    const focus = result.focusState;
    const taskNameEl = document.getElementById("task-name");
    const viewTaskBtn = document.getElementById("view-task-btn");

    if (focus?.name) {
      taskNameEl.textContent = `You were working on: ${focus.name}`;
    } else {
      taskNameEl.textContent = "Time to refocus.";
    }

    if (focus?.id) {
      viewTaskBtn.hidden = false;
      viewTaskBtn.addEventListener("click", () => {
        window.location.href = chrome.runtime.getURL(
          `popup/ViewTask/viewTask.html?id=${encodeURIComponent(focus.id)}`,
        );
      });
    }
  });

  document.getElementById("resume-btn").addEventListener("click", () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  });
});
