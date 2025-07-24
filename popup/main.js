// This file will only have access to the pop up extensions DOM

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");

  // Function to display tasks (now separated for reusability)
  function displayTasks() {
    if (!taskListElement) {
      console.error("taskListElement (.taskList) not found in popup.html.");
      return;
    }

    taskListElement.innerHTML = ""; // Clear existing tasks before re-rendering

    chrome.storage.local.get(null, (items) => {
      // Get ALL items from storage
      console.log("All items retrieved from storage:", items);

      let tasksFound = false;

      // Iterate over all keys in storage
      for (const id in items) {
        // --- CRITICAL FILTERING STEP ---
        // Skip the API key AND the focusState, and any other non-task specific data
        if (
          id === "apiKey" ||
          id === "focusState" ||
          id === "pomodoroState" ||
          id === "pomodoro"
        ) {
          // <-- ADDED 'focusState' HERE
          console.log(`Skipping non-task item: ${id}`);
          continue; // Skip to the next item
        }

        const task = items[id];

        // --- VALIDATION: Ensure it's a valid task object ---
        if (task && typeof task === "object" && task.name && task.description) {
          tasksFound = true;
          // Append the task to the list
          taskListElement.insertAdjacentHTML(
            "beforeend",
            `<a class="taskNames" href="./ViewTask/viewTask.html?id=${id}" id="task-${id}">
              ${task.name}
            </a>`
          );
        } else {
          console.warn(
            `Skipping malformed or non-task item with key: ${id}`,
            task
          );
        }
      }

      if (!tasksFound) {
        taskListElement.insertAdjacentHTML(
          "beforeend",
          '<p class="no-tasks-message">No tasks found. Click "Add Task" to get started!</p>'
        );
      }

      // No changes needed for delete button listeners as they are not in the provided snippet
      // If you add individual delete buttons in popup.html later, remember to add their listeners here.
    });
  }

  // Initial call to display tasks when the popup loads
  displayTasks();

  // --- Clear all tasks button logic ---
  var clearTasksElement = document.getElementById("clearTasks");
  if (clearTasksElement) {
    clearTasksElement.addEventListener("click", function () {
      if (
        !confirm(
          "Are you sure you want to clear ALL your tasks? This will NOT delete your API key or focus state."
        )
      ) {
        // Updated confirmation message
        return; // User cancelled
      }

      chrome.storage.local.get(null, (items) => {
        // Get all items
        if (chrome.runtime.lastError) {
          console.error(
            "Error retrieving all items for clearing:",
            chrome.runtime.lastError
          );
          return;
        }

        const keysToRemove = [];
        for (let key in items) {
          // --- CRITICAL FILTERING STEP ---
          // Add key to list ONLY if it's NOT the API key AND NOT the focusState
          if (key !== "apiKey" && key !== "focusState") {
            // <-- ADDED 'focusState' HERE
            keysToRemove.push(key);
          }
        }

        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              console.error("Error clearing tasks:", chrome.runtime.lastError);
            } else {
              console.log(
                `Successfully cleared ${keysToRemove.length} tasks. API key and focus state preserved.`
              ); // Updated log message
              displayTasks(); // Re-render the list after clearing
            }
          });
        } else {
          console.log("No tasks found to clear.");
          displayTasks(); // Even if no tasks, refresh display
        }
      });
    });
  }
});
