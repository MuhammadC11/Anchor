// This file will only have access to the pop up extensions DOM

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");
  const taskNamesElement = document.querySelector(".taskNames");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  chrome.storage.local.get(null, (data) => {
    console.log(data);

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
