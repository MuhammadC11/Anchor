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

      // have to use a port here to get past the unchecked runtime.lastError (w/ async calls)
      //       port = chrome.runtime.connect(null, { name: "hi" });
      //       port.onDisconnect.addListener((obj) => {
      //         console.log("disconnected port");
      //       });
      //
      //       port.sendMessage({ title, description, type: "newTask" }, (response) => {
      //         console.log("popup.js | Reponse: ", response);
      //       });

      chrome.runtime.sendMessage(
        { title, description, type: "newTask" },
        (response) => {
          console.log("popup.js | Reponse: ", response);
        }
      );
    });
});
