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

//   const params = new URLSearchParams(window.location.search);
//   const id = params.get("id");

//   const taskIds = Object.keys(jsonData);
//   for (const id of taskIds) {
//     const taskName = jsonData[id].name;
//     taskListElement.insertAdjacentHTML(
//       "beforeend",
//       `<h2 class="taskNames">${taskName}</h2>`
//     );
//   }
// });

//this is the CORRECT CODE

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");
  const taskNamesElement = document.querySelector(".taskNames");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  chrome.storage.local.get(null, function (data) {
    const taskIds = Object.keys(data);
    for (const id of taskIds) {
      const taskName = data[id].name;
      taskListElement.insertAdjacentHTML(
        "beforeend",
        `<a class="taskNames" href="./ViewTask/viewTask.html?id=${id}" id="${id}">${taskName}</a>
        
        `
      );
    }
  });

  // this is the code for the delete button
  //   if (taskNamesElement) {
  //     var deleteID = taskNamesElement.getAttribute("id");

  //     var deleteTaskElement = document.getElementById("deleteTask");
  //     if (deleteTaskElement) {
  //       deleteTaskElement.addEventListener("click", function () {
  //         console.log("delete button clicked");

  //         chrome.storage.local.remove([deleteID], function () {
  //           var error = chrome.runtime.lastError;
  //           if (error) {
  //             console.error(error);
  //           } else {
  //             location.reload();
  //           }
  //         });
  //       });
  //     }
  //   }

  // this is the code for the clear all button on click of a button
  var clearTasksElement = document.getElementById("clearTasks");
  if (clearTasksElement) {
    clearTasksElement.addEventListener("click", function () {
      chrome.storage.local.clear(function () {
        var error = chrome.runtime.lastError;
        if (error) {
          console.error(error);
        } else {
          location.reload();
        }
      });
    });
  }
});
