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

const handleTabActivation = async () => {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const url = tab.url;
  // const tabId = tab.id;
  const tabName = tab.title;

  console.log("tab name", tabName);
  console.log("url", url);

  //   const response = await fetchGPT3(
  //     "",
  //     `Give a one sentence elaboration on: ${url}`
  //   ).then();
  //
  //   console.log("response:", response);
};

chrome.tabs.onUpdated.addListener(() => {
  handleTabActivation();
});
