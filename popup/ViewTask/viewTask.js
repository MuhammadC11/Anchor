const taskListElement = document.querySelector("#task-list");

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".details-container");
  const optionsElement = document.querySelector(".options-container");
  const subtaskElement = document.querySelector(".subtask-container");

  // const task = Object.values(jsonData)[0];

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  let subtasksPresent = false;

  chrome.storage.local.get(id, (task) => {
    console.log(`task id ${id} retrieved:`, task);

    const { name, description, due_date, priority, subtasks } = task[id];

    subtasksPresent = !!subtasks;

    taskListElement.insertAdjacentHTML(
      "beforeend",
      `<div class="details-container">
    <h1 class="title">Task Name: ${name}</h1>
    <h2 class="description">Task Description: ${description}</h2>
  </div>`
    );

    optionsElement.insertAdjacentHTML(
      "beforeend",
      `<div class="btn" id="dueDateBtn">
      <img svg="calendar-regular.svg" />Due date:
      <div id="datePicker" class="hidden">
        ${due_date}
      </div>
    </div>

    <div class="btn" id="priorityBtn">
      <img svg="flag-regular.svg" />
      Priority: <span id="priority"> ${priority}</span>
    </div>`
    );

    console.log("subtasks:", subtasks, "subtasksPresent:", subtasksPresent);

    if (subtasksPresent)
      subtaskElement.insertAdjacentHTML(
        "beforeend",
        `<ul class="subtask-name">
        ${subtasks
          .map(
            (subTaskArray) =>
              `<h2>${subTaskArray[0]}</h2>
          ${subTaskArray
            .slice(1)
            .map((subtasks) => `<li>${subtasks}</li>`)
            .join("")}`
          )
          .join("")}
      </ul>`
      );
    else {
      // listen for when subtasks are added

      console.log("listening for changes");

      chrome.storage.onChanged.addListener((changes, namespace) => {
        for (let key in changes) {
          if (key === id) {
            const storageChange = changes[key];
            console.log(
              `Subtasks for the id "${key}" were: "${storageChange.oldValue}". New value: "${storageChange.newValue}".`
            );

            // Fetch the subtasks
            chrome.storage.local.get(id, (task) => {
              const ttask = task[id];
              console.log("Fetched tasks:", task);

              subtaskElement.insertAdjacentHTML(
                "beforeend",
                `<ul class="subtask-name">
                ${ttask.subtasks
                  .map(
                    (subtaskArray) =>
                      `<h2>${subtaskArray[0]}</h2>
                  ${subtaskArray
                    .slice(1)
                    .map((subtasks) => `<li>${subtasks}</li>`)
                    .join("")}`
                  )
                  .join("")}
              </ul>`
              );
            });
          }
        }
      });
    }

    // focus button
    const focusBtn = document.querySelector("#focus-btn");
    focusBtn.addEventListener("click", (e) => {
      chrome.runtime.sendMessage({
        id,
        name,
        description,
        type: "focus",
      });
    });
  });
});
