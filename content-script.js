// This file will only have access to the browsers DOM

chrome.runtime.onMessage.addListener((request) => {
	if (request.status === "validated") {

	}
})
