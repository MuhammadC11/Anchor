// This file will only have access to the pop up extensions DOM

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");
  // taskNamesElement is causing issues, will be handled by iterating all items
  // const taskNamesElement = document.querySelector(".taskNames");

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
        // Skip the API key and any other non-task specific data
        if (id === "apiKey") {
          // Make sure "apiKey" is the ONLY key for your API key
          console.log(`Skipping non-task item: ${id}`);
          continue; // Skip to the next item
        }

        const task = items[id];

        // --- VALIDATION: Ensure it's a valid task object ---
        // A simple check: does it have at least a 'name' and 'description' property?
        if (task && typeof task === "object" && task.name && task.description) {
          tasksFound = true;
          // Append the task to the list
          taskListElement.insertAdjacentHTML(
            "beforeend",
            `<a class="taskNames" href="./ViewTask/viewTask.html?id=${id}" id="task-${id}">
              ${task.name}
            </a>`
            // You might want to add a delete button next to each task here
            // <button class="delete-single-task-btn" data-id="${id}">X</button>
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

      // Add event listeners for individual delete buttons if you implement them
      // taskListElement.querySelectorAll('.delete-single-task-btn').forEach(button => {
      //   button.addEventListener('click', (e) => {
      //     e.preventDefault(); // Prevent navigating if it's inside an <a> tag
      //     const taskIdToDelete = e.target.dataset.id;
      //     if (confirm(`Are you sure you want to delete task "${items[taskIdToDelete].name}"?`)) {
      //       chrome.storage.local.remove(taskIdToDelete, () => {
      //         if (chrome.runtime.lastError) {
      //           console.error("Error deleting task:", chrome.runtime.lastError);
      //         } else {
      //           console.log("Task deleted:", taskIdToDelete);
      //           displayTasks(); // Re-render the list
      //         }
      //       });
      //     }
      //   });
      // });
    });
  }

  // Initial call to display tasks when the popup loads
  displayTasks();

  // --- CRITICAL CHANGE: Refactor clear all button ---
  var clearTasksElement = document.getElementById("clearTasks");
  if (clearTasksElement) {
    clearTasksElement.addEventListener("click", function () {
      if (
        !confirm(
          "Are you sure you want to clear ALL your tasks? This will NOT delete your API key."
        )
      ) {
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
          // Add key to list ONLY if it's NOT the API key
          if (key !== "apiKey") {
            // Ensure this matches the key you use to store the API key
            keysToRemove.push(key);
          }
        }

        if (keysToRemove.length > 0) {
          chrome.storage.local.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              console.error("Error clearing tasks:", chrome.runtime.lastError);
            } else {
              console.log(
                `Successfully cleared ${keysToRemove.length} tasks. API key preserved.`
              );
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
