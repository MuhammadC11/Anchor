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

const GEMINI_MODEL = "gemini-3.6-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const distractionCache = new Map();
const inFlightDistractionChecks = new Map();
const DISTRACTION_CACHE_TTL_MS = 5 * 60 * 1000;
const DISTRACTION_CACHE_MAX_SIZE = 100;

const SKIP_URL_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "about:",
  "edge://",
  "brave://",
  "file:///",
  "data:",
  "devtools://",
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
];

let initPromise = null;
let focusStateLoaded = false;
let debounceTimer = null;

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

async function generateGeminiResponse(
  systemPrompt,
  userContent,
  { maxOutputTokens = 800 } = {},
) {
  const apiKey = await getApiKey();

  // Gemini 3.6: use system_instruction, no prefilled model turns,
  // and no deprecated sampling params (temperature/topP/topK/candidateCount).
  const response = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        maxOutputTokens,
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
    when: Date.now() + Math.max(delayInMs, 0),
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

function getDistractionCacheKey(url, taskId) {
  return `${taskId || "unknown"}|${url}`;
}

function getCachedDistraction(url, taskId) {
  const key = getDistractionCacheKey(url, taskId);
  const entry = distractionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > DISTRACTION_CACHE_TTL_MS) {
    distractionCache.delete(key);
    return null;
  }
  return entry.isDistracted;
}

function setCachedDistraction(url, taskId, isDistracted) {
  const key = getDistractionCacheKey(url, taskId);
  if (distractionCache.size >= DISTRACTION_CACHE_MAX_SIZE) {
    const oldestKey = distractionCache.keys().next().value;
    distractionCache.delete(oldestKey);
  }
  distractionCache.set(key, { isDistracted, timestamp: Date.now() });
}

function parseDistractionResult(res) {
  const match = String(res || "")
    .trim()
    .match(/^([01])\b/);
  if (!match) return null;
  return match[1] === "1";
}

function shouldSkipUrl(url) {
  if (!url) return true;
  return SKIP_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function advancePomodoroPhase() {
  // Guard against zombie alarms after Unfocus
  if (!pomodoroState.isRunning) {
    chrome.alarms.clear("pomodoroTimer");
    return;
  }

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

function catchUpOverduePhases() {
  if (!pomodoroState.isRunning || typeof pomodoroState.startTime !== "number") {
    return;
  }

  // Cap catch-up so a long sleep doesn't fire dozens of notifications
  let safety = 0;
  while (safety < 4 && pomodoroState.isRunning) {
    const durationMs =
      (pomodoroState.phase === "work"
        ? pomodoroState.workDuration
        : pomodoroState.breakDuration) * 1000;
    const remainingMs = durationMs - (Date.now() - pomodoroState.startTime);

    if (remainingMs > 0) {
      schedulePomodoroAlarm(remainingMs);
      break;
    }

    advancePomodoroPhase();
    safety += 1;
  }
}

async function initializeStates() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await loadFocusStateFromStorage();
    await loadPomodoroState();
    await migrateLegacyTasksIfNeeded();
    catchUpOverduePhases();
    focusStateLoaded = true;
  })().finally(() => {
    // Allow future re-init only after this one settles (e.g. SW restart)
  });

  return initPromise;
}

chrome.runtime.onStartup.addListener(() => {
  initializeStates();
});
chrome.runtime.onInstalled.addListener(() => {
  initializeStates();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "pomodoroTimer") return;

  loadPomodoroState().then(() => {
    if (!pomodoroState.isRunning) {
      chrome.alarms.clear("pomodoroTimer");
      return;
    }
    advancePomodoroPhase();
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  switch (request.type) {
    case "newTask":
    case "retrySubtasks": {
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

      // Acknowledge immediately so the message channel doesn't hang
      sendResponse({ accepted: true });

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
      return false;
    }

    case "focus": {
      const { id, name, description, newActiveState } = request;
      chrome.alarms.clear("pomodoroTimer");

      focus.active = newActiveState;
      focus.id = newActiveState ? id : null;
      focus.name = newActiveState ? name : null;
      focus.description = newActiveState ? description : null;
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
          chrome.alarms.clear("pomodoroTimer");
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

    case "allowDistractionOnce": {
      const { url } = request;
      if (url && focus.id) {
        setCachedDistraction(url, focus.id, false);
      }
      sendResponse({ success: true });
      return false;
    }

    default:
      break;
  }
});

async function ensureFocusStateLoaded() {
  if (!focusStateLoaded) {
    await loadFocusStateFromStorage();
    focusStateLoaded = true;
  }
}

async function checkDistractionForTab(tabId, url, title, taskId, taskName) {
  const cacheKey = getDistractionCacheKey(url, taskId);

  if (inFlightDistractionChecks.has(cacheKey)) {
    return inFlightDistractionChecks.get(cacheKey);
  }

  const checkPromise = (async () => {
    const cached = getCachedDistraction(url, taskId);
    if (cached !== null) return cached;

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

    const userContent = `URL: ${url}, Tab Title: ${title}, Topic: ${taskName}`;
    const res = await generateGeminiResponse(systemPrompt, userContent, {
      maxOutputTokens: 80,
    });
    const isDistracted = parseDistractionResult(res);
    if (isDistracted === null) return false;

    setCachedDistraction(url, taskId, isDistracted);
    return isDistracted;
  })().finally(() => {
    inFlightDistractionChecks.delete(cacheKey);
  });

  inFlightDistractionChecks.set(cacheKey, checkPromise);
  return checkPromise;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, _tab) => {
  if (changeInfo.status !== "complete") return;

  await ensureFocusStateLoaded();

  if (!focus.active || !focus.name || !focus.id) return;

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!activeTab || activeTab.id !== tabId) return;

    const { url, title } = activeTab;
    if (shouldSkipUrl(url)) return;
    if (url === chrome.runtime.getURL("popup/distracted.html")) return;

    const taskId = focus.id;
    const taskName = focus.name;

    try {
      const isDistracted = await checkDistractionForTab(
        tabId,
        url,
        title,
        taskId,
        taskName,
      );

      // Re-validate after the (possibly slow) API call
      if (!focus.active || focus.id !== taskId) return;

      const freshTab = await chrome.tabs.get(tabId).catch(() => null);
      if (!freshTab || freshTab.url !== url) return;

      if (isDistracted) {
        chrome.tabs.update(tabId, {
          url: chrome.runtime.getURL(
            `popup/distracted.html?blocked=${encodeURIComponent(url)}`,
          ),
        });
      }
    } catch (err) {
      console.error("[Distraction] Error during check:", err);
    }
  }, 1000);
});

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local" && changes.focusState) {
    Object.assign(focus, changes.focusState.newValue || {});
    focusStateLoaded = true;
  }
});

initializeStates();
