document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");
  const apiKeyBanner = document.getElementById("api-key-banner");

  function showApiKeyBannerIfNeeded() {
    storageGet("apiKey").then((result) => {
      if (!result.apiKey && apiKeyBanner) {
        apiKeyBanner.hidden = false;
      }
    });
  }

  function createTaskRow(task) {
    const row = document.createElement("div");
    row.className = "task-row";

    const link = document.createElement("a");
    link.className = "taskNames";
    link.href = `./ViewTask/viewTask.html?id=${encodeURIComponent(task.id)}`;
    link.id = `task-${task.id}`;
    link.textContent = task.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "task-delete-btn";
    deleteBtn.title = "Delete task";
    deleteBtn.setAttribute("aria-label", `Delete ${task.name}`);
    deleteBtn.textContent = "×";

    deleteBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!confirm(`Delete "${task.name}"?`)) return;

      await stopFocusIfTaskActive(task);
      await deleteTaskById(task.id);
      displayTasks();
    });

    row.appendChild(link);
    row.appendChild(deleteBtn);
    return row;
  }

  async function displayTasks() {
    if (!taskListElement) return;

    taskListElement.replaceChildren();
    const tasks = await getTasks();

    if (tasks.length === 0) {
      const message = document.createElement("p");
      message.className = "no-tasks-message";
      message.textContent =
        'No tasks found. Click "Add a task" to get started!';
      taskListElement.appendChild(message);
      return;
    }

    for (const task of tasks) {
      taskListElement.appendChild(createTaskRow(task));
    }
  }

  displayTasks();
  showApiKeyBannerIfNeeded();

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === "local" && changes.tasks) {
      displayTasks();
    }
  });

  const clearTasksElement = document.getElementById("clearTasks");
  if (clearTasksElement) {
    clearTasksElement.addEventListener("click", async () => {
      if (
        !confirm(
          "Are you sure you want to clear ALL your tasks? Your API key and settings will be preserved.",
        )
      ) {
        return;
      }

      const tasks = await getTasks();
      for (const task of tasks) {
        await stopFocusIfTaskActive(task);
      }
      await clearAllTasks();
      displayTasks();
    });
  }
});
