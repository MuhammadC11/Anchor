// Focus management object - will be initialized from storage on startup
const focus = {
  active: false,
  id: null,
  name: null,
  description: null,
};

// Pomodoro Timer State
const pomodoroState = {
  isRunning: false,
  phase: "work", // 'work' or 'break'
  remainingTime: 0, // In seconds (initial default)
  workDuration: 5 * 60, // 5 minutes (default)
  breakDuration: 2 * 60, // 2 minutes (default)
  focusedTaskId: null,
  focusedTaskName: null,
  startTime: null, // Critical: Timestamp when the current phase started
};

// --- Core Utility Functions (unchanged logic unless specified) ---

function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get("apiKey", (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        reject("API key not found in storage.");
      }
    });
  });
}

async function generateGeminiResponse(systemPrompt, userContent) {
  let apiKey;
  try {
    console.log("[Gemini API] Attempting to retrieve API key...");
    apiKey = await getApiKey();
    console.log(
      "[Gemini API] Key retrieved (first 5 chars):",
      apiKey.substring(0, 5) + "...",
    );
  } catch (error) {
    console.error("[Gemini API] Failed to retrieve API key:", error);
    throw new Error("API key not available for Gemini API call.");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[Gemini API] Error details:", errorData);
      throw new Error(
        `Gemini API error: ${response.status} - ${
          response.statusText
        }. Details: ${
          errorData.error
            ? errorData.error.message
            : "No specific error message."
        }`,
      );
    }

    const data = await response.json();
    console.log("[Gemini API] Response:", data);
    if (
      data.candidates &&
      data.candidates.length > 0 &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts.length > 0
    ) {
      return data.candidates[0].content.parts[0].text;
    } else {
      throw new Error("Invalid response format from Gemini API.");
    }
  } catch (error) {
    console.error("[Gemini API] Error generating response:", error);
    throw error;
  }
}

function saveSubtasks(id, subtasks) {
  chrome.storage.local.get(id, (result) => {
    const oldTask = result[id] || {};
    const newTask = { ...oldTask, subtasks };

    chrome.storage.local.set({ [id]: newTask }, () => {
      console.log(`[Storage] Task '${id}' updated:`, newTask);
    });
  });
}

function sendPomodoroNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "../assets/anchor.png",
    title: title,
    message: message,
    priority: 2,
  });
}

function schedulePomodoroAlarm(delayInMs) {
  chrome.alarms.create("pomodoroTimer", {
    when: Date.now() + delayInMs,
  });
  console.log(`[Pomodoro] Alarm scheduled for ${delayInMs / 1000} seconds.`);
}

// --- State Management Functions ---

function saveFocusStateToStorage() {
  chrome.storage.local.set({ focusState: focus }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "[Storage] Error saving focus state:",
        chrome.runtime.lastError,
      );
    } else {
      console.log("[Storage] Focus state saved:", focus);
    }
  });
}

function loadFocusStateFromStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get("focusState", (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Storage] Error loading focus state:",
          chrome.runtime.lastError,
        );
        resolve(false);
        return;
      }
      if (result.focusState) {
        Object.assign(focus, result.focusState);
        console.log("[Storage] Focus state loaded:", focus);
      } else {
        console.log("[Storage] No focus state found. Initializing default.");
        saveFocusStateToStorage(); // Save default if not found
      }
      resolve(true);
    });
  });
}

function savePomodoroState() {
  chrome.storage.local.set({ pomodoro: pomodoroState }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "[Storage] Error saving Pomodoro state:",
        chrome.runtime.lastError,
      );
    } else {
      console.log("[Storage] Pomodoro state saved:", pomodoroState);
    }
  });
}

function loadPomodoroState() {
  return new Promise((resolve) => {
    chrome.storage.local.get("pomodoro", (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "[Storage] Error loading Pomodoro state:",
          chrome.runtime.lastError,
        );
        resolve(false);
        return;
      }
      if (result.pomodoro) {
        Object.assign(pomodoroState, result.pomodoro);
        console.log("[Storage] Pomodoro state loaded:", pomodoroState);

        // --- Recalculate remaining time and reschedule alarm on load ---
      }
      resolve(true);
    });
  });
}

// Function to advance the Pomodoro phase
function advancePomodoroPhase() {
  chrome.alarms.clear("pomodoroTimer");

  if (pomodoroState.phase === "work") {
    // End of Work Phase: Transition to Break
    sendPomodoroNotification(
      "Pomodoro Complete!",
      `Time for a ${pomodoroState.breakDuration / 60}-minute break. Task: ${
        pomodoroState.focusedTaskName || "N/A"
      }`,
    );
    pomodoroState.phase = "break";
    pomodoroState.remainingTime = pomodoroState.breakDuration;
    pomodoroState.startTime = Date.now(); // Critical: Set startTime for the break phase
    schedulePomodoroAlarm(pomodoroState.breakDuration * 1000);

    // Set focus.active to FALSE during the break
    focus.active = false; // Turn off distraction during break
    // DO NOT clear focus.id, focus.name, focus.description here
    // as we intend to return to this task after the break.
    focus.pomodoroRunning = true; // Optional: Flag to indicate we're in a break but still have an active task
    saveFocusStateToStorage();
    console.log("[Focus] Distraction mode deactivated for break.");
  } else {
    // It's 'break' phase
    // End of Break Phase: Transition back to Work for the same task
    sendPomodoroNotification(
      "Break Over!",
      `Time to get back to work! Task: ${
        pomodoroState.focusedTaskName || "N/A"
      }`,
    );
    pomodoroState.phase = "work"; // Transition back to work phase
    pomodoroState.remainingTime = pomodoroState.workDuration; // Set for next work cycle
    pomodoroState.startTime = Date.now(); // Critical: Set startTime for the next work phase

    // The Pomodoro is still running for the same task, so don't set isRunning to false yet.
    // The alarm will be scheduled immediately for the next work period.
    schedulePomodoroAlarm(pomodoroState.workDuration * 1000);

    // Set focus.active to TRUE to re-activate distraction mode for the same task
    focus.active = true; // Turn on distraction after break
    // Crucially, focus.id/name/description should still hold the task details from before the break.
    // So, no need to re-assign them unless they were explicitly cleared.
    saveFocusStateToStorage();
    console.log("[Focus] Distraction mode reactivated for next work period.");
  }
  savePomodoroState(); // Save current pomodoro state
}

