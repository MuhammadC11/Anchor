// This file will only have access to the pop up extensions DOM

const jsonData = {
  task1: {
    name: "task2",
    description: "task1 description",
    due_date: "task1 due date",
    priority: "task1 priority",
    subtasks: [
      [
        "subtask1",
        "subtask1 description",
        "subtask1 due date",
        "subtask1 priority",
      ],
      [
        "subtask2",
        "subtask2 description",
        "subtask2 due date",
        "subtask2 priority",
      ],
    ],
  },
  task2: {
    name: "task3",
    description: "task2 description",
    due_date: "task2 due date",
    priority: "task2 priority",
    subtasks: [
      [
        "subtask1",
        "subtask1 description",
        "subtask1 due date",
        "subtask1 priority",
      ],
      [
        "subtask2",
        "subtask2 description",
        "subtask2 due date",
        "subtask2 priority",
      ],
    ],
  },
};

// document.addEventListener("DOMContentLoaded", () => {
//   const taskListElement = document.querySelector(".taskList");

//   // const task = Object.values(jsonData)[0];

//   const params = new URLSearchParams(window.location.search);
//   const id = params.get("id");

//   chrome.storage.local.get("taskIds", function (data) {
//     const taskIds = data.taskIds || [];
//     for (const id of taskIds) {
//       chrome.storage.local.get(id, function (task) {
//         const { name } = task[id];
//         name = Object.values(jsonData)[0].name;
//         taskListElement.insertAdjacentHTML(
//           "beforeend",
//           `<h2 class="taskNames">${name}</h2>`
//         );
//       });
//     }
//   });
// });

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const taskIds = Object.keys(jsonData);
  for (const id of taskIds) {
    const taskName = jsonData[id].name;
    taskListElement.insertAdjacentHTML(
      "beforeend",
      `<h2 class="taskNames">${taskName}</h2>`
    );
  }
});

//this is the CORRECT CODE

// document.addEventListener("DOMContentLoaded", () => {
//   const taskListElement = document.querySelector(".taskList");

//   const params = new URLSearchParams(window.location.search);
//   const id = params.get("id");

//   chrome.storage.local.get("taskIds", function (data) {
//     const taskIds = data.taskIds || [];
//     for (const id of taskIds) {
//       chrome.storage.local.get(id, function (task) {
//         const taskName = task[id].name;
//         taskListElement.insertAdjacentHTML(
//           "beforeend",
//           `<h2 class="taskNames">${taskName}</h2>`
//         );
//       });
//     }
//   });
// });
