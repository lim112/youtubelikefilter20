// DOM elements
const authStatusText = document.getElementById('auth-status-text');
const userProfile = document.getElementById('user-profile');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');
const userEmail = document.getElementById('user-email');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const resultsPerPage = document.getElementById('results-per-page');
const showDescriptions = document.getElementById('show-descriptions');
const autoRefresh = document.getElementById('auto-refresh');
const clearCacheButton = document.getElementById('clear-cache-button');
const exportDataButton = document.getElementById('export-data-button');

// Event listeners
document.addEventListener('DOMContentLoaded', initialize);
loginButton.addEventListener('click', authenticate);
logoutButton.addEventListener('click', logout);
resultsPerPage.addEventListener('change', saveSettings);
showDescriptions.addEventListener('change', saveSettings);
autoRefresh.addEventListener('change', saveSettings);
clearCacheButton.addEventListener('click', clearCache);
exportDataButton.addEventListener('click', exportData);

// Initialize the options page
async function initialize() {
  try {
    // Check authentication status
    await checkAuthStatus();
    
    // Load saved settings
    await loadSettings();
  } catch (error) {
    console.error('Initialization error:', error);
    authStatusText.textContent = 'Error loading settings';
    authStatusText.style.color = '#c62828';
  }
}

// Check authentication status
async function checkAuthStatus() {
  try {
    const auth = await chrome.storage.local.get(['token', 'user']);
    
    if (auth.token && auth.user) {
      // User is authenticated
      showAuthenticatedState(auth.user);
    } else {
      // User is not authenticated
      showUnauthenticatedState();
    }
  } catch (error) {
    console.error('Auth status check error:', error);
    showUnauthenticatedState();
  }
}

// Show authenticated state
function showAuthenticatedState(user) {
  authStatusText.textContent = 'Authenticated';
  authStatusText.style.color = '#4caf50';
  
  // Display user info
  userAvatar.src = user.picture;
  userName.textContent = user.name;
  userEmail.textContent = user.email;
  userProfile.classList.remove('hidden');
  
  // Show/hide buttons
  loginButton.classList.add('hidden');
  logoutButton.classList.remove('hidden');
}

// Show unauthenticated state
function showUnauthenticatedState() {
  authStatusText.textContent = 'Not authenticated';
  authStatusText.style.color = '#f44336';
  
  // Hide user info
  userProfile.classList.add('hidden');
  
  // Show/hide buttons
  loginButton.classList.remove('hidden');
  logoutButton.classList.add('hidden');
}

// Load settings from storage
async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get({
      resultsPerPage: 50,
      showDescriptions: true,
      autoRefresh: true
    });
    
    // Apply settings to form
    resultsPerPage.value = settings.resultsPerPage;
    showDescriptions.checked = settings.showDescriptions;
    autoRefresh.checked = settings.autoRefresh;
  } catch (error) {
    console.error('Error loading settings:', error);
    throw error;
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    const settings = {
      resultsPerPage: parseInt(resultsPerPage.value),
      showDescriptions: showDescriptions.checked,
      autoRefresh: autoRefresh.checked
    };
    
    await chrome.storage.local.set({ settings });
    
    // Show saved notification
    showNotification('Settings saved');
  } catch (error) {
    console.error('Error saving settings:', error);
    showNotification('Error saving settings', true);
  }
}

// Authenticate user
async function authenticate() {
  try {
    const response = await chrome.runtime.sendMessage({action: 'authenticate'});
    
    if (response.success) {
      showAuthenticatedState(response.user);
      showNotification('Authentication successful');
    } else {
      throw new Error(response.error || 'Authentication failed');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showNotification('Authentication failed: ' + error.message, true);
  }
}

// Logout user
async function logout() {
  try {
    await chrome.runtime.sendMessage({action: 'logout'});
    showUnauthenticatedState();
    showNotification('Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    showNotification('Logout failed: ' + error.message, true);
  }
}

// Clear cached data
async function clearCache() {
  if (!confirm('Are you sure you want to clear all cached data? This will not affect your authentication.')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove([
      'likedVideos',
      'channels',
      'nextPageToken',
      'prevPageToken',
      'currentPage',
      'totalResults'
    ]);
    
    showNotification('Cache cleared successfully');
  } catch (error) {
    console.error('Error clearing cache:', error);
    showNotification('Failed to clear cache: ' + error.message, true);
  }
}

// Export liked videos as JSON
async function exportData() {
  try {
    const data = await chrome.storage.local.get(['likedVideos']);
    
    if (!data.likedVideos || data.likedVideos.length === 0) {
      showNotification('No data to export', true);
      return;
    }
    
    // Create a blob with the data
    const blob = new Blob([JSON.stringify(data.likedVideos, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = 'youtube-liked-videos.json';
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
    
    showNotification('Data exported successfully');
  } catch (error) {
    console.error('Error exporting data:', error);
    showNotification('Failed to export data: ' + error.message, true);
  }
}

// Show notification
function showNotification(message, isError = false) {
  // Create notification element if it doesn't exist
  let notification = document.getElementById('notification');
  
  if (!notification) {
    notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '12px 16px';
    notification.style.borderRadius = '4px';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = '500';
    notification.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    notification.style.zIndex = '1000';
    notification.style.transition = 'opacity 0.3s ease';
    document.body.appendChild(notification);
  }
  
  // Set notification style based on type
  if (isError) {
    notification.style.backgroundColor = '#ffebee';
    notification.style.color = '#c62828';
    notification.style.border = '1px solid #ffcdd2';
  } else {
    notification.style.backgroundColor = '#e8f5e9';
    notification.style.color = '#2e7d32';
    notification.style.border = '1px solid #c8e6c9';
  }
  
  // Set message
  notification.textContent = message;
  notification.style.opacity = '1';
  
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    
    // Remove after fade out
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}
