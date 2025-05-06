/**
 * Utility functions for YouTube Liked Videos Filter extension
 */

// Format date string to a readable format
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format view count with appropriate suffixes (K, M, B)
function formatViewCount(count) {
  if (!count) return '0 views';
  
  const num = parseInt(count);
  
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B views';
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M views';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K views';
  } else {
    return num + ' views';
  }
}

// Format duration from ISO 8601 format to readable format (HH:MM:SS)
function formatDuration(isoDuration) {
  if (!isoDuration) return '';
  
  // PT1H2M3S -> 1:02:03
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!match) return '';
  
  const hours = match[1] ? parseInt(match[1]) : 0;
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const seconds = match[3] ? parseInt(match[3]) : 0;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

// Truncate text with ellipsis if it exceeds maxLength
function truncateText(text, maxLength) {
  if (!text) return '';
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + '...';
}

// Escape HTML to prevent XSS
function escapeHTML(text) {
  if (!text) return '';
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Debounce function to limit how often a function can be called
function debounce(func, wait) {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Parse YouTube video ID from various URL formats
function extractVideoId(url) {
  if (!url) return null;
  
  // Regular expression to match YouTube video ID from different URL formats
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  
  return match ? match[1] : null;
}

// Create a YouTube watch URL from a video ID
function createYouTubeUrl(videoId) {
  if (!videoId) return '#';
  
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// Create a channel URL from a channel ID
function createChannelUrl(channelId) {
  if (!channelId) return '#';
  
  return `https://www.youtube.com/channel/${channelId}`;
}

// Check if the user is logged in
async function isLoggedIn() {
  try {
    const auth = await chrome.storage.local.get(['token']);
    return !!auth.token;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
}

// Get current user info
async function getUserInfo() {
  try {
    const auth = await chrome.storage.local.get(['user']);
    return auth.user || null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

// Export all utility functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatDate,
    formatViewCount,
    formatDuration,
    truncateText,
    escapeHTML,
    debounce,
    extractVideoId,
    createYouTubeUrl,
    createChannelUrl,
    isLoggedIn,
    getUserInfo
  };
}
