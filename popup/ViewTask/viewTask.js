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
      detailsContainerElement.nextSibling,
    );
  }

  function showError(container, title, message) {
    container.replaceChildren();
    const heading = document.createElement("h1");
    heading.className = "error-heading";
    heading.textContent = title;
    const paragraph = document.createElement("p");
    paragraph.textContent = message;
    const button = document.createElement("button");
    button.className = "btn2";
    button.textContent = "Go to Home";
    button.addEventListener("click", () => {
      window.location.href = "../popup.html";
    });
    container.appendChild(heading);
    container.appendChild(paragraph);
    container.appendChild(button);
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  if (!id) {
    if (detailsContainerElement) {
      showError(
        detailsContainerElement,
        "Error: No Task ID Provided",
        "Please navigate from your task list to view a specific task.",
      );
    }
    return;
  }

  getTaskById(id).then(async (task) => {
    const { pomodoro: storedPomodoroState } = await storageGet("pomodoro");

    if (!task || typeof task.name === "undefined") {
      if (detailsContainerElement) {
        showError(
          detailsContainerElement,
          "Error: Task Not Found",
          `The task could not be loaded. It may have been deleted.`,
        );
      }
      return;
    }

    const { name, description, due_date, priority, subtasks, subtaskError } =
      task;
    const subtasksPresent = !!subtasks && subtasks.length > 0;

    if (detailsContainerElement) {
      detailsContainerElement.replaceChildren();

      const title = document.createElement("h1");
      title.className = "title";
      title.textContent = `Task Name: ${name || "No Name"}`;

      const desc = document.createElement("h2");
      desc.className = "description";
      desc.textContent = `Task Description: ${description || "No Description"}`;

      detailsContainerElement.appendChild(title);
      detailsContainerElement.appendChild(desc);
    }

    if (optionsElement) {
      optionsElement.replaceChildren();

      const dueDateBtn = document.createElement("div");
      dueDateBtn.className = "btn";
      dueDateBtn.id = "dueDateBtn";

      const calendarIcon = document.createElement("img");
      calendarIcon.src = "../../assets/calendar-regular.svg";
      calendarIcon.alt = "Calendar";
      dueDateBtn.appendChild(calendarIcon);
      dueDateBtn.appendChild(document.createTextNode("Due date:"));

      const datePicker = document.createElement("div");
      datePicker.id = "datePicker";
      datePicker.className = "hidden";
      datePicker.textContent = due_date || "Not set";
      dueDateBtn.appendChild(datePicker);

      const priorityBtn = document.createElement("div");
      priorityBtn.className = "btn";
      priorityBtn.id = "priorityBtn";

      const flagIcon = document.createElement("img");
      flagIcon.src = "../../assets/flag-regular.svg";
      flagIcon.alt = "Priority";
      priorityBtn.appendChild(flagIcon);
      priorityBtn.appendChild(document.createTextNode("Priority: "));

      const prioritySpan = document.createElement("span");
      prioritySpan.id = "priority";
      prioritySpan.textContent = getPriorityLabel(priority);
      priorityBtn.appendChild(prioritySpan);

      optionsElement.appendChild(dueDateBtn);
      optionsElement.appendChild(priorityBtn);

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

    let subtaskChangeListener = null;

    function stopListeningForSubtaskUpdates() {
      if (subtaskChangeListener) {
        chrome.storage.onChanged.removeListener(subtaskChangeListener);
        subtaskChangeListener = null;
      }
    }

    function listenForSubtaskUpdates() {
      stopListeningForSubtaskUpdates();

      subtaskChangeListener = function storageChangeListener(changes, namespace) {
        if (namespace !== "local") return;

        const updated = findTaskInStorageChange(changes, id);
        if (!updated) return;

        if (updated.subtaskError) {
          showSubtaskErrorWithRetry(
            subtaskElement,
            updated.subtaskError,
            retrySubtasks,
          );
          stopListeningForSubtaskUpdates();
          return;
        }

        if (updated.subtasks && updated.subtasks.length > 0) {
          renderSubtasks(subtaskElement, updated.subtasks);
          stopListeningForSubtaskUpdates();
        }
      };

      chrome.storage.onChanged.addListener(subtaskChangeListener);
    }

    function retrySubtasks() {
      showSubtaskMessage(
        subtaskElement,
        "Generating subtasks with AI...",
        "no-subtasks-message",
      );
      chrome.runtime.sendMessage({
        id,
        name,
        description,
        type: "retrySubtasks",
      });
      listenForSubtaskUpdates();
    }

    function renderSubtaskSection() {
      if (!subtaskElement) return;

      if (subtaskError) {
        showSubtaskErrorWithRetry(subtaskElement, subtaskError, retrySubtasks);
        return;
      }

      if (subtasksPresent) {
        renderSubtasks(subtaskElement, subtasks);
        return;
      }

      showSubtaskMessage(
        subtaskElement,
        "Generating subtasks with AI...",
        "no-subtasks-message",
      );
      listenForSubtaskUpdates();
    }

    renderSubtaskSection();

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
          const elapsedSeconds = Math.floor(
            (now - currentPomodoro.startTime) / 1000,
          );
          const remaining = Math.max(0, currentDuration - elapsedSeconds);

          timerValueElement.textContent = formatTime(remaining);
          timerPhaseElement.textContent = `(${
            currentPomodoro.phase.charAt(0).toUpperCase() +
            currentPomodoro.phase.slice(1)
          }ing)`;

          if (remaining <= 0) {
            chrome.runtime.sendMessage({ type: "checkPomodoroPhase" });
            if (timerInterval) {
              clearInterval(timerInterval);
              timerInterval = null;
            }
          } else if (!timerInterval) {
            timerInterval = setInterval(updatePomodoroDisplayAndInterval, 1000);
          }
        } else {
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
      if (namespace !== "local") return;

      if (changes.pomodoro) {
        updatePomodoroDisplayAndInterval();
      }

      if (changes.pomodoro || changes.focusState) {
        chrome.storage.local.get("pomodoro", (result) => {
          const livePomodoro = result.pomodoro;
          const pomodoroActiveForThisTask =
            livePomodoro &&
            livePomodoro.isRunning &&
            livePomodoro.focusedTaskId === id;
          if (focusBtn) {
            focusBtn.textContent = pomodoroActiveForThisTask
              ? "Unfocus"
              : "Focus";
          }
        });
      }
    });

    if (focusBtn) {
      const pomodoroActiveOnLoad =
        storedPomodoroState &&
        storedPomodoroState.isRunning &&
        storedPomodoroState.focusedTaskId === id;

      focusBtn.textContent = pomodoroActiveOnLoad ? "Unfocus" : "Focus";
      let focusPending = false;

      focusBtn.addEventListener("click", () => {
        if (focusPending) return;
        focusPending = true;
        focusBtn.disabled = true;

        chrome.storage.local.get("pomodoro", (result) => {
          const livePomodoro = result.pomodoro;
          const pomodoroActiveForThisTask =
            livePomodoro &&
            livePomodoro.isRunning &&
            livePomodoro.focusedTaskId === id;
          const newFocusActive = !pomodoroActiveForThisTask;

          chrome.runtime.sendMessage(
            {
              id,
              name,
              description,
              type: "focus",
              newActiveState: newFocusActive,
            },
            () => {
              focusPending = false;
              focusBtn.disabled = false;
              if (chrome.runtime.lastError) {
                console.error(chrome.runtime.lastError);
                return;
              }
              focusBtn.textContent = newFocusActive ? "Unfocus" : "Focus";
              updatePomodoroDisplayAndInterval();
            },
          );
        });
      });
    }

    const deleteBtn = document.querySelector("#delete-btn");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", async () => {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        await stopFocusIfTaskActive(task);
        await deleteTaskById(id);
        window.location.href = "../popup.html";
      });
    }

    window.addEventListener("pagehide", () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    });
  });
});
