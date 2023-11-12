function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const id = generateId();

    const name = document.getElementById("task_name").value;
    const description = document.getElementById("task_description").value;
    const due_date = document.getElementById("due_date").value;
    const priority = document.getElementById("priority").value;

    chrome.storage.local.set(
      {
        [id]: { name, description, due_date, priority },
      },
      () => {
        console.log("task saved to storage", id, name);
      }
    );

    // passes to msg listener in background.js
    chrome.runtime.sendMessage({
      id,
      name,
      description,
      type: "newTask",
    });

    window.location.href = `../ViewTask/viewTask.html?id=${id}`;
  });
});
