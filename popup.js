// Global variables
let accessToken = null;
let likedVideos = [];
let channels = [];
let currentPage = 1;
let totalResults = 0;
let currentKeyword = '';
let currentChannel = '';
let nextPageToken = '';
let prevPageToken = '';
let isLoading = false;

// DOM elements
const authButton = document.getElementById('auth-button');
const userInfo = document.getElementById('user-info');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const logoutButton = document.getElementById('logout-button');
const filterSection = document.getElementById('filter-section');
const keywordFilter = document.getElementById('keyword-filter');
const channelSelect = document.getElementById('channel-select');
const searchButton = document.getElementById('search-button');
const clearFiltersButton = document.getElementById('clear-filters');
const refreshButton = document.getElementById('refresh-data');
const loadingElement = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const videosContainer = document.getElementById('videos-container');
const emptyState = document.getElementById('empty-state');
const pagination = document.getElementById('pagination');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);
authButton.addEventListener('click', authenticate);
logoutButton.addEventListener('click', logout);
keywordFilter.addEventListener('keyup', (e) => {
  if (e.key === 'Enter') searchVideos();
});
searchButton.addEventListener('click', searchVideos);
channelSelect.addEventListener('change', filterByChannel);
clearFiltersButton.addEventListener('click', clearFilters);
refreshButton.addEventListener('click', refreshData);
prevPageButton.addEventListener('click', () => changePage('prev'));
nextPageButton.addEventListener('click', () => changePage('next'));

