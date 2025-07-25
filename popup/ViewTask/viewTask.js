const taskListElement = document.querySelector("#task-list"); // This global variable seems unused within DOMContentLoaded

document.addEventListener("DOMContentLoaded", () => {
  const detailsContainerElement = document.querySelector(".details-container");
  const optionsElement = document.querySelector(".options-container");
  const subtaskElement = document.querySelector(".subtask-container");
  const focusBtn = document.querySelector("#focus-btn");

  const pomodoroTimerDisplay = document.createElement("div");
  pomodoroTimerDisplay.id = "pomodoro-timer-display";
  pomodoroTimerDisplay.innerHTML =
    '<span class="timer-value">--:--</span> <span class="timer-phase">(Not Active)</span>';
  pomodoroTimerDisplay.style.cssText = `
    margin-top: 20px;
    padding: 10px;
    background-color: #e0f7fa;
    border-left: 5px solid #00bcd4;
    border-radius: 5px;
    text-align: center;
    font-size: 1.2em;
    font-weight: bold;
    color: #00796b;
  `;
  if (detailsContainerElement) {
    detailsContainerElement.parentNode.insertBefore(
      pomodoroTimerDisplay,
      detailsContainerElement.nextSibling
    );
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    console.error("No task ID provided in URL. Cannot display task.");
    if (detailsContainerElement) {
      detailsContainerElement.innerHTML = `
        <h1 style="color: red;">Error: No Task ID Provided</h1>
        <p>Please navigate from your task list to view a specific task.</p>
        <button onclick="window.location.href='../popup.html'">Go to Home</button>
      `;
    }
    return;
  }

  // Fetch the task, focus state, AND pomodoro state
  chrome.storage.local.get([id, "focusState", "pomodoro"], (items) => {
    console.log(`Task id ${id}, focusState, and pomodoro retrieved:`, items);

    const task = items[id];
    const storedFocusState = items.focusState;
    const storedPomodoroState = items.pomodoro; // This will now include startTime

    if (!task || typeof task.name === "undefined") {
      console.error(
        `Item with ID "${id}" is not a valid task object or does not exist.`,
        task
      );
      if (detailsContainerElement) {
        detailsContainerElement.innerHTML = `
          <h1 style="color: red;">Error: Task Not Found or Invalid</h1>
          <p>The task with ID "${id}" could not be loaded. It might be deleted or an invalid ID was provided.</p>
          <button onclick="window.location.href='../popup.html'">Go to Home</button>
        `;
      }
      return;
    }

    const { name, description, due_date, priority, subtasks } = task;
    const subtasksPresent = !!subtasks && subtasks.length > 0;

    if (detailsContainerElement) {
      detailsContainerElement.innerHTML = `
            <h1 class="title">Task Name: ${name || "No Name"}</h1>
            <h2 class="description">Task Description: ${
              description || "No Description"
            }</h2>
        `;
    }

    if (optionsElement) {
      optionsElement.innerHTML = `
            <div class="btn" id="dueDateBtn">
                <img src="../../assets/calendar-regular.svg" alt="Calendar Icon" />Due date:
                <div id="datePicker" class="hidden">
                    ${due_date || "Not set"}
                </div>
            </div>

            <div class="btn" id="priorityBtn">
                <img src="../../assets/flag-regular.svg" alt="Flag Icon" />
                Priority: <span id="priority"> ${priority || "N/A"}</span>
            </div>
        `;

      const dueDateBtn = document.getElementById("dueDateBtn");
      const datePicker = document.getElementById("datePicker");
      if (dueDateBtn && datePicker) {
        dueDateBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          datePicker.classList.toggle("hidden");
        });
        document.addEventListener("click", (event) => {
          if (
            !dueDateBtn.contains(event.target) &&
            !datePicker.contains(event.target)
          ) {
            datePicker.classList.add("hidden");
          }
        });
      }
    }

    console.log("subtasks:", subtasks, "subtasksPresent:", subtasksPresent);

    if (subtaskElement) {
      if (subtasksPresent) {
        subtaskElement.innerHTML = `
                <h3 class="subtasks-heading">Actionable Subtasks:</h3>
                <ul class="subtask-list">
                    ${subtasks
                      .map(
                        (subtaskObject) =>
                          `<li>
                                    <h4 class="subtask-title">${
                                      subtaskObject.title || "Untitled Subtask"
                                    }</h4>
                                    <ul class="subtask-tips">
                                        ${
                                          subtaskObject.tips &&
                                          subtaskObject.tips.length > 0
                                            ? subtaskObject.tips
                                                .map(
                                                  (tip) =>
                                                    `<li>${
                                                      tip || "No tip provided"
                                                    }</li>`
                                                )
                                                .join("")
                                            : "<li>No tips available.</li>"
                                        }
                                    </ul>
                                </li>`
                      )
                      .join("")}
                </ul>
            `;
      } else {
        subtaskElement.innerHTML = `<p class="no-subtasks-message">No subtasks generated yet. AI is working on it, or this task doesn't require breakdown.</p>`;
        console.log("listening for changes");

        chrome.storage.onChanged.addListener(function storageChangeListener(
          changes,
          namespace
        ) {
          if (namespace === "local" && changes[id]) {
            const storageChange = changes[id];
            if (
              storageChange.newValue &&
              storageChange.newValue.subtasks &&
              storageChange.newValue.subtasks.length > 0
            ) {
              console.log(
                `Subtasks for id "${id}" were updated. New value:`,
                storageChange.newValue.subtasks
              );

              const newSubtasks = storageChange.newValue.subtasks;

              subtaskElement.innerHTML = `
                            <h3 class="subtasks-heading">Actionable Subtasks:</h3>
                            <ul class="subtask-list">
                                ${newSubtasks
                                  .map(
                                    (subtaskObject) =>
                                      `<li>
                                            <h4 class="subtask-title">${
                                              subtaskObject.title ||
                                              "Untitled Subtask"
                                            }</h4>
                                            <ul class="subtask-tips">
                                                ${
                                                  subtaskObject.tips &&
                                                  subtaskObject.tips.length > 0
                                                    ? subtaskObject.tips
                                                        .map(
                                                          (tip) =>
                                                            `<li>${
                                                              tip ||
                                                              "No tip provided"
                                                            }</li>`
                                                        )
                                                        .join("")
                                                    : "<li>No tips available.</li>"
                                                }
                                            </ul>
                                        </li>`
                                  )
                                  .join("")}
                            </ul>
                        `;
            }
          }
        });
      }
    } else {
      console.warn(
        "Subtask container (.subtask-container) not found in viewTask.html"
      );
    }

    // --- POMODORO TIMER DISPLAY LOGIC ---
    let timerInterval = null;

    function formatTime(seconds) {
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }

    function updatePomodoroDisplayAndInterval() {
      chrome.storage.local.get("pomodoro", (result) => {
        const currentPomodoro = result.pomodoro;
        const timerValueElement =
          pomodoroTimerDisplay.querySelector(".timer-value");
        const timerPhaseElement =
          pomodoroTimerDisplay.querySelector(".timer-phase");

        // Ensure currentPomodoro and its properties are valid
        if (
          currentPomodoro &&
          currentPomodoro.isRunning &&
          currentPomodoro.focusedTaskId === id &&
          typeof currentPomodoro.startTime === "number"
        ) {
          const now = Date.now();
          const currentDuration =
            currentPomodoro.phase === "work"
              ? currentPomodoro.workDuration
              : currentPomodoro.breakDuration;
          // Use the exact start time to calculate elapsed, then remaining
          const elapsedSeconds = Math.floor(
            (now - currentPomodoro.startTime) / 1000
          );
          let remaining = Math.max(0, currentDuration - elapsedSeconds);

          timerValueElement.textContent = formatTime(remaining);
          timerPhaseElement.textContent = `(${
            currentPomodoro.phase.charAt(0).toUpperCase() +
            currentPomodoro.phase.slice(1)
          }ing)`;

          if (remaining <= 0) {
            console.log(
              "Time up for current phase in viewTask.js, notifying background script."
            );
            chrome.runtime.sendMessage({ type: "checkPomodoroPhase" });
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
          } else if (!timerInterval) {
            // If time > 0 but interval not running, start it
            timerInterval = setInterval(updatePomodoroDisplayAndInterval, 1000);
          }
        } else {
          // Pomodoro is not running for this task, or state is invalid
          timerValueElement.textContent = "--:--";
          timerPhaseElement.textContent =
            currentPomodoro && currentPomodoro.isRunning
              ? "(Other Task Focused)"
              : "(Not Active)";
          if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
          }
        }
      });
    }

    updatePomodoroDisplayAndInterval();

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === "local" && changes.pomodoro) {
        console.log("Pomodoro state changed in storage, updating UI.");
        updatePomodoroDisplayAndInterval();
      }
    });

    // --- FOCUS BUTTON LOGIC ---
    if (focusBtn) {
      const isCurrentlyFocused =
        storedFocusState &&
        storedFocusState.active &&
        storedFocusState.id === id;
      // Also check if pomodoroState exists and startTime is a number
      const isPomodoroRunningForThisTask =
        storedPomodoroState &&
        storedPomodoroState.isRunning &&
        storedPomodoroState.focusedTaskId === id &&
        typeof storedPomodoroState.startTime === "number";

      if (isCurrentlyFocused && isPomodoroRunningForThisTask) {
        focusBtn.innerText = "Unfocus";
      } else {
        focusBtn.innerText = "Focus";
      }

      focusBtn.addEventListener("click", (e) => {
        const newFocusActive = focusBtn.innerText === "Focus";

        chrome.runtime.sendMessage({
          id,
          name,
          description,
          type: "focus",
          newActiveState: newFocusActive,
        });

        focusBtn.innerText = newFocusActive ? "Unfocus" : "Focus";
      });
    } else {
      console.warn("Focus button (#focus-btn) not found in viewTask.html");
    }

    window.addEventListener("pagehide", () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        console.log("Pomodoro timer interval cleared on pagehide.");
      }
    });
  });
});
