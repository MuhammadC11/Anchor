function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 15);
}

document.addEventListener("DOMContentLoaded", () => {
  const dueDateBtn = document.getElementById("dueDateBtn");
  const datePicker = document.getElementById("datePicker");

  if (dueDateBtn && datePicker) {
    dueDateBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      datePicker.classList.toggle("hidden");
    });
    document.addEventListener("click", (event) => {
      if (
        !dueDateBtn.contains(event.target) &&
        !datePicker.contains(event.target)
      ) {
        datePicker.classList.add("hidden");
      }
    });
  }

  document.getElementById("taskForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const id = generateId();
    const name = document.getElementById("task_name").value.trim();
    const description = document
      .getElementById("task_description")
      .value.trim();
    const due_date = document.getElementById("due_date").value;
    const priority = document.getElementById("priority").value;

    if (!name || !description) {
      alert("Please enter a task name and description.");
      return;
    }

    const task = { id, name, description, due_date, priority, subtasks: [] };
    await addTask(task);

    chrome.runtime.sendMessage({
      id,
      name,
      description,
      type: "newTask",
    });

    window.location.href = `../ViewTask/viewTask.html?id=${encodeURIComponent(id)}`;
  });
});
