const taskListElement = document.querySelector("#task-list");

const jsonData = {
  "8a69f5b3-7e82-4c11-b4d1-2bce96b9b5b1": {
    name: "Task_One",
    description: "Description for Task One",
    subtasks: ["Subtask One.1", "Subtask One.2", "Subtask One.3"],
    due_date: "2023-11-15",
    priority: 2,
  },
  "4b3ec06e-2650-4f35-9a68-735e8a1506af": {
    name: "Task_Two",
    description: "Description for Task Two",
    subtasks: ["Subtask Two.1", "Subtask Two.2"],
    due_date: "2023-11-18",
    priority: 3,
  },
  "c2fe6bc0-ec6f-4a2e-bf4a-17a4b642a26c": {
    name: "Task_Three",
    description: "Description for Task Three",
    subtasks: [
      "Subtask Three.1",
      "Subtask Three.2",
      "Subtask Three.3",
      "Subtask Three.4",
    ],
    due_date: "2023-11-20",
    priority: 1,
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const taskListElement = document.querySelector(".details-container");

  //   for (const taskId in jsonData) {
  //     const task = jsonData[taskId];

  //     // Create a new div for the task
  //     const taskElement = document.createElement("div");

  //     // Create elements for the name and description
  //     const nameElement = document.createElement("h2");
  //     nameElement.textContent = task.name;
  //     nameElement.className = "name";

  //     const descriptionElement = document.createElement("p");
  //     descriptionElement.textContent = task.description;
  //     descriptionElement.className = "description";

  //     // Append the name and description to the task element
  //     taskElement.appendChild(nameElement);
  //     taskElement.appendChild(descriptionElement);

  //     // Append the task element to the task list
  //     taskListElement.appendChild(taskElement);
  //   }
  const task = Object.values(jsonData)[0];

  taskListElement.insertAdjacentHTML(
    "beforeend",
    `<div class="details-container">
  <h1 class="title"> ${task.name}</h1>
  <h3 class="description"> ${task.description}</h3>
</div>`
  );
});
