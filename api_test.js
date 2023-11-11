const OPENAI_API_KEY = "";

const apiUrl = "https://api.openai.com/v1/chat/completions";

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${OPENAI_API_KEY}`,
};

const data = {
  model: "gpt-3.5-turbo",
  messages: [
    {
      role: "system",
      content:
        "Given the task name and description, break up this task into actionable subtasks so I have an idea of where to start with my task. Limit this to 5 subtasks maximum.",
    },
    {
      role: "user",
      content: "Develop a web app that implements a weather API.",
    },
  ],
};

fetch(apiUrl, {
  method: "POST",
  headers: headers,
  body: JSON.stringify(data),
})
  .then((response) => console.log(JSON.stringify(response.json())))
  .then((result) => console.log(result))
  .catch((error) => console.error("Error:", error));
