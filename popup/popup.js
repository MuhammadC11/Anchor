// This file will only have access to the pop up extensions DOM

document.addEventListener("DOMContentLoaded", () => {
  document
    .querySelector("#task-input-form")
    .addEventListener("submit", (event) => {
      event.preventDefault();

      const title = document.querySelector('input[name="title"]').value;
      const description = document.querySelector(
        'input[name="description"]'
      ).value;

      console.log("popup.js | form submitted");

      //       chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      //         chrome.tabs.sendMessage(
      //           tab.id,
      //           { title, description, type: "newTask" },
      //           (response) => {
      //             console.log("popup.js | Response: ", response);
      //
      //             const steps = response.data.split("\n\n");
      //
      //             document
      //               .querySelector(".container")
      //               .insertAdjacentHTML(
      //                 "beforeend",
      //                 `<ol>${steps.map((step) => `<ul>${step}</ul>`)}</ol>`
      //               );
      //           }
      //         );
      //       });

      chrome.runtime.sendMessage(
        { title, description, type: "newTask" },
        (response) => callback(response)
      );

      function callback(response) {
        console.log("popup.js | Response: ", response);

        const steps = response.data.split("\n");

        document
          .querySelector(".container")
          .insertAdjacentHTML(
            "beforeend",
            `<ol>${steps.map((step) => `<ul>${step}</ul>`)}</ol>`
          );
      }
    });
});
