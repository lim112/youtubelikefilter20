// Background script for the YouTube Liked Videos Filter extension
// Handles authentication and token management

// Google OAuth2 client ID from manifest
let clientId = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('YouTube Liked Videos Filter extension installed');
  
  // Extract client ID from manifest
  const manifest = chrome.runtime.getManifest();
  clientId = manifest.oauth2.client_id;
  
  // Check if the client ID still contains a placeholder
  if (clientId && clientId.includes('${GOOGLE_CLIENT_ID}')) {
    console.error('Google Client ID not configured in manifest');
    clientId = null;
  }
});

// Handle messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Make sure we have an asynchronous response
  const handleRequest = async () => {
    try {
      if (request.action === 'authenticate') {
        const authResult = await authenticateUser();
        return authResult;
      } else if (request.action === 'logout') {
        await logoutUser();
        return { success: true };
      } else if (request.action === 'getToken') {
        const token = await getAccessToken();
        return { success: true, token };
      }
    } catch (error) {
      console.error('Error handling request:', error);
      return { success: false, error: error.message };
    }
  };

  // Handle async responses properly
  handleRequest().then(sendResponse);
  return true; // Keep the message channel open for the async response
});

// Authenticate the user
async function authenticateUser() {
  try {
    if (!clientId) {
      throw new Error('Google Client ID not configured');
    }

    // Start the OAuth2 flow
    const authResult = await chrome.identity.getAuthToken({ interactive: true });
    
    if (!authResult || !authResult.token) {
      throw new Error('Failed to get auth token');
    }
    
    // Get user info to display in the UI
    const userInfo = await fetchUserInfo(authResult.token);
    
    // Store token and user info
    await chrome.storage.local.set({
      token: authResult.token,
      user: userInfo
    });
    
    return {
      success: true,
      token: authResult.token,
      user: userInfo
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Fetch user info from Google API
async function fetchUserInfo(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    throw error;
  }
}

// Logout user
async function logoutUser() {
  try {
    const auth = await chrome.storage.local.get(['token']);
    
    if (auth.token) {
      // Revoke token
      await chrome.identity.removeCachedAuthToken({ token: auth.token });
      
      // Clear local storage
      await chrome.storage.local.remove([
        'token', 
        'user', 
        'likedVideos', 
        'channels', 
        'nextPageToken', 
        'prevPageToken', 
        'currentPage', 
        'totalResults'
      ]);
    }
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}

// Get the current access token or refresh if needed
async function getAccessToken() {
  try {
    const auth = await chrome.storage.local.get(['token']);
    
    if (!auth.token) {
      // No token available, user needs to authenticate
      return null;
    }
    
    // Check if token is valid
    try {
      // Make a simple request to test the token
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${auth.token}`
        }
      });
      
      if (response.ok) {
        return auth.token;
      }
    } catch (e) {
      console.log('Token validation error, refreshing...');
    }
    
    // Token is invalid, refresh it
    await chrome.identity.removeCachedAuthToken({ token: auth.token });
    const newAuth = await chrome.identity.getAuthToken({ interactive: false });
    
    if (newAuth && newAuth.token) {
      // Update stored token
      await chrome.storage.local.set({ token: newAuth.token });
      return newAuth.token;
    }
    
    // Failed to refresh token silently
    return null;
  } catch (error) {
    console.error('Error getting access token:', error);
    return null;
  }
}