// Initialize the popup
async function initialize() {
  try {
    // Check if user is already authenticated
    const auth = await chrome.storage.local.get(['token', 'user']);
    
    if (auth.token) {
      accessToken = auth.token;
      showUserInfo(auth.user);
      showFilterSection();
      await fetchLikedVideos();
    } else {
      hideLoadingState();
      showAuthButton();
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to initialize. Please try again.');
  }
}

// Authentication
async function authenticate() {
  showLoadingState();
  
  try {
    // Send message to background script to handle authentication
    const response = await chrome.runtime.sendMessage({action: 'authenticate'});
    
    if (response.success) {
      accessToken = response.token;
      showUserInfo(response.user);
      showFilterSection();
      await fetchLikedVideos();
    } else {
      throw new Error(response.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showError('Failed to authenticate with Google. Please try again.');
    hideLoadingState();
  }
}

// Logout
async function logout() {
  try {
    await chrome.runtime.sendMessage({action: 'logout'});
    accessToken = null;
    likedVideos = [];
    channels = [];
    hideUserInfo();
    hideFilterSection();
    hideVideosContainer();
    hidePagination();
    hideEmptyState();
    showAuthButton();
    
    // Clear DOM
    videosContainer.innerHTML = '';
    channelSelect.innerHTML = '<option value="">All Channels</option>';
    
    // Reset filters
    currentKeyword = '';
    currentChannel = '';
    keywordFilter.value = '';
  } catch (error) {
    console.error('Logout error:', error);
    showError('Failed to logout. Please try again.');
  }
}

// Fetch liked videos from YouTube API
async function fetchLikedVideos(pageToken = '') {
  if (isLoading) return;
  
  showLoadingState();
  hideVideosContainer();
  hideEmptyState();
  hideError();
  isLoading = true;
  
  try {
    // Request parameters
    const maxResults = 50; // Maximum allowed by YouTube API
    let url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=${maxResults}`;
    
    if (pageToken) {
      url += `&pageToken=${pageToken}`;
    }
    
    // Fetch data from YouTube API
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to fetch liked videos');
    }
    
    const data = await response.json();
    likedVideos = data.items || [];
    nextPageToken = data.nextPageToken || '';
    prevPageToken = data.prevPageToken || '';
    totalResults = data.pageInfo?.totalResults || 0;
    
    // Update pagination
    updatePagination();
    
    // Extract unique channels
    extractChannels();
    
    // Display videos
    displayVideos(likedVideos);
    
    // Save data to storage for quick access later
    saveToStorage();
    
  } catch (error) {
    console.error('Error fetching liked videos:', error);
    
    if (error.message.includes('invalid_token') || error.message.includes('Invalid Credentials')) {
      showError('Your session has expired. Please sign in again.');
      logout();
    } else {
      showError(`Failed to fetch liked videos: ${error.message}`);
    }
    
    hideVideosContainer();
  } finally {
    hideLoadingState();
    isLoading = false;
  }
}

// Extract unique channels from videos
function extractChannels() {
  const uniqueChannels = {};
  
  likedVideos.forEach(video => {
    const channelId = video.snippet.channelId;
    const channelTitle = video.snippet.channelTitle;
    
    if (!uniqueChannels[channelId]) {
      uniqueChannels[channelId] = channelTitle;
    }
  });
  
  channels = Object.entries(uniqueChannels).map(([id, title]) => ({
    id,
    title
  }));
  
  // Sort channels alphabetically
  channels.sort((a, b) => a.title.localeCompare(b.title));
  
  // Populate channel select
  populateChannelSelect();
}

// Populate channel select dropdown
function populateChannelSelect() {
  // Clear existing options except the first one
  while (channelSelect.options.length > 1) {
    channelSelect.remove(1);
  }
  
  // Add channel options
  channels.forEach(channel => {
    const option = document.createElement('option');
    option.value = channel.id;
    option.textContent = channel.title;
    
    // Select the current channel if it matches
    if (channel.id === currentChannel) {
      option.selected = true;
    }
    
    channelSelect.appendChild(option);
  });
}

// Display videos in the UI
function displayVideos(videos) {
  // Clear previous videos
  videosContainer.innerHTML = '';
  
  if (videos.length === 0) {
    showEmptyState();
    hideVideosContainer();
    return;
  }
  
  // Create video elements
  videos.forEach(video => {
    const videoElement = createVideoElement(video);
    videosContainer.appendChild(videoElement);
  });
  
  hideEmptyState();
  showVideosContainer();
}

// Create video element
function createVideoElement(video) {
  const videoItem = document.createElement('div');
  videoItem.className = 'video-item';
  videoItem.dataset.videoId = video.id;
  
  // Make the entire item clickable
  videoItem.addEventListener('click', () => {
    window.open(`https://www.youtube.com/watch?v=${video.id}`, '_blank');
  });
  
  // Get thumbnail (medium quality)
  const thumbnailUrl = video.snippet.thumbnails.medium?.url || 
                      video.snippet.thumbnails.default?.url;
  
  // Format date
  const publishedDate = new Date(video.snippet.publishedAt);
  const formattedDate = publishedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  // Build HTML
  videoItem.innerHTML = `
    <div class="video-thumbnail" style="background-image: url('${thumbnailUrl}')"></div>
    <div class="video-info">
      <div class="video-title">${video.snippet.title}</div>
      <div class="channel-name">${video.snippet.channelTitle}</div>
      <div class="video-date">${formattedDate}</div>
    </div>
  `;
  
  return videoItem;
}

// Search videos by keyword
function searchVideos() {
  currentKeyword = keywordFilter.value.trim().toLowerCase();
  filterVideos();
}

// Filter videos by channel
function filterByChannel() {
  currentChannel = channelSelect.value;
  filterVideos();
}

// Apply filters to videos
function filterVideos() {
  let filteredVideos = [...likedVideos];
  
  // Filter by channel
  if (currentChannel) {
    filteredVideos = filteredVideos.filter(video => 
      video.snippet.channelId === currentChannel
    );
  }
  
  // Filter by keyword
  if (currentKeyword) {
    filteredVideos = filteredVideos.filter(video => {
      const title = video.snippet.title.toLowerCase();
      const description = (video.snippet.description || '').toLowerCase();
      return title.includes(currentKeyword) || description.includes(currentKeyword);
    });
  }
  
  // Display filtered videos
  displayVideos(filteredVideos);
}

// Clear all filters
function clearFilters() {
  currentKeyword = '';
  currentChannel = '';
  keywordFilter.value = '';
  channelSelect.value = '';
  
  // Display all videos
  displayVideos(likedVideos);
}

// Refresh data
async function refreshData() {
  // Reset pagination
  currentPage = 1;
  
  // Fetch videos from the beginning
  await fetchLikedVideos();
}

// Change page
function changePage(direction) {
  if (direction === 'next' && nextPageToken) {
    currentPage++;
    fetchLikedVideos(nextPageToken);
  } else if (direction === 'prev' && prevPageToken) {
    currentPage--;
    fetchLikedVideos(prevPageToken);
  }
}

// Update pagination UI
function updatePagination() {
  pageInfo.textContent = `Page ${currentPage}`;
  
  // Enable/disable buttons
  prevPageButton.disabled = !prevPageToken;
  nextPageButton.disabled = !nextPageToken;
  
  if (likedVideos.length > 0) {
    showPagination();
  } else {
    hidePagination();
  }
}

// Save data to storage
async function saveToStorage() {
  try {
    await chrome.storage.local.set({
      likedVideos,
      channels,
      nextPageToken,
      prevPageToken,
      currentPage,
      totalResults
    });
  } catch (error) {
    console.error('Error saving to storage:', error);
  }
}

// Show user info
function showUserInfo(user) {
  if (user) {
    userAvatar.src = user.picture;
    userName.textContent = user.name;
    userInfo.classList.remove('hidden');
    authButton.classList.add('hidden');
  }
}

// Hide user info
function hideUserInfo() {
  userInfo.classList.add('hidden');
}

// Show auth button
function showAuthButton() {
  authButton.classList.remove('hidden');
}

// Show filter section
function showFilterSection() {
  filterSection.classList.remove('hidden');
}

// Hide filter section
function hideFilterSection() {
  filterSection.classList.add('hidden');
}

// Show videos container
function showVideosContainer() {
  videosContainer.classList.remove('hidden');
}

// Hide videos container
function hideVideosContainer() {
  videosContainer.classList.add('hidden');
}

// Show empty state
function showEmptyState() {
  emptyState.classList.remove('hidden');
}

// Hide empty state
function hideEmptyState() {
  emptyState.classList.add('hidden');
}

// Show pagination
function showPagination() {
  pagination.classList.remove('hidden');
}

// Hide pagination
function hidePagination() {
  pagination.classList.add('hidden');
}

// Show loading state
function showLoadingState() {
  loadingElement.classList.remove('hidden');
}

// Hide loading state
function hideLoadingState() {
  loadingElement.classList.add('hidden');
}

// Show error message
function showError(message) {
  errorText.textContent = message;
  errorMessage.classList.remove('hidden');
}

// Hide error message
function hideError() {
  errorMessage.classList.add('hidden');
}
