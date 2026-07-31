/** Shared helpers for popup pages and the service worker (via importScripts). */

const TASKS_STORAGE_KEY = "tasks";

const STORAGE_RESERVED_KEYS = new Set([
  TASKS_STORAGE_KEY,
  "apiKey",
  "focusState",
  "pomodoro",
  "pomodoroSettings",
  "pomodoroState",
]);

function isReservedStorageKey(key) {
  return STORAGE_RESERVED_KEYS.has(key);
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve(result);
    });
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      resolve();
    });
  });
}

function isLegacyTaskEntry(key, value) {
  return (
    !isReservedStorageKey(key) &&
    value &&
    typeof value === "object" &&
    value.name &&
    value.description
  );
}

function normalizeTaskRecord(task) {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    due_date: task.due_date || "",
    priority: task.priority || "1",
    subtasks: task.subtasks || [],
    ...(task.subtaskError ? { subtaskError: task.subtaskError } : {}),
  };
}

async function migrateLegacyTasksIfNeeded() {
  const all = await storageGet(null);
  const legacyKeys = [];
  const legacyTasks = [];

  for (const key of Object.keys(all)) {
    if (key === TASKS_STORAGE_KEY) continue;
    if (isLegacyTaskEntry(key, all[key])) {
      legacyKeys.push(key);
      legacyTasks.push(normalizeTaskRecord({ id: key, ...all[key] }));
    }
  }

  if (Array.isArray(all.tasks)) {
    if (legacyKeys.length > 0) {
      const existingIds = new Set(all.tasks.map((task) => task.id));
      const merged = [...all.tasks];
      for (const task of legacyTasks) {
        if (!existingIds.has(task.id)) {
          merged.push(task);
        }
      }
      await storageSet({ tasks: merged });
      await storageRemove(legacyKeys);
      return merged;
    }
    return all.tasks;
  }

  await storageSet({ tasks: legacyTasks });
  if (legacyKeys.length > 0) {
    await storageRemove(legacyKeys);
  }
  return legacyTasks;
}

async function getTasks() {
  return migrateLegacyTasksIfNeeded();
}

async function getTaskById(id) {
  const tasks = await getTasks();
  return tasks.find((task) => task.id === id) || null;
}

async function addTask(task) {
  const tasks = await getTasks();
  tasks.push(normalizeTaskRecord(task));
  await storageSet({ tasks });
}

async function updateTask(id, updates) {
  const tasks = await getTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return false;

  const merged = { ...tasks[index], ...updates, id };
  if (updates.subtaskError === null) {
    delete merged.subtaskError;
  }

  tasks[index] = normalizeTaskRecord(merged);
  await storageSet({ tasks });
  return true;
}

async function saveTaskSubtasks(id, subtasks, error = null) {
  if (error) {
    return updateTask(id, { subtasks: [], subtaskError: error });
  }
  return updateTask(id, { subtasks, subtaskError: null });
}

async function deleteTaskById(id) {
  const tasks = await getTasks();
  await storageSet({ tasks: tasks.filter((task) => task.id !== id) });
}

async function clearAllTasks() {
  await storageSet({ tasks: [] });
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseSubtasksFromGeminiResponse(res) {
  if (!res || typeof res !== "string") {
    return { subtasks: [], error: "Invalid response from AI." };
  }

  const trimmed = res.trim();
  if (
    trimmed.startsWith("Insufficient Information") ||
    trimmed.startsWith("Error:")
  ) {
    return { subtasks: [], error: trimmed };
  }

  const subtasks = trimmed
    .split(/\d+\.\s*/)
    .filter((item) => item.trim() !== "")
    .map((subtaskText) => {
      const lines = subtaskText.trim().split("\n");
      const title = lines[0].trim();
      const tips = lines
        .slice(1)
        .map((tip) => tip.replace(/^-\s*/, "").trim())
        .filter(Boolean);
      return { title, tips };
    });

  if (subtasks.length === 0) {
    return { subtasks: [], error: "AI returned no subtasks. Try again later." };
  }

  return { subtasks, error: null };
}

function renderSubtasks(container, subtasks) {
  if (!container) return;
  container.replaceChildren();

  const heading = document.createElement("h3");
  heading.className = "subtasks-heading";
  heading.textContent = "Actionable Subtasks:";
  container.appendChild(heading);

  const list = document.createElement("ul");
  list.className = "subtask-list";

  for (const subtask of subtasks) {
    const item = document.createElement("li");

    const title = document.createElement("h4");
    title.className = "subtask-title";
    title.textContent = subtask.title || "Untitled Subtask";
    item.appendChild(title);

    const tipsList = document.createElement("ul");
    tipsList.className = "subtask-tips";
    const tips =
      subtask.tips && subtask.tips.length > 0
        ? subtask.tips
        : ["No tips available."];

    for (const tip of tips) {
      const tipItem = document.createElement("li");
      tipItem.textContent = tip;
      tipsList.appendChild(tipItem);
    }

    item.appendChild(tipsList);
    list.appendChild(item);
  }

  container.appendChild(list);
}

function showSubtaskMessage(
  container,
  message,
  className = "no-subtasks-message",
) {
  if (!container) return;
  container.replaceChildren();
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = message;
  container.appendChild(paragraph);
}

function findTaskInStorageChange(changes, taskId) {
  if (!changes.tasks) return null;
  const tasks = changes.tasks.newValue || [];
  return tasks.find((task) => task.id === taskId) || null;
}

async function stopFocusIfTaskActive(task) {
  const { pomodoro } = await storageGet("pomodoro");
  if (!pomodoro || pomodoro.focusedTaskId !== task.id) return;

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        id: task.id,
        name: task.name,
        description: task.description,
        type: "focus",
        newActiveState: false,
      },
      () => resolve(),
    );
  });
}
