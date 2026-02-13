/**
 * Example Component: i18n Usage Demonstration
 * 
 * This file demonstrates how to use the i18n module in React components.
 * It shows various patterns and best practices for accessing translations.
 * 
 * NOTE: This is an example file for documentation purposes.
 * It is not used in the actual application.
 */

import { t } from '@/i18n';

// ============================================================================
// Example 1: Basic Usage
// ============================================================================

function BasicExample() {
  return (
    <div>
      <h1>{t.common.appName}</h1>
      <button>{t.common.play}</button>
      <p>{t.errors.loadFailed}</p>
    </div>
  );
}

// ============================================================================
// Example 2: ARIA Labels for Accessibility
// ============================================================================

function AccessibilityExample() {
  return (
    <div>
      <button aria-label={t.aria.playVideo}>
        <PlayIcon />
      </button>
      
      <input
        type="search"
        placeholder={t.nav.searchPlaceholder}
        aria-label={t.aria.searchContent}
      />
      
      <nav aria-label={t.aria.mainNavigation}>
        <a href="/">{t.nav.home}</a>
        <a href="/movies">{t.nav.movies}</a>
      </nav>
    </div>
  );
}

// ============================================================================
// Example 3: Conditional Text
// ============================================================================

function ConditionalExample({ isFavorite }: { isFavorite: boolean }) {
  return (
    <button>
      {isFavorite ? t.hero.removeFromFavorites : t.hero.addToFavorites}
    </button>
  );
}

// ============================================================================
// Example 4: Error Messages
// ============================================================================

function ErrorExample({ error }: { error: Error | null }) {
  if (!error) return null;
  
  return (
    <div className="error-message">
      <h3>{t.common.error}</h3>
      <p>{t.errors.generic}</p>
      <button>{t.common.retry}</button>
    </div>
  );
}

// ============================================================================
// Example 5: Settings Page with Multiple Categories
// ============================================================================

function SettingsExample() {
  return (
    <div>
      <h1>{t.settings.title}</h1>
      <p>{t.settings.subtitle}</p>
      
      <section>
        <h2>{t.settings.appearance}</h2>
        <label>
          {t.settings.theme}
          <select>
            <option value="dark">{t.settings.darkTheme}</option>
            <option value="light">{t.settings.lightTheme}</option>
          </select>
        </label>
      </section>
      
      <section>
        <h2>{t.settings.downloadSettings}</h2>
        <label>
          <input type="checkbox" />
          {t.settings.encryptDownloads}
        </label>
        <p className="description">{t.settings.encryptDownloadsDesc}</p>
      </section>
      
      <button>{t.settings.saveSettings}</button>
    </div>
  );
}

// ============================================================================
// Example 6: Dynamic Content with Fallbacks
// ============================================================================

function DynamicContentExample({ content }: { content: any }) {
  return (
    <div>
      <h2>{content.title || t.errors.notFound}</h2>
      <p>{content.description || t.errors.loadFailed}</p>
      
      {content.duration && (
        <span>{content.duration} {t.common.minutes}</span>
      )}
      
      {content.quality === '1080p' && (
        <span className="badge">{t.common.hd}</span>
      )}
    </div>
  );
}

// ============================================================================
// Example 7: Navigation with Categories
// ============================================================================

function NavigationExample() {
  const categories = [
    { key: 'movies', label: t.categories.movies },
    { key: 'series', label: t.categories.series },
    { key: 'sitcoms', label: t.categories.sitcoms },
    { key: 'kids', label: t.categories.kids },
  ];
  
  return (
    <nav>
      {categories.map(category => (
        <a key={category.key} href={`/${category.key}`}>
          {category.label}
        </a>
      ))}
    </nav>
  );
}

// ============================================================================
// Example 8: Loading States
// ============================================================================

function LoadingExample({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="loading" aria-label={t.aria.loading}>
        <div className="spinner" />
        <p>{t.common.loading}</p>
      </div>
    );
  }
  
  return <div>Content loaded!</div>;
}

// ============================================================================
// Example 9: Toast Notifications
// ============================================================================

function ToastExample({ type, message }: { type: string; message?: string }) {
  const getToastMessage = () => {
    switch (type) {
      case 'download-started':
        return t.toast.downloadStarted;
      case 'download-complete':
        return t.toast.downloadComplete;
      case 'download-failed':
        return t.toast.downloadFailed;
      case 'favorite-added':
        return t.toast.addedToFavorites;
      case 'favorite-removed':
        return t.toast.removedFromFavorites;
      default:
        return message || t.toast.info;
    }
  };
  
  return (
    <div className="toast">
      <p>{getToastMessage()}</p>
    </div>
  );
}

// ============================================================================
// Example 10: Quality Selector
// ============================================================================

function QualitySelectorExample({ qualities }: { qualities: string[] }) {
  const getQualityLabel = (quality: string) => {
    return t.quality[quality as keyof typeof t.quality] || quality;
  };
  
  return (
    <select aria-label={t.player.selectQuality}>
      <option value="auto">{t.quality.auto}</option>
      {qualities.map(quality => (
        <option key={quality} value={quality}>
          {getQualityLabel(quality)}
        </option>
      ))}
    </select>
  );
}

// ============================================================================
// Example 11: Empty States
// ============================================================================

