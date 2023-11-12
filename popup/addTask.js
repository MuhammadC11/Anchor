document.addEventListener("DOMContentLoaded", function () {
  // Get references to elements
  const dueDateBtn = document.getElementById("dueDateBtn");
  const datePicker = document.getElementById("datePicker");
  const selectedDateInput = document.getElementById("selectedDate");
  const storeDateBtn = document.getElementById("storeDateBtn");

  // Event listener to store the selected date
  storeDateBtn.addEventListener("click", function () {
    const selectedDate = selectedDateInput.value;
    console.log("Selected Date:", selectedDate);
  });
});
