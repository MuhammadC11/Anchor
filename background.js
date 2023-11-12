// This file will act as the middleware that helps facilitate resources between content-script & popup

const focus = {
  active: false,
  id: null,
  name: null,
  description: null,
};

async function fetchGPT(systemMessage, userMessage) {
  const OPENAI_API_KEY = "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";
  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${OPENAI_API_KEY}`,
  };

  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: systemMessage,
      },
      {
        role: "user",
        content: userMessage,
      },
    ],
  };

  const data = await (
    await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    })
  ).json();

  console.log("full response: ", data);

  return data.choices[0].message.content;
}

// message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "newTask": {
      const { id, name, description } = request;

      console.log(`fetching from GPT3: ${name} | ${description}`);

      fetchGPT(
        "Given the task name (first sentence) and description, break up this task into actionable subtasks so I have an idea of where to start with my task. Limit this to 5 subtasks maximum and ONLY return these 5 subtasks, along with a 1-3 tips for each. After naming each subtask, do not use a semicolon and prefix each tip with '\n- '. Sample Output: 1. subtask\n- tip\n- tip\n- tip\n2. subtask\n- tip\n- tip\n- tip\n3. subtask\n- tip\n- tip\n- tip\n ...",
        `Title: ${name}. ${description}`
      )
        .then((res) => {
          console.log("retrieved from API:", res);

          const subtasks = res.split("\n\n").map((subtask) => {
            return subtask
              .replace(/^\d+\.\s*/, "")
              .trim()
              .split("- ");
          });

          chrome.storage.local.set({ [id]: subtasks }, () => {
            console.log("subtasks saved to storage", subtasks);
          });
        })
        .catch((err) => console.error(err));

      // Indicate that we will call sendResponse asynchronously
      return true;
    }
    case "focus": {
      const { id, name, description } = request;

      focus.active = !focus.active;

      console.log("focus message received!, focus:", focus.active);

      focus.id = id;
      focus.name = name;
      focus.description = description;
    }
    default:
      break;
  }
});

// debounce to only have one event
let debounceTimer;

// tab activation
chrome.tabs.onUpdated.addListener(async () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });

    console.log("tab info", tab);
    const { url, title } = tab;

    if (
      url ===
      "file://wsl.localhost/Ubuntu/home/wilsonw13/repos/HackPrincetonFall2023/popup/distracted.html"
    )
      return;

    console.log(
      `fetching from GPT3; tabs title: ${title} | tab topic: ${focus.name}`
    );

    fetchGPT(
      "Given a website URL and/or the tab title, and some task the user is researching. Return 1 if the user is on an unrelated tab and 0 otherwise. Give a brief explanation on why the user is or isn't distracted. For example given the URL: https://en.wikipedia.org/wiki/George_Washington, Title: George Washington, Topic: Energy Drinks. 1 should be returned because George Washington's wikipedia is about the first president of the US which is not relevant to the topic you are currently focused on, which is energy drinks. Determine what the link is leading to and explain what it is.",
      `URL: ${url}, Tab Title: ${title}, Topic: ${focus.name}`
    )
      .then((res) => {
        console.log("retrieved from API:", res);

        const isDistracted = Boolean(Number(res.charAt(0)));

        if (isDistracted) {
          chrome.tabs.create({
            url: "file://wsl.localhost/Ubuntu/home/wilsonw13/repos/HackPrincetonFall2023/popup/distracted.html",
          });
        }
      })
      .catch((err) => console.error(err));
  }, 1000);
});
