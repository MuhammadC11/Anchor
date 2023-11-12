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

// Iterate over the JSON data and modify the DOM elements.
for (const taskId in jsonData) {
  const task = jsonData[taskId];

  const taskElement = document.querySelector(`#task-${taskId}`);

  taskElement.textContent = task.name;
}
