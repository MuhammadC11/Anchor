// Sample array of strings
const strings = [
  "Caught in the web of distraction.",
  "Scroll of shame...",
  "Top 10 browser betrayals",
  "...How did we even get here?",
  "Succumbed to temptation.",
  "Side eye.",
  "EMERGENCY MEETING!! We caught u lacking.",
];

// Get a random index for the strings array
const randomIndex = Math.floor(Math.random() * strings.length);

// Get a random sentence from the array
const randomSentence = strings[randomIndex];

// Display the random sentence on the page
// Ensure the DOM is loaded before trying to access elements
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("random-sentence").innerText = randomSentence;
});

//   // Sample array of image URLs (uncomment and use if you add images)
//   // const images = [
//   //   "image1.jpg",
//   //   "image2.jpg",
//   //   "image3.jpg",
//   //   "image4.jpg",
//   //   "image5.jpg",
//   // ];

//   // // Get a random index for the images array
//   // const randomImageIndex = Math.floor(Math.random() * images.length);

//   // // Get a random image URL from the array
//   // const randomImageUrl = images[randomImageIndex];

//   // // Display the random image on the page
//   // // document.getElementById("random-image").src = randomImageUrl;
