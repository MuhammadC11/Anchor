const taskListElement = document.querySelector("#task-list");

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".details-container");
  const optionsElement = document.querySelector(".options-container");
  const subtaskElement = document.querySelector(".subtask-container");

  const params = new URLSearchParams(window.location.search); // Get URL parameters
  const id = params.get("id"); // Get the task ID from the URL parameters

  let subtasksPresent = false; // Flag to check if subtasks are present

  chrome.storage.local.get(id, (task) => {
    console.log(`task id ${id} retrieved:`, task); // Log the retrieved task

    const { name, description, due_date, priority, subtasks } = task[id]; // Destructure the task object to get its properties

    subtasksPresent = !!subtasks && subtasks.length > 0; // Check if subtasks are present and not empty

    taskListElement.insertAdjacentHTML(
      "beforeend",
      `<div class="details-container">
        <h1 class="title">Task Name: ${name}</h1>
        <h2 class="description">Task Description: ${description}</h2>
      </div>`
    );

    optionsElement.insertAdjacentHTML(
      "beforeend",
      `<div class="btn" id="dueDateBtn">
          <img src="../../assets/calendar-regular.svg" alt="Calendar Icon" />Due date:
          <div id="datePicker" class="hidden">
            ${due_date || "Not set"} </div>
        </div>

        <div class="btn" id="priorityBtn">
          <img src="../../assets/flag-regular.svg" alt="Flag Icon" />
          Priority: <span id="priority"> ${priority || "N/A"}</span>
        </div>`
    );

    console.log("subtasks:", subtasks, "subtasksPresent:", subtasksPresent);

    if (subtasksPresent) {
      subtaskElement.insertAdjacentHTML(
        "beforeend",
        `<h3 class="subtasks-heading">Actionable Subtasks:</h3>
        <ul class="subtask-list"> ${subtasks // This is an array of objects: [{title: "...", tips: [...]}, ...]
          .map(
            (subtaskObject) =>
              `<li>
                  <h4 class="subtask-title">${subtaskObject.title}</h4>
                  <ul class="subtask-tips">
                    ${subtaskObject.tips // This is the array of tips
                      .map((tip) => `<li>${tip}</li>`)
                      .join("")}
                  </ul>
                </li>`
          )
          .join("")}
        </ul>`
      );
    } else {
      // listen for when subtasks are added
      console.log("listening for changes");

      // We need to keep track of the listener to avoid adding it multiple times
      // and potentially handle specific updates for this task ID.
      // For simplicity in this example, we'll re-fetch and re-render.
      // In a more complex app, you might want to specifically update only the subtasks.

      // Remove any existing listener for this specific task ID to prevent duplicates
      // (This requires careful management if you have many listeners.
      // A better approach might be to use a single listener that dispatches to specific handlers.)
      // For now, we'll assume the listener is added once per task view.

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

            // Fetch the subtasks from the new value directly or from storage
            // Using newValue directly is more efficient here
            const newSubtasks = storageChange.newValue.subtasks;

            // Clear existing subtasks before adding new ones if the element exists
            subtaskElement.innerHTML = ""; // Clear existing content

            subtaskElement.insertAdjacentHTML(
              "beforeend",
              `<h3 class="subtasks-heading">Actionable Subtasks:</h3>
              <ul class="subtask-list">
                ${newSubtasks
                  .map(
                    (subtaskObject) =>
                      `<li>
                        <h4 class="subtask-title">${subtaskObject.title}</h4>
                        <ul class="subtask-tips">
                          ${subtaskObject.tips
                            .map((tip) => `<li>${tip}</li>`)
                            .join("")}
                        </ul>
                      </li>`
                  )
                  .join("")}
              </ul>`
            );

            // Optional: Remove the listener once subtasks are loaded
            // This prevents it from firing unnecessarily for other changes or if the user leaves this page
            // chrome.storage.onChanged.removeListener(storageChangeListener);
          }
        }
      });
    }

    // focus button
    const focusBtn = document.querySelector("#focus-btn");
    if (focusBtn) {
      // Ensure button exists before adding listener
      focusBtn.addEventListener("click", (e) => {
        chrome.runtime.sendMessage({
          id,
          name,
          description,
          type: "focus",
        });

        // Toggle the button text between "Focus" and "Unfocus"
        if (focusBtn.innerText === "Focus") {
          focusBtn.innerText = "Unfocus";
        } else {
          focusBtn.innerText = "Focus";
        }
      });
    } else {
      console.warn("Focus button (#focus-btn) not found in viewTask.html");
    }
  });
});
