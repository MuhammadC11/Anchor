// This file will only have access to the browsers DOM

chrome.runtime.onMessage.addListener((request) => {
  if (request.status === "validated") {
    console.log("validated");
  }
});

// from addTask.html store the form data in local storage
const form = document.getElementById("taskForm");
form.addEventListener("submit", (event) => {
  event.preventDefault(); // prevent the page from refreshing
  const task = document.getElementById("task").value; // get the value of the input field
  const description = document.getElementById("description").value;
  const taskObj = {
    // create an object to store the task
    task, // this is the same as task: task
    description,
    completed: false, // set the completed property to false by default
  };
  const timestamp = new Date().getTime(); // get the current timestamp
  chrome.storage.local.set({ [timestamp]: taskObj }, () => {
    // save the task object in local storage
    console.log("task saved");
  });
});

// from popup.html get the tasks from local storage and display them
const tasks = document.getElementById("tasks");
chrome.storage.local.get(null, (data) => {
  const keys = Object.keys(data);
  keys.forEach((key) => {
    const task = data[key];
    const taskElement = document.createElement("div");
    taskElement.innerHTML = `
	  <input type="checkbox" id="${key}" ${task.completed ? "checked" : ""}>
	  <label for="${key}">${task.task}</label>
	`;
    tasks.appendChild(taskElement);
  });
});

// from popup.html listen for changes to the checkboxes and update local storage
tasks.addEventListener("change", (event) => {
  const id = event.target.id; // get the id of the checkbox
  const checked = event.target.checked;
  chrome.storage.local.get(id, (data) => {
    const obj = data[id];
    obj.completed = checked;
    chrome.storage.local.set({ [id]: obj }, () => {
      console.log("task updated");
    });
  });
});

// from popup.html listen for clicks on the clear button and clear local storage
const clear = document.getElementById("clear");
clear.addEventListener("click", () => {
  chrome.storage.local.clear(() => {
    console.log("storage cleared");
  });
});
