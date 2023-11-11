// This file will act as the middleware that helps facilitate resources between content-script & popup

const handleTabActivation = async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    const url = tab.url;
    // const tabId = tab.id;
    const tabName = tab.title

    console.log(tabName)
    console.log(url)
  };

  chrome.tabs.onUpdated.addListener(() => {
    handleTabActivation();
  });
  