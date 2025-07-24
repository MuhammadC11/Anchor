// Focus management object - will be initialized from storage on startup
const focus = {
  active: false,
  id: null,
  name: null,
  description: null,
};

// Pomodoro Timer State
// This object will be stored in chrome.storage.local
const pomodoroState = {
  isRunning: false,
  phase: "work", // 'work' or 'break'
  remainingTime: 0, // In seconds
  workDuration: 25 * 60, // 25 minutes
  breakDuration: 5 * 60, // 5 minutes
  focusedTaskId: null, // The ID of the task currently in focus
  focusedTaskName: null, // The name of the task currently in focus
};

// Function to fetch the API key from Chrome storage
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

// Function to call the Gemini API with a given prompt
async function generateGeminiResponse(systemPrompt, userContent) {
  let apiKey;
  try {
    console.log("Attempting to retrieve API key...");
    apiKey = await getApiKey();
    console.log(
      "API Key successfully retrieved for API call (first 5 chars):",
      apiKey.substring(0, 5) + "..."
    );
  } catch (error) {
    console.error("Failed to retrieve API key before Gemini call:", error);
    throw new Error("API key not available for Gemini API call.");
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Gemini API error details:", errorData);
      throw new Error(
        `Gemini API error: ${response.status} - ${
          response.statusText
        }. Details: ${
          errorData.error
            ? errorData.error.message
            : "No specific error message."
        }`
      );
    }

    const data = await response.json();
    console.log("Response from Gemini API:", data);

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
    console.error("Error generating response from Gemini API:", error);
    throw error;
  }
}

// Function to save subtasks in Chrome storage
function saveSubtasks(id, subtasks) {
  chrome.storage.local.get(id, (result) => {
    const oldTask = result[id] || {};
    const newTask = { ...oldTask, subtasks };

    chrome.storage.local.set({ [id]: newTask }, () => {
      console.log("Tasks updated", newTask);
    });
  });
}

// Function to save the current focus state to storage
function saveFocusStateToStorage() {
  chrome.storage.local.set({ focusState: focus }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error saving focus state to storage:",
        chrome.runtime.lastError
      );
    } else {
      console.log("Focus state saved to storage:", focus);
    }
  });
}

// Function to load the focus state from storage
function loadFocusStateFromStorage() {
  chrome.storage.local.get("focusState", (result) => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error loading focus state from storage:",
        chrome.runtime.lastError
      );
      return;
    }
    if (result.focusState) {
      focus.active = result.focusState.active || false;
      focus.id = result.focusState.id || null;
      focus.name = result.focusState.name || null;
      focus.description = result.focusState.description || null;
      console.log("Focus state loaded from storage:", focus);
    } else {
      console.log("No focus state found in storage. Initializing default.");
    }
  });
}

// --- Event Listeners ---

// Listen for when the extension starts up (browser opened or extension enabled/reloaded)
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension starting up. Loading focus state...");
  loadFocusStateFromStorage();
});

// Recommended place to set API key on install if not done via options page
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed or updated. Loading focus state...");
  loadFocusStateFromStorage(); // Also load focus state on install/update
  chrome.storage.local.get("apiKey", (result) => {
    if (!result.apiKey) {
      console.warn(
        "API key not found on install. Please set your Gemini API key in chrome.storage.local using: chrome.storage.local.set({ apiKey: 'YOUR_GEMINI_API_KEY_HERE' });"
      );
    }
  });
});

// Message handler for incoming requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "newTask": {
      const { id, name, description } = request;

      console.log(`Generating subtasks for: ${name} | ${description}`);

      const systemPrompt =
        "You are an AI assistant that generates actionable subtasks for a given task. Provide a maximum of 3 subtasks. For each subtask, provide 1-3 concise tips. Strictly follow this format and don't deviate from it, dont include any * in your respone. the output should be a numbered list where each subtask is followed by its tips, with tips starting with a hyphen. For example:\n1. Subtask One\n- Tip one\n- Tip two\n2. Subtask Two\n- Tip one.";
      const userContent = `Task Name: ${name}\nTask Description: ${description}`;

      generateGeminiResponse(systemPrompt, userContent)
        .then((res) => {
          console.log("Generated subtasks from API:", res);

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
          console.error("Error generating or saving new task:", err)
        );

      return true;
    }
    case "focus": {
      const { id, name, description, newActiveState } = request; // Expect newActiveState from viewTask.js

      // Update the global focus object based on the message
      focus.active = newActiveState;
      focus.id = newActiveState ? id : null;
      focus.name = newActiveState ? name : null;
      focus.description = newActiveState ? description : null;

      console.log(
        "Focus message received! Focus active:",
        focus.active,
        "Task ID:",
        focus.id,
        "Task Name:",
        focus.name
      );

      // Save the updated focus state to storage immediately
      saveFocusStateToStorage();

      break;
    }
    default:
      break;
  }
});

let debounceTimer;

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only proceed if tab is fully loaded and focus mode is active
  if (changeInfo.status !== "complete" || !focus.active) {
    return;
  }

  // Ensure there's a focused task name before proceeding with distraction check
  if (!focus.name) {
    console.warn(
      "Focus mode is active but no task name is set. Skipping distraction check."
    );
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    if (!activeTab || activeTab.id !== tabId) {
      return; // Not the currently active tab
    }

    const { url, title } = activeTab;

    // Exclude new tabs, empty tabs, and internal Chrome URLs
    if (!url || url.startsWith("chrome://") || url.startsWith("about:")) {
      console.log("Ignoring internal Chrome tab or empty tab:", url);
      return;
    }

    // Prevent redirect loop if already on the distracted page
    if (url === chrome.runtime.getURL("popup/distracted.html")) return;

    console.log(
      `Checking for distraction; Tab title: ${title} | Tab URL: ${url} | Current focus: ${focus.name}`
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
        console.log("Distraction check result from API:", res);

        const isDistracted = res.trim().startsWith("1");

        if (isDistracted) {
          console.log("User detected as distracted. Redirecting...");
          chrome.tabs.update(tabId, {
            url: chrome.runtime.getURL("popup/distracted.html"),
          });
        } else {
          console.log("User is not distracted.");
        }
      })
      .catch((err) =>
        console.error("Error during distraction detection:", err)
      );
  }, 1000); // Debounce for 1 second
});