function EmptyStateExample({ type }: { type: 'downloads' | 'favorites' | 'search' }) {
  const getEmptyStateContent = () => {
    switch (type) {
      case 'downloads':
        return {
          title: t.downloads.noCompletedDownloads,
          description: t.downloads.startDownloading,
          action: t.downloads.browseContent,
        };
      case 'favorites':
        return {
          title: t.favorites.noFavorites,
          description: t.favorites.addFavorites,
          action: t.favorites.browseContent,
        };
      case 'search':
        return {
          title: t.search.noResults,
          description: t.search.tryDifferentQuery,
          action: t.search.suggestedContent,
        };
    }
  };
  
  const content = getEmptyStateContent();
  
  return (
    <div className="empty-state">
      <h2>{content.title}</h2>
      <p>{content.description}</p>
      <button>{content.action}</button>
    </div>
  );
}

// ============================================================================
// Example 12: Offline Indicator
// ============================================================================

function OfflineIndicatorExample({ isOnline }: { isOnline: boolean }) {
  if (isOnline) return null;
  
  return (
    <div className="offline-banner" role="alert">
      <h3>{t.offline.title}</h3>
      <p>{t.offline.description}</p>
      <button>{t.offline.goToDownloads}</button>
    </div>
  );
}

// ============================================================================
// Example 13: Forced Update Screen
// ============================================================================

function ForcedUpdateExample({ version, notes }: { version: string; notes: string }) {
  return (
    <div className="forced-update" role="dialog" aria-modal="true">
      <h1>{t.forcedUpdate.title}</h1>
      <p>{t.forcedUpdate.description}</p>
      
      <div className="version-info">
        <h2>{t.forcedUpdate.version} {version}</h2>
        <p>{notes}</p>
      </div>
      
      <div className="warning">
        <p>{t.forcedUpdate.warning}</p>
      </div>
      
      <div className="actions">
        <button aria-label={t.aria.openExternalLink}>
          {t.forcedUpdate.updateNow}
        </button>
        <button>{t.forcedUpdate.exit}</button>
      </div>
    </div>
  );
}

// ============================================================================
// Example 14: File Size Formatting
// ============================================================================

function FileSizeExample({ bytes }: { bytes: number }) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} ${t.fileSize.bytes}`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} ${t.fileSize.kilobytes}`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} ${t.fileSize.megabytes}`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ${t.fileSize.gigabytes}`;
  };
  
  return <span>{formatFileSize(bytes)}</span>;
}

// ============================================================================
// Example 15: Time Formatting
// ============================================================================

function TimeAgoExample({ timestamp }: { timestamp: number }) {
  const getTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (seconds < 60) return t.time.justNow;
    if (minutes < 60) return `${minutes} ${t.time.minutesAgo}`;
    if (hours < 24) return `${hours} ${t.time.hoursAgo}`;
    return `${days} ${t.time.daysAgo}`;
  };
  
  return <span>{getTimeAgo(timestamp)}</span>;
}

// ============================================================================
// Best Practices Summary
// ============================================================================

/**
 * BEST PRACTICES:
 * 
 * 1. Always import from '@/i18n': import { t } from '@/i18n';
 * 2. Use descriptive keys: t.category.specificKey
 * 3. Use ARIA labels: aria-label={t.aria.actionName}
 * 4. Handle missing content: content.title || t.errors.notFound
 * 5. Use conditional rendering: condition ? t.yes : t.no
 * 6. Keep formatting logic separate: formatFileSize(bytes)
 * 7. Use semantic categories: t.player.*, t.settings.*, etc.
 * 8. Provide context in comments when needed
 * 9. Test with actual translations
 * 10. Document any exceptions (non-translatable text)
 */

// ============================================================================
// Anti-Patterns to Avoid
// ============================================================================

/**
 * DON'T DO THIS:
 * 
 * ❌ Hardcoded strings:
 *    <button>Play</button>
 * 
 * ❌ String concatenation:
 *    const message = "Download " + status;
 * 
 * ❌ Inline text without i18n:
 *    <p>Failed to load content</p>
 * 
 * ❌ Missing ARIA labels:
 *    <button><PlayIcon /></button>
 * 
 * ❌ Mixing languages:
 *    <p>{t.common.play} video</p>
 * 
 * DO THIS INSTEAD:
 * 
 * ✅ Use i18n module:
 *    <button>{t.common.play}</button>
 * 
 * ✅ Use complete translations:
 *    const message = t.downloads.downloadStatus[status];
 * 
 * ✅ Always use i18n:
 *    <p>{t.errors.loadFailed}</p>
 * 
 * ✅ Include ARIA labels:
 *    <button aria-label={t.aria.playVideo}><PlayIcon /></button>
 * 
 * ✅ Complete translations:
 *    <p>{t.player.playVideo}</p>
 */

// Placeholder icon component for examples
function PlayIcon() {
  return <span>▶</span>;
}

export {
  BasicExample,
  AccessibilityExample,
  ConditionalExample,
  ErrorExample,
  SettingsExample,
  DynamicContentExample,
  NavigationExample,
  LoadingExample,
  ToastExample,
  QualitySelectorExample,
  EmptyStateExample,
  OfflineIndicatorExample,
  ForcedUpdateExample,
  FileSizeExample,
  TimeAgoExample,
};
