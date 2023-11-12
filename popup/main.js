// This file will only have access to the pop up extensions DOM

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".taskList");

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  chrome.storage.local.get(null, function (data) {
    const taskIds = Object.keys(data);
    for (const id of taskIds) {
      const taskName = data[id].name;
      taskListElement.insertAdjacentHTML(
        "beforeend",
        `<a class="taskNames" href="./ViewTask/viewTask.html?id=${id}">${taskName}</a>`
      );
    }
  });
});
