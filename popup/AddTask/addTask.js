function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15); // Generates a unique ID based on current time and random string
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("taskForm").addEventListener("submit", (e) => {
    e.preventDefault(); // Prevents the default form submission behavior

    const id = generateId(); // Generates a unique ID for the task

    const name = document.getElementById("task_name").value; // Gets the task name from the input field
    const description = document.getElementById("task_description").value; // Gets the task description from the input field
    const due_date = document.getElementById("due_date").value; // Gets the due date from the input field
    const priority = document.getElementById("priority").value; // Gets the priority from the input field
    chrome.storage.local.set(
      {
        [id]: { name, description, due_date, priority }, // Saves the task to local storage with the generated ID
      },
      () => {
        console.log("task saved to storage", id, name); // Logs confirmation of task saving
      }
    );

    // passes to msg listener in background.js
    chrome.runtime.sendMessage({
      id, // Sends the generated ID
      name, // Sends the task name
      description, // Sends the task description
      type: "newTask", // Indicates the type of message
    });

    window.location.href = `../ViewTask/viewTask.html?id=${id}`; // Redirects to the view task page with the task ID in the URL
  });
});
