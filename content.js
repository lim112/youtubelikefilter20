// This content script is minimal as most of the functionality is handled by the popup
// It can be expanded if needed to interact with YouTube pages directly

console.log('YouTube Liked Videos Filter content script loaded');

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkYouTubePage') {
    // Check if we're on a YouTube page
    const isYouTubePage = window.location.hostname.includes('youtube.com');
    sendResponse({ isYouTubePage });
  }
  return true;
});
