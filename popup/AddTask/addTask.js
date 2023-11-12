document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("add");
  if (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault(); // Prevent the form from submitting
      window.location.href = "../ViewTask/viewTask.html";
    });
  } else {
    console.log('Button with id "add" does not exist');
  }
});
