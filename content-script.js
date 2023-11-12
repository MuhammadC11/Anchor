// This file will only have access to the browsers DOM

/* async function fetchGPT(systemMessage, userMessage) {
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
        "Given the task name and description, break up this task into actionable subtasks so I have an idea of where to start with my task. Limit this to 5 subtasks maximum.",
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
}); */

//   const response = await fetchGPT3(
//     "",
//     `Give a one sentence elaboration on: ${url}`
//   ).then();
//
//   console.log("response:", response);
