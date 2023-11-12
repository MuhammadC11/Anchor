function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const id = generateId();
    const task = {
      name: document.getElementById("task_name").value,
      description: document.getElementById("task_description").value,
      due_date: document.getElementById("due_date").value,
      priority: document.getElementById("priority").value,
    };

    chrome.storage.local.set(
      {
        [id]: task,
      },
      () => {
        console.log("task saved to storage", task);
      }
    );

    window.location.href = `../ViewTask/viewTask.html?id=${id}`;
  });
});
