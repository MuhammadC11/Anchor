// This file will act as the middleware that helps facilitate resources between content-script & popup

async function fetchGPT(systemMessage, userMessage) {
  const OPENAI_API_KEY = "";
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
    case "newTask":
      const { id, name, description } = request;

      console.log(`fetching GPT3: ${name} | ${description}`);

      fetchGPT(
        "Given the task name (first sentence) and description, break up this task into actionable subtasks so I have an idea of where to start with my task. Limit this to 5 subtasks maximum and ONLY return these 5 subtasks, along with a 1-3 tips for each. After naming each subtask, do not use a semicolon and prefix each tip with '\n- '. Sample Output: 1. subtask\n- tip\n- tip\n- tip\n2. subtask\n- tip\n- tip\n- tip\n3. subtask\n- tip\n- tip\n- tip\n ...",
        `Title: ${name}. ${description}`
      )
        .then((res) => {
          console.log("sent to API:", res);

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

    default:
      break;
  }
});

// tab activation
chrome.tabs.onUpdated.addListener(async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const url = tab.url;
  // const tabId = tab.id;
  const tabName = tab.title;

  // console.log("tab name", tabName);
  // console.log("url", url);
  //
  //   const response = await fetchGPT3(
  //     "",
  //     `Give a one sentence elaboration on: ${url}`
  //   ).then();
  //
  //   console.log("response:", response);
});