// --- Event Listeners ---

// Initialize states on startup or install
async function initializeStates() {
  console.log("--- Initializing extension states ---");
  await loadFocusStateFromStorage(); // Wait for focus to load
  await loadPomodoroState(); // Wait for pomodoro to load
  console.log("--- Initialization complete ---");
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
  // Optional: Check API key on startup/install
  chrome.storage.local.get("apiKey", (result) => {
    if (!result.apiKey) {
      console.warn(
        "API key not found. Please set your Gemini API key in chrome.storage.local using: chrome.storage.local.set({ apiKey: 'YOUR_GEMINI_API_KEY_HERE' });",
      );
    }
  });
}

chrome.runtime.onStartup.addListener(initializeStates);
chrome.runtime.onInstalled.addListener(initializeStates);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "pomodoroTimer") {
    console.log(
      "[Pomodoro] Alarm fired! Reloading state from storage first...",
    );
    loadPomodoroState().then(() => {
      advancePomodoroPhase();
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "newTask": {
      const { id, name, description } = request;
      console.log(`[Task] Generating subtasks for: ${name} | ${description}`);
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
         - If the user does not provide a description or a task name that is too basic to provude any useful information, respond with: 'Insufficient Information. Please try again.'
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
          console.log("[Gemini API] Generated subtasks:", res);
          const subtasks = res
            .split(/\d+\.\s*/)
            .filter((item) => item.trim() !== "")
            .map((subtaskText) => {
              const lines = subtaskText.trim().split("\n");
              const title = lines[0].trim();
              const tips = lines
                .slice(1)
                .map((tip) => tip.replace(/^- /, "").trim());
              return { title, tips };
            });
          saveSubtasks(id, subtasks);
        })
        .catch((err) =>
          console.error("[Task] Error generating or saving new task:", err),
        );
      return true;
    }

    case "focus": {
      const { id, name, description, newActiveState } = request;
      chrome.alarms.clear("pomodoroTimer");

      // Set focus state SYNCHRONOUSLY first so tabs.onUpdated sees it immediately
      focus.active = newActiveState;
      focus.id = newActiveState ? id : null;
      focus.name = newActiveState ? name : null;
      focus.description = newActiveState ? description : null;
      focus.pomodoroRunning = newActiveState ? true : false;
      saveFocusStateToStorage(); // persist immediately

      if (newActiveState) {
        chrome.storage.local.get("pomodoroSettings", (result) => {
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
        });
        return true;
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

      saveFocusStateToStorage();
      savePomodoroState();
      break;
    }

    case "getPomodoroState": {
      // Recalculate remaining time before sending
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
      pomodoroState.startTime = null; // Critical: Clear startTime on reset
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
            console.log(
              "[Pomodoro] checkPomodoroPhase triggered phase advance.",
            );
            advancePomodoroPhase();
          }
        }
        sendResponse({ success: true, newState: pomodoroState });
      });
      return true; // Keep message channel open for async sendResponse
    }
    default:
      break;
  }
});

let debounceTimer;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  // Always reload focus state from storage in case service worker restarted
  await loadFocusStateFromStorage();

  // If focus isn't active or task name is missing, nothing to do
  if (!focus.active || !focus.name) {
    console.log(
      "[Distraction] Focus not active or task name missing. Skipping.",
    );
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!activeTab || activeTab.id !== tabId) return;

    const { url, title } = activeTab;

    // Skip internal browser pages
    const internalChromeUrls = [
      "chrome://",
      "about:",
      "edge://",
      "brave://",
      "file:///",
      "data:",
    ];
    if (!url || internalChromeUrls.some((prefix) => url.startsWith(prefix))) {
      console.log("[Distraction] Ignoring internal browser tab:", url);
      return;
    }

    // Skip the distracted page itself to avoid redirect loops
    if (url === chrome.runtime.getURL("popup/distracted.html")) return;

    console.log(
      `[Distraction] Checking: Tab title: ${title} | URL: ${url} | Focus: ${focus.name}`,
    );

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

    generateGeminiResponse(systemPrompt, userContent)
      .then((res) => {
        console.log("[Distraction] Check result:", res);

        // Re-check focus is still active before redirecting,
        // in case user unfocused while the AI was thinking
        if (!focus.active) {
          console.log(
            "[Distraction] Focus deactivated during AI check. Skipping redirect.",
          );
          return;
        }

        const isDistracted = res.trim().startsWith("1");
        if (isDistracted) {
          console.log(
            "[Distraction] User detected as distracted. Redirecting...",
          );
          chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL("popup/distracted.html"),
          });
        } else {
          console.log("[Distraction] User is not distracted.");
        }
      })
      .catch((err) => console.error("[Distraction] Error during check:", err));
  }, 1000);
});
