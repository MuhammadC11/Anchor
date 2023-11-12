const taskListElement = document.querySelector("#task-list");

const jsonData = {
  "8a69f5b3-7e82-4c11-b4d1-2bce96b9b5b1": {
    name: "Project_One",
    description: "Description for Project One",
    subtasks: [
      ["Subtask One.1.1", "Subtask One.1.2", "Subtask One.1.3"],
      ["Subtask One.2.1", "Subtask One.2.2", "Subtask One.2.3"],
      ["Subtask One.3.1", "Subtask One.3.2", "Subtask One.3.3"],
      ["Subtask One.4.1", "Subtask One.4.2", "Subtask One.4.3"],
      ["Subtask One.5.1", "Subtask One.5.2", "Subtask One.5.3"],
    ],
    due_date: "2023-11-15",
    priority: 2,
  },
  "4b3ec06e-2650-4f35-9a68-735e8a1506af": {
    name: "Project_Two",
    description: "Description for Project Two",
    subtasks: [
      ["Subtask Two.1.1", "Subtask Two.1.2", "Subtask Two.1.3"],
      ["Subtask Two.2.1", "Subtask Two.2.2", "Subtask Two.2.3"],
      ["Subtask Two.3.1", "Subtask Two.3.2", "Subtask Two.3.3"],
      ["Subtask Two.4.1", "Subtask Two.4.2", "Subtask Two.4.3"],
      ["Subtask Two.5.1", "Subtask Two.5.2", "Subtask Two.5.3"],
    ],
    due_date: "2023-11-18",
    priority: 3,
  },
  "c2fe6bc0-ec6f-4a2e-bf4a-17a4b642a26c": {
    name: "Project_Three",
    description: "Description for Project Three",
    subtasks: [
      ["Subtask Three.1.1", "Subtask Three.1.2", "Subtask Three.1.3"],
      ["Subtask Three.2.1", "Subtask Three.2.2", "Subtask Three.2.3"],
      ["Subtask Three.3.1", "Subtask Three.3.2", "Subtask Three.3.3"],
      ["Subtask Three.4.1", "Subtask Three.4.2", "Subtask Three.4.3"],
      ["Subtask Three.5.1", "Subtask Three.5.2", "Subtask Three.5.3"],
    ],
    due_date: "2023-11-20",
    priority: 1,
  },
};

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
              `Subtasks for the id "${key}"were: "${storageChange.oldValue}". New value: "${storageChange.newValue}".`
            );

            // Fetch the subtasks
            chrome.storage.local.get(id, (task) => {
              const subtasks = task[id];
              console.log("Fetched subtasks:", subtasks);

              subtaskElement.insertAdjacentHTML(
                "beforeend",
                `<ul class="subtask-name">
                ${subtasks
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
  });

  // listen for when subtasks are added (if they aren't already)
  if (!subtasksPresent) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      for (let key in changes) {
        if (key === id) {
          const storageChange = changes[key];
          console.log(
            'Subtasks for the id "%s" were: "%s". New value: "%s".',
            key,
            storageChange.oldValue,
            storageChange.newValue
          );

          // Fetch the subtasks
          chrome.storage.local.get(id, (task) => {
            const subtasks = task[id];
            console.log("Fetched subtasks:", subtasks);

            // TODO: Use the fetched subtasks
          });
        }
      }
    });
  }
});
