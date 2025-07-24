const taskListElement = document.querySelector("#task-list"); // This global variable seems unused within DOMContentLoaded

document.addEventListener("DOMContentLoaded", () => {
  const detailsContainerElement = document.querySelector(".details-container"); // Corrected variable name
  const optionsElement = document.querySelector(".options-container");
  const subtaskElement = document.querySelector(".subtask-container");
  const focusBtn = document.querySelector("#focus-btn"); // Get focus button early

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  // --- IMPORTANT NEW VALIDATION (from previous fix) ---
  if (!id) {
    console.error("No task ID provided in URL. Cannot display task.");
    if (detailsContainerElement) {
      detailsContainerElement.innerHTML = `
        <h1 style="color: red;">Error: No Task ID Provided</h1>
        <p>Please navigate from your task list to view a specific task.</p>
        <button onclick="window.location.href='../popup.html'">Go to Home</button>
      `;
    }
    return; // Stop execution if no ID
  }

  // Fetch the item from storage using the ID and the global focus state
  // We need to fetch both the specific task AND the 'focus' state
  chrome.storage.local.get([id, "focusState"], (items) => {
    // Fetch both keys
    console.log(`Task id ${id} and focusState retrieved:`, items);

    const task = items[id];
    const storedFocusState = items.focusState; // Retrieve the stored focus state

    // --- IMPORTANT NEW VALIDATION (from previous fix) ---
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

    // Render task details
    if (detailsContainerElement) {
      detailsContainerElement.innerHTML = `
            <h1 class="title">Task Name: ${name || "No Name"}</h1>
            <h2 class="description">Task Description: ${
              description || "No Description"
            }</h2>
        `;
    }

    // Render options
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

      // Add event listener for date picker toggle (from previous advice)
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

    // Render subtasks
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

    // --- FOCUS BUTTON LOGIC ---
    if (focusBtn) {
      // Set initial button text based on stored focus state
      // 'focusState' will be an object { active: boolean, id: string }
      if (
        storedFocusState &&
        storedFocusState.active &&
        storedFocusState.id === id
      ) {
        focusBtn.innerText = "Unfocus";
      } else {
        focusBtn.innerText = "Focus";
      }

      focusBtn.addEventListener("click", (e) => {
        // Toggle focus state and update button text
        const newFocusActive = focusBtn.innerText === "Focus"; // If it says "Focus", it's about to become active

        chrome.runtime.sendMessage({
          id,
          name,
          description,
          type: "focus",
          // Send the desired new active state to background.js
          newActiveState: newFocusActive,
        });

        // Update button text immediately
        focusBtn.innerText = newFocusActive ? "Unfocus" : "Focus";

        // Store the new focus state in chrome.storage.local
        // The background script will manage its 'focus' object, but viewTask needs to know for its UI
        chrome.storage.local.set(
          {
            focusState: {
              active: newFocusActive,
              id: newFocusActive ? id : null, // If unfocusing, set id to null
              name: newFocusActive ? name : null,
              description: newFocusActive ? description : null,
            },
          },
          () => {
            console.log("Focus state saved:", {
              active: newFocusActive,
              id: newFocusActive ? id : null,
            });
            alert(
              `${
                newFocusActive
                  ? "Focus mode activated"
                  : "Focus mode deactivated"
              } for task: "${name}"`
            );
          }
        );
      });
    } else {
      console.warn("Focus button (#focus-btn) not found in viewTask.html");
    }
  });
});
