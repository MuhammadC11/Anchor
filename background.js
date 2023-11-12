// This file will act as the middleware that helps facilitate resources between content-script & popup

// const handleTabActivation = async () => {
//   const [tab] = await chrome.tabs.query({
//     active: true,
//     lastFocusedWindow: true,
//   });
//   const url = tab.url;
//   // const tabId = tab.id;
//   const tabName = tab.title;
//
//   // console.log("tab name", tabName);
//   // console.log("url", url);
// };
//
// chrome.tabs.onUpdated.addListener(() => {
//   handleTabActivation();
// });

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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.type) {
    case "newTask":
      const { title, description } = request;

      console.log(`fetching GPT3: ${title} | ${description}`);
      fetchGPT(
        "Given the task name and description, break up this task into actionable subtasks so I have an idea of where to start with my task. Limit this to 5 subtasks maximum. Separate each subtask with a single '\\n' and do not enumerate them (it is implied), or prefix with any symbol. Please only take 10 seconds to respond.",
        `Title: ${title}\nDescription: ${description}`
      )
        .then((response) => {
          console.log("sent to API:", response);
          sendResponse({ message: "Task received", data: response });
        })
        .catch((error) => {
          console.error(error);
          sendResponse({ message: "Error occurred", data: error });
        });

      // Indicate that we will call sendResponse asynchronously
      return true;

    default:
      break;
  }
});
