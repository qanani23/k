/**
 * English (en) translations for Kiyya Desktop Streaming Application
 * 
 * This file contains all user-facing text strings used throughout the application.
 * When implementing full i18n support, these strings can be easily migrated to
 * a proper i18n library like react-i18next.
 * 
 * Structure:
 * - common: Shared strings used across multiple components
 * - nav: Navigation bar strings
 * - hero: Hero section strings
 * - player: Video player strings
 * - downloads: Downloads page strings
 * - favorites: Favorites page strings
 * - settings: Settings page strings
 * - search: Search page strings
 * - errors: Error messages
 * - accessibility: ARIA labels and screen reader text
 */

export const en = {
  // Common strings
  common: {
    appName: 'Kiyya',
    loading: 'Loading...',
    error: 'Error',
    retry: 'Try Again',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    close: 'Close',
    play: 'Play',
    pause: 'Pause',
    download: 'Download',
    downloading: 'Downloading...',
    downloaded: 'Downloaded',
    remove: 'Remove',
    add: 'Add',
    update: 'Update',
    exit: 'Exit',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    home: 'Home',
    movies: 'Movies',
    series: 'Series',
    sitcoms: 'Sitcoms',
    kids: 'Kids',
    all: 'All',
    movie: 'Movie',
    sitcom: 'Sitcom',
    hd: 'HD',
    minutes: 'min',
    saving: 'Saving...',
    shuffle: 'Shuffle',
  },

  // Navigation
  nav: {
    home: 'Home',
    movies: 'Movies',
    series: 'Series',
    sitcoms: 'Sitcoms',
    kids: 'Kids',
    search: 'Search',
    downloads: 'Downloads',
    favorites: 'Favorites',
    settings: 'Settings',
    searchPlaceholder: 'Search content...',
    allMovies: 'All Movies',
    allSeries: 'All Series',
    allSitcoms: 'All Sitcoms',
    allKids: 'All Kids',
    updateAvailable: 'is available!',
    updateButton: 'Update',
    dismissUpdate: 'Dismiss update notification',
  },

  // Hero section
  hero: {
    play: 'Play',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    shuffle: 'Shuffle hero content',
    failedToLoad: 'Failed to load hero content',
    noContentAvailable: 'No hero content available',
    retryLoading: 'Retry loading hero content',
  },

  // Video player
  player: {
    play: 'Play',
    pause: 'Pause',
    mute: 'Mute',
    unmute: 'Unmute',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    quality: 'Quality',
    selectQuality: 'Select quality',
    close: 'Close player',
    loading: 'Loading video...',
    error: 'Failed to load video',
    incompatible: 'This video may not play on your platform',
    playExternal: 'Play via external player',
    buffering: 'Buffering...',
    qualityDowngraded: 'Quality automatically downgraded due to buffering',
  },

  // Downloads page
  downloads: {
    title: 'Downloads',
    subtitle: 'Manage your offline content',
    active: 'Active Downloads',
    completed: 'Completed Downloads',
    noActiveDownloads: 'No active downloads',
    noCompletedDownloads: 'No downloaded content',
    startDownloading: 'Start downloading content to watch offline',
    browseContent: 'Browse Content',
    downloadSpeed: 'Download speed',
    timeRemaining: 'Time remaining',
    paused: 'Paused',
    failed: 'Failed',
    retry: 'Retry',
    cancel: 'Cancel',
    delete: 'Delete',
    play: 'Play',
    confirmDelete: 'Are you sure you want to delete this download?',
    deleteSuccess: 'Download deleted successfully',
    deleteFailed: 'Failed to delete download',
    insufficientSpace: 'Insufficient disk space',
    downloadFailed: 'Download failed',
  },

  // Favorites page
  favorites: {
    title: 'Favorites',
    subtitle: 'Your saved content',
    noFavorites: 'No favorites yet',
    addFavorites: 'Add content to your favorites to watch later',
    browseContent: 'Browse Content',
    removeFromFavorites: 'Remove from favorites',
    addedToFavorites: 'Added to favorites',
    removedFromFavorites: 'Removed from favorites',
  },

  // Settings page
  settings: {
    title: 'Settings',
    subtitle: 'Customize your Kiyya experience',
    general: 'General',
    downloads: 'Downloads',
    advanced: 'Advanced',
    about: 'About',
    
    // Appearance
    appearance: 'Appearance',
    theme: 'Theme',
    darkTheme: 'Dark',
    darkThemeDesc: 'Easy on the eyes',
    lightTheme: 'Light',
    lightThemeDesc: 'Bright and clean',
    
    // Video playback
    videoPlayback: 'Video Playback',
    autoQualityUpgrade: 'Auto Quality Upgrade',
    autoQualityUpgradeDesc: 'Automatically upgrade video quality when network improves',
    
    // Download settings
    downloadSettings: 'Download Settings',
    encryptDownloads: 'Encrypt Downloads',
    encryptDownloadsDesc: 'Encrypt downloaded files for additional security',
    storageLocation: 'Storage Location',
    
    // Storage info
    storageInfo: 'Storage Information',
    freeSpace: 'Free Space',
    cacheItems: 'Cache Items',
    
    // Cache settings
    cacheSettings: 'Cache Settings',
    cacheDuration: 'Cache Duration (minutes)',
    cacheDurationDesc: 'How long to keep content in cache before refreshing',
    maxCacheItems: 'Maximum Cache Items',
    maxCacheItemsDesc: 'Maximum number of items to keep in cache',
    
    // Diagnostics
    diagnostics: 'System Diagnostics',
    refresh: 'Refresh',
    gatewayStatus: 'Gateway Status',
    localServer: 'Local Server',
    status: 'Status',
    port: 'Port',
    running: 'Running',
    stopped: 'Stopped',
    cachePerformance: 'Cache Performance',
    totalItems: 'Total Items',
    cacheSize: 'Cache Size',
    hitRate: 'Hit Rate',
    lastCleanup: 'Last Cleanup',
    downloadStats: 'Download Statistics',
    totalDownloads: 'Total Downloads',
    totalDownloaded: 'Total Downloaded',
    avgThroughput: 'Avg Throughput',
    lastDownload: 'Last Download',
    
    // About
    appName: 'Kiyya',
    appDescription: 'Desktop Streaming Application',
    version: 'Version',
    databaseVersion: 'Database Version',
    lastUpdateCheck: 'Last Update Check',
    never: 'Never',
    links: 'Links',
    githubRepo: 'GitHub Repository',
    supportDocs: 'Support & Documentation',
    privacyPolicy: 'Privacy Policy',
    
    // Actions
    saveSettings: 'Save Settings',
  },

  // Search page
  search: {
    title: 'Search',
    placeholder: 'Search for movies, series, and more...',
    searching: 'Searching...',
    noResults: 'No results found',
    tryDifferentQuery: 'Try a different search query',
    suggestedContent: 'You might like these',
    recentUploads: 'Recent Uploads',
  },

  // Movie/Series detail pages
  detail: {
    play: 'Play',
    download: 'Download',
    addToFavorites: 'Add to Favorites',
    removeFromFavorites: 'Remove from Favorites',
    relatedContent: 'You may also like',
    seasons: 'Seasons',
    episodes: 'Episodes',
    season: 'Season',
    episode: 'Episode',
    inferredSeasons: 'Seasons inferred automatically',
    noEpisodes: 'No episodes available',
    loadingEpisodes: 'Loading episodes...',
    failedToLoad: 'Failed to load content',
  },

  // Forced update screen
  forcedUpdate: {
    title: 'Update Required',
    description: 'A new version of Kiyya is available and required to continue.',
    version: 'Version',
    updateNow: 'Update Now',
    exit: 'Exit',
    warning: '⚠️ This update is required for security and compatibility. The application cannot continue without updating.',
  },

  // Emergency disable screen
  emergencyDisable: {
    title: 'Maintenance Mode',
    description: 'Kiyya is currently undergoing maintenance. Please check back later.',
    exit: 'Exit',
    checkingStatus: 'Checking status...',
  },

  // Offline indicator
  offline: {
    title: 'You are offline',
    description: 'Some features may be unavailable',
    reconnecting: 'Reconnecting...',
    goToDownloads: 'Go to Downloads',
    offlineMode: 'Offline Mode',
    onlyDownloadedContent: 'Only downloaded content is available',
  },

  // Error messages
  errors: {
    generic: 'Something went wrong',
    networkError: 'Network error occurred',
    loadFailed: 'Failed to load content',
    saveFailed: 'Failed to save',
    deleteFailed: 'Failed to delete',
    downloadFailed: 'Download failed',
    playbackFailed: 'Playback failed',
    insufficientSpace: 'Insufficient disk space',
    invalidInput: 'Invalid input',
    unauthorized: 'Unauthorized access',
    notFound: 'Content not found',
    serverError: 'Server error',
    timeout: 'Request timed out',
    unknown: 'Unknown error occurred',
  },

  // Accessibility labels (ARIA)
  aria: {
    // Navigation
    openSearch: 'Open search',
    closeSearch: 'Close search',
    searchContent: 'Search content',
    mainNavigation: 'Main navigation',
    userMenu: 'User menu',
    
    // Player
    videoPlayer: 'Video player',
    playVideo: 'Play video',
    pauseVideo: 'Pause video',
    muteVideo: 'Mute video',
    unmuteVideo: 'Unmute video',
    enterFullscreen: 'Enter fullscreen',
    exitFullscreen: 'Exit fullscreen',
    closePlayer: 'Close player',
    
    // Content cards
    playContent: 'Play',
    viewDetails: 'View details',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    downloadContent: 'Download content',
    
    // Settings
    selectTheme: 'Select theme',
    selectDarkTheme: 'Select dark theme',
    selectLightTheme: 'Select light theme',
    toggleEncryption: 'Toggle encryption',
    toggleAutoQuality: 'Toggle auto quality upgrade',
    refreshDiagnostics: 'Refresh diagnostics',
    openExternalLink: 'Open in external browser',
    
    // Downloads
    cancelDownload: 'Cancel download',
    retryDownload: 'Retry download',
    deleteDownload: 'Delete download',
    playOffline: 'Play offline',
    
    // General
    loading: 'Loading',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
  },

  // Toast notifications
  toast: {
    success: 'Success',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
    downloadStarted: 'Download started',
    downloadComplete: 'Download complete',
    downloadFailed: 'Download failed',
    addedToFavorites: 'Added to favorites',
    removedFromFavorites: 'Removed from favorites',
    settingsSaved: 'Settings saved',
    settingsFailed: 'Failed to save settings',
    copiedToClipboard: 'Copied to clipboard',
  },

  // Categories (from config)
  categories: {
    movies: 'Movies',
    series: 'Series',
    sitcoms: 'Sitcoms',
    kids: 'Kids',
    comedy: 'Comedy',
    action: 'Action',
    romance: 'Romance',
  },

  // Quality levels
  quality: {
    auto: 'Auto',
    '2160p': '4K (2160p)',
    '1080p': 'Full HD (1080p)',
    '720p': 'HD (720p)',
    '480p': 'SD (480p)',
    '360p': '360p',
  },

  // Time formats
  time: {
    seconds: 'seconds',
    minutes: 'minutes',
    hours: 'hours',
    days: 'days',
    justNow: 'Just now',
    minutesAgo: 'minutes ago',
    hoursAgo: 'hours ago',
    daysAgo: 'days ago',
  },

  // File sizes
  fileSize: {
    bytes: 'B',
    kilobytes: 'KB',
    megabytes: 'MB',
    gigabytes: 'GB',
    terabytes: 'TB',
  },
};

export type TranslationKeys = typeof en;
