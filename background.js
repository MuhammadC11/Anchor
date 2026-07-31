importScripts("shared/utils.js");

const focus = {
  active: false,
  id: null,
  name: null,
  description: null,
};

const pomodoroState = {
  isRunning: false,
  phase: "work",
  remainingTime: 0,
  workDuration: 25 * 60,
  breakDuration: 5 * 60,
  focusedTaskId: null,
  focusedTaskName: null,
  startTime: null,
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const distractionCache = new Map();
const DISTRACTION_CACHE_TTL_MS = 5 * 60 * 1000;
const DISTRACTION_CACHE_MAX_SIZE = 100;

function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("apiKey", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        reject(new Error("API key not found in storage."));
      }
    });
  });
}

async function generateGeminiResponse(systemPrompt, userContent) {
  const apiKey = await getApiKey();

  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        {
          role: "model",
          parts: [{ text: "Understood. Please provide the details." }],
        },
        { role: "user", parts: [{ text: userContent }] },
      ],
      generationConfig: {
        temperature: 0.7,
        candidateCount: 1,
        maxOutputTokens: 800,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Gemini API error: ${response.status} - ${response.statusText}. ${
        errorData.error?.message || "No specific error message."
      }`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Invalid response format from Gemini API.");
  }
  return text;
}

function saveSubtasks(id, subtasks, error = null) {
  saveTaskSubtasks(id, subtasks, error).catch((err) => {
    console.error(`[Storage] Failed to update task '${id}':`, err);
  });
}

function sendPomodoroNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "assets/anchor.png",
    title,
    message,
    priority: 2,
  });
}

function schedulePomodoroAlarm(delayInMs) {
  chrome.alarms.create("pomodoroTimer", {
    when: Date.now() + delayInMs,
  });
}

function saveFocusStateToStorage() {
  chrome.storage.local.set({ focusState: focus });
}

function loadFocusStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("focusState", (result) => {
      if (result.focusState) {
        Object.assign(focus, result.focusState);
      } else {
        saveFocusStateToStorage();
      }
      resolve(true);
    });
  });
}

function savePomodoroState() {
  chrome.storage.local.set({ pomodoro: pomodoroState });
}

function loadPomodoroState() {
  return new Promise((resolve) => {
    chrome.storage.local.get("pomodoro", (result) => {
      if (result.pomodoro) {
        Object.assign(pomodoroState, result.pomodoro);
      }
      resolve(true);
    });
  });
}

function getCachedDistraction(url) {
  const entry = distractionCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DISTRACTION_CACHE_TTL_MS) {
    distractionCache.delete(url);
    return null;
  }
  return entry.isDistracted;
}

function setCachedDistraction(url, isDistracted) {
  if (distractionCache.size >= DISTRACTION_CACHE_MAX_SIZE) {
    const oldestKey = distractionCache.keys().next().value;
    distractionCache.delete(oldestKey);
  }
  distractionCache.set(url, { isDistracted, timestamp: Date.now() });
}

function advancePomodoroPhase() {
  chrome.alarms.clear("pomodoroTimer");

  if (pomodoroState.phase === "work") {
    sendPomodoroNotification(
      "Pomodoro Complete!",
      `Time for a ${pomodoroState.breakDuration / 60}-minute break. Task: ${
        pomodoroState.focusedTaskName || "N/A"
      }`,
    );
    pomodoroState.phase = "break";
    pomodoroState.remainingTime = pomodoroState.breakDuration;
    pomodoroState.startTime = Date.now();
    schedulePomodoroAlarm(pomodoroState.breakDuration * 1000);

    focus.active = false;
    focus.pomodoroRunning = true;
    saveFocusStateToStorage();
  } else {
    sendPomodoroNotification(
      "Break Over!",
      `Time to get back to work! Task: ${
        pomodoroState.focusedTaskName || "N/A"
      }`,
    );
    pomodoroState.phase = "work";
    pomodoroState.remainingTime = pomodoroState.workDuration;
    pomodoroState.startTime = Date.now();
    schedulePomodoroAlarm(pomodoroState.workDuration * 1000);

    focus.active = true;
    saveFocusStateToStorage();
  }
  savePomodoroState();
}

async function initializeStates() {
  await loadFocusStateFromStorage();
  await loadPomodoroState();
  await migrateLegacyTasksIfNeeded();

  if (pomodoroState.isRunning && typeof pomodoroState.startTime === "number") {
    const remainingMs =
      pomodoroState.phase === "work"
        ? pomodoroState.workDuration * 1000 -
          (Date.now() - pomodoroState.startTime)
        : pomodoroState.breakDuration * 1000 -
          (Date.now() - pomodoroState.startTime);

    if (remainingMs > 0) {
      schedulePomodoroAlarm(remainingMs);
    } else {
      advancePomodoroPhase();
    }
  }
}

chrome.runtime.onStartup.addListener(initializeStates);
chrome.runtime.onInstalled.addListener(initializeStates);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pomodoroTimer") {
    loadPomodoroState().then(() => {
      advancePomodoroPhase();
    });
  }
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.type) {
    case "newTask": {
      const { id, name, description } = request;
      const systemPrompt = `
      You are an AI assistant that generates actionable subtasks for a given task. Follow these rules strictly:

      1. **Output Format**:
         - Provide a maximum of 3 subtasks.
         - Each subtask must be followed by 1-3 tips to help the user get started.
         - Use the following format:
           1. Subtask One
           - Tip one
           - Tip two
           2. Subtask Two
           - Tip one

      2. **Handling Missing or Invalid Input**:
         - If the user does not provide a description or a task name that is too basic to provide any useful information, respond with: 'Insufficient Information. Please try again.'
         - If the task name is gibberish or nonsensical, respond with: 'Error: Invalid task name. Please provide a valid task name.'

      3. **Response Guidelines**:
         - Do not include any special characters like asterisks (*).
         - Ensure the response is clear, concise, and strictly follows the specified format.
         - Do not deviate from the instructions under any circumstances.

      Generate subtasks and tips based on the task name and description provided by the user.
      `;
      const userContent = `Task Name: ${name}\nTask Description: ${description}`;

      generateGeminiResponse(systemPrompt, userContent)
        .then((res) => {
          const { subtasks, error } = parseSubtasksFromGeminiResponse(res);
          if (error) {
            saveSubtasks(id, [], error);
          } else {
            saveSubtasks(id, subtasks);
          }
        })
        .catch((err) => {
          console.error("[Task] Error generating subtasks:", err);
          saveSubtasks(
            id,
            [],
            err.message ||
              "Failed to generate subtasks. Check your API key in Settings.",
          );
        });
      return true;
    }

    case "focus": {
      const { id, name, description, newActiveState } = request;
      chrome.alarms.clear("pomodoroTimer");

      focus.active = newActiveState;
      focus.id = newActiveState ? id : null;
      focus.name = newActiveState ? name : null;
      focus.description = newActiveState ? description : null;
      focus.pomodoroRunning = newActiveState;
      saveFocusStateToStorage();

      (async () => {
        if (newActiveState) {
          const result = await storageGet("pomodoroSettings");
          const settings = result.pomodoroSettings || {};
          pomodoroState.isRunning = true;
          pomodoroState.phase = "work";
          pomodoroState.workDuration = settings.workDuration || 25 * 60;
          pomodoroState.breakDuration = settings.breakDuration || 5 * 60;
          pomodoroState.remainingTime = pomodoroState.workDuration;
          pomodoroState.focusedTaskId = id;
          pomodoroState.focusedTaskName = name;
          pomodoroState.startTime = Date.now();
          savePomodoroState();
          schedulePomodoroAlarm(pomodoroState.workDuration * 1000);
          sendPomodoroNotification(
            "Pomodoro Started!",
            `Work on "${name}" for ${pomodoroState.workDuration / 60} minutes.`,
          );
        } else {
          pomodoroState.isRunning = false;
          pomodoroState.phase = "work";
          pomodoroState.remainingTime = 0;
          pomodoroState.focusedTaskId = null;
          pomodoroState.focusedTaskName = null;
          pomodoroState.startTime = null;
          savePomodoroState();
          sendPomodoroNotification(
            "Pomodoro Stopped",
            "Your Pomodoro session has been stopped.",
          );
        }

        sendResponse({ success: true });
      })().catch((err) => {
        console.error("[Focus] Failed to update focus state:", err);
        sendResponse({ success: false, error: err.message });
      });

      return true;
    }

    case "getPomodoroState": {
      if (
        pomodoroState.isRunning &&
        typeof pomodoroState.startTime === "number"
      ) {
        const elapsed = Math.floor(
          (Date.now() - pomodoroState.startTime) / 1000,
        );
        const currentDuration =
          pomodoroState.phase === "work"
            ? pomodoroState.workDuration
            : pomodoroState.breakDuration;
        pomodoroState.remainingTime = Math.max(0, currentDuration - elapsed);
      }
      sendResponse(pomodoroState);
      return true;
    }

    case "resetPomodoro": {
      pomodoroState.isRunning = false;
      pomodoroState.phase = "work";
      pomodoroState.remainingTime = pomodoroState.workDuration;
      pomodoroState.focusedTaskId = null;
      pomodoroState.focusedTaskName = null;
      pomodoroState.startTime = null;
      chrome.alarms.clear("pomodoroTimer");
      savePomodoroState();
      sendPomodoroNotification(
        "Pomodoro Reset",
        "Your Pomodoro timer has been reset.",
      );
      sendResponse({ success: true, newState: pomodoroState });
      return true;
    }

    case "checkPomodoroPhase": {
      loadPomodoroState().then(() => {
        if (
          pomodoroState.isRunning &&
          typeof pomodoroState.startTime === "number"
        ) {
          const elapsed = Math.floor(
            (Date.now() - pomodoroState.startTime) / 1000,
          );
          const currentDuration =
            pomodoroState.phase === "work"
              ? pomodoroState.workDuration
              : pomodoroState.breakDuration;
          if (elapsed >= currentDuration) {
            advancePomodoroPhase();
          }
        }
        sendResponse({ success: true, newState: pomodoroState });
      });
      return true;
    }

    default:
      break;
  }
});

let debounceTimer;
let focusStateLoaded = false;

async function ensureFocusStateLoaded() {
  if (!focusStateLoaded) {
    await loadFocusStateFromStorage();
    focusStateLoaded = true;
  }
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.status !== "complete") return;

  await ensureFocusStateLoaded();

  if (!focus.active || !focus.name) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!activeTab || activeTab.id !== tabId) return;

    const { url, title } = activeTab;

    const internalChromeUrls = [
      "chrome://",
      "about:",
      "edge://",
      "brave://",
      "file:///",
      "data:",
    ];
    if (!url || internalChromeUrls.some((prefix) => url.startsWith(prefix))) {
      return;
    }

    if (url === chrome.runtime.getURL("popup/distracted.html")) return;

    const cached = getCachedDistraction(url);
    if (cached !== null) {
      if (cached && focus.active) {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL("popup/distracted.html"),
        });
      }
      return;
    }

    const systemPrompt = `Given a website URL and/or the tab title, and a user's current task focus, determine if the user is distracted. Return ONLY '1' if distracted and '0' if not distracted, followed by a brief explanation.

    Example 1:
    URL: https://www.youtube.com/watch?v=somevideo, Tab Title: Funny Cats - YouTube, Topic: Researching quantum physics
    Output: 1 - The user is watching videos unrelated to quantum physics.

    Example 2:
    URL: https://en.wikipedia.org/wiki/Quantum_physics, Tab Title: Quantum physics - Wikipedia, Topic: Researching quantum physics
    Output: 0 - The user is on a relevant Wikipedia page.

    Example 3:
    URL: https://mail.google.com, Tab Title: Gmail - Inbox, Topic: Writing an essay
    Output: 1 - Checking email is often a distraction from focused work like writing an essay.
    `;

    const userContent = `URL: ${url}, Tab Title: ${title}, Topic: ${focus.name}`;

    try {
      const res = await generateGeminiResponse(systemPrompt, userContent);
      if (!focus.active) return;

      const isDistracted = res.trim().startsWith("1");
      setCachedDistraction(url, isDistracted);

      if (isDistracted) {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL("popup/distracted.html"),
        });
      }
    } catch (err) {
      console.error("[Distraction] Error during check:", err);
    }
  }, 1000);
});

// Reload focus state when it changes so in-memory state stays in sync
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.focusState) {
    Object.assign(focus, changes.focusState.newValue || {});
    focusStateLoaded = true;
  }
});

initializeStates();