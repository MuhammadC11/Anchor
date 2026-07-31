/** Shared helpers for popup pages and the service worker (via importScripts). */

const TASKS_STORAGE_KEY = "tasks";
const TASKS_MIGRATED_KEY = "tasksMigrated";

const STORAGE_RESERVED_KEYS = new Set([
  TASKS_STORAGE_KEY,
  TASKS_MIGRATED_KEY,
  "apiKey",
  "focusState",
  "pomodoro",
  "pomodoroSettings",
]);

const PRIORITY_LABELS = {
  1: "1 - Low",
  2: "2 - Medium",
  3: "3 - High",
  4: "4 - Urgent",
};

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
    typeof value.name === "string" &&
    value.name.length > 0
  );
}

function normalizeTaskRecord(task) {
  return {
    id: task.id,
    name: task.name,
    description: task.description || "",
    due_date: task.due_date || "",
    priority: task.priority || "1",
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
    ...(task.subtaskError ? { subtaskError: task.subtaskError } : {}),
  };
}

function getPriorityLabel(priority) {
  return PRIORITY_LABELS[String(priority)] || String(priority || "N/A");
}

async function migrateLegacyTasksIfNeeded() {
  const all = await storageGet(null);
  const legacyKeys = [];
  const legacyTasks = [];

  for (const key of Object.keys(all)) {
    if (key === TASKS_STORAGE_KEY || key === TASKS_MIGRATED_KEY) continue;
    if (isLegacyTaskEntry(key, all[key])) {
      legacyKeys.push(key);
      legacyTasks.push(
        normalizeTaskRecord({
          id: key,
          description: all[key].description || "",
          ...all[key],
        }),
      );
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
      await storageSet({ tasks: merged, [TASKS_MIGRATED_KEY]: true });
      await storageRemove(legacyKeys);
      return merged;
    }
    if (!all[TASKS_MIGRATED_KEY]) {
      await storageSet({ [TASKS_MIGRATED_KEY]: true });
    }
    return all.tasks;
  }

  // Corrupted or missing tasks array — recover from legacy keys only
  if (all.tasks != null && !Array.isArray(all.tasks)) {
    console.warn(
      "[Storage] Corrupted tasks value; recovering from legacy keys if any.",
    );
  }

  await storageSet({ tasks: legacyTasks, [TASKS_MIGRATED_KEY]: true });
  if (legacyKeys.length > 0) {
    await storageRemove(legacyKeys);
  }
  return legacyTasks;
}

async function getTasks() {
  const result = await storageGet([TASKS_STORAGE_KEY, TASKS_MIGRATED_KEY]);
  if (Array.isArray(result.tasks) && result[TASKS_MIGRATED_KEY]) {
    return result.tasks;
  }
  return migrateLegacyTasksIfNeeded();
}

async function getTaskById(id) {
  const tasks = await getTasks();
  return tasks.find((task) => task.id === id) || null;
}

// Serialize task writes to avoid lost updates from concurrent read-modify-write
let taskWriteQueue = Promise.resolve();

function enqueueTaskWrite(operation) {
  const run = taskWriteQueue.then(operation, operation);
  taskWriteQueue = run.catch((err) => {
    console.error("[Storage] Task write failed:", err);
  });
  return run;
}

async function addTask(task) {
  return enqueueTaskWrite(async () => {
    const tasks = await getTasks();
    tasks.push(normalizeTaskRecord(task));
    await storageSet({ tasks, [TASKS_MIGRATED_KEY]: true });
  });
}

async function updateTask(id, updates) {
  return enqueueTaskWrite(async () => {
    const tasks = await getTasks();
    const index = tasks.findIndex((task) => task.id === id);
    if (index === -1) return false;

    const merged = { ...tasks[index], ...updates, id };
    if (updates.subtaskError === null) {
      delete merged.subtaskError;
    }

    tasks[index] = normalizeTaskRecord(merged);
    await storageSet({ tasks, [TASKS_MIGRATED_KEY]: true });
    return true;
  });
}

async function saveTaskSubtasks(id, subtasks, error = null) {
  if (error) {
    return updateTask(id, { subtasks: [], subtaskError: error });
  }
  return updateTask(id, { subtasks, subtaskError: null });
}

async function deleteTaskById(id) {
  return enqueueTaskWrite(async () => {
    const tasks = await getTasks();
    await storageSet({
      tasks: tasks.filter((task) => task.id !== id),
      [TASKS_MIGRATED_KEY]: true,
    });
  });
}

async function clearAllTasks() {
  return enqueueTaskWrite(async () => {
    await storageSet({ tasks: [], [TASKS_MIGRATED_KEY]: true });
  });
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

function showSubtaskErrorWithRetry(container, message, onRetry) {
  if (!container) return;
  container.replaceChildren();

  const paragraph = document.createElement("p");
  paragraph.className = "subtask-error-message";
  paragraph.textContent = message;
  container.appendChild(paragraph);

  const retryBtn = document.createElement("button");
  retryBtn.type = "button";
  retryBtn.className = "btn2 retry-subtasks-btn";
  retryBtn.textContent = "Retry AI breakdown";
  retryBtn.addEventListener("click", onRetry);
  container.appendChild(retryBtn);
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
