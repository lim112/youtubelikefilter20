# Architecture Overview: YouTube Liked Videos Filter Chrome Extension

## 1. Overview

The YouTube Liked Videos Filter is a Chrome extension that enables users to search, filter, and organize their liked YouTube videos by channel name and keywords. The extension authenticates with the Google/YouTube API, retrieves a user's liked videos, and provides a UI for filtering and browsing these videos.

## 2. System Architecture

### Browser Extension Architecture

The extension follows the standard Chrome extension architecture with:

- **Background Script**: Handles authentication and maintains session state
- **Popup Interface**: Provides the main UI for interacting with liked videos
- **Content Script**: Minimal implementation to detect YouTube context
- **Options Page**: Provides extended settings and configuration

The extension uses the Chrome Extension Manifest V3 format, which enforces a service worker model for the background script.

### Authentication Flow

The extension uses OAuth 2.0 for authentication with Google's API services:

1. User initiates login through the popup or options page
2. Chrome Identity API handles the OAuth flow
3. Access token is stored in Chrome's storage system
4. Token is used for authenticated requests to YouTube Data API

## 3. Key Components

### 3.1 Background Script (background.js)

- Manages the OAuth authentication workflow
- Extracts client ID from the manifest
- Handles message passing between components
- Provides token management services to other components

### 3.2 Popup Interface (popup.html, popup.js, popup.css)

- Entry point for user interaction
- Displays user's liked videos with filtering options
- Provides search functionality by keyword
- Enables filtering by channel
- Implements pagination for result sets

### 3.3 Options Page (options.html, options.js, options.css)

- Provides extended configuration settings
- Shows authentication status and user profile
- Allows customization of display preferences
- Includes data management features (cache clearing, data export)

### 3.4 Content Script (content.js)

- Lightweight script that runs in the context of YouTube pages
- Currently minimal, primarily checks if the current page is YouTube

### 3.5 Utility Functions (utils.js)

- Shared helper functions for formatting
- Handles date, view count, and duration formatting
- Centralizes common functionality used across components

## 4. Data Flow

### 4.1 Authentication Flow

```
User → Popup/Options UI → Background Script → Google OAuth → YouTube API
```

1. User initiates login from the extension UI
2. Background script manages OAuth flow via Chrome Identity API
3. Access token is obtained and stored
4. Token is used for subsequent API requests

### 4.2 Liked Videos Retrieval

```
Popup UI → Background Script → YouTube API → Popup UI → Display to User
```

1. User opens popup or refreshes data
2. Popup requests access token from background script
3. Popup makes requests to YouTube API to fetch liked videos
4. Results are processed, cached, and displayed to the user

### 4.3 Filtering Flow

```
User Input → Popup UI → Local Processing → Filtered Display
```

1. User enters search terms or selects channel filter
2. Popup processes the filters against cached data
3. Filtered results are displayed with pagination

## 5. External Dependencies

### 5.1 Google/YouTube APIs

- **YouTube Data API v3**: Primary API for accessing user's liked videos
- **OAuth 2.0**: Authentication mechanism for Google services

### 5.2 Chrome APIs

- **chrome.identity**: Manages OAuth authentication
- **chrome.storage**: Persists settings and cached data
- **chrome.runtime**: Handles messaging between components

### 5.3 External Libraries

- **Font Awesome**: Icon library for UI elements (loaded from CDN)

## 6. Storage Strategy

### 6.1 Local Extension Storage

The extension uses Chrome's storage API for:

- Access tokens and authentication state
- User preferences and settings
- Temporary cache of liked videos data

### 6.2 Caching Strategy

The extension implements a basic caching mechanism:

- Liked videos are cached after fetching
- User can manually refresh data
- Options page provides cache management controls

## 7. Deployment Strategy

The extension is designed to be deployed to the Chrome Web Store:

- Assets are packaged according to Chrome extension standards
- Icons are provided in multiple resolutions (16px, 48px, 128px)
- Manifest V3 compliance ensures modern browser compatibility

### Development Environment

The repository includes Replit configuration:
- HTTP server on port 5000 for development/testing
- Support for Node.js 20 and Python 3.11 environments

## 8. Security Considerations

- OAuth client ID is configurable and not hardcoded in the source
- Access tokens are stored in Chrome's secure storage
- Limited permissions scope (youtube.readonly)
- No sensitive data is transmitted to third-party services

## 9. Future Architectural Considerations

Potential areas for architectural enhancement:

- Expanded content script for direct YouTube page integration
- Improved caching with IndexedDB for larger datasets
- Background synchronization for offline access
- Enhanced data visualization for video analytics