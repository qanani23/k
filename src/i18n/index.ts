/**
 * i18n Module for Kiyya Desktop Streaming Application
 * 
 * This module provides a centralized location for all user-facing text strings.
 * Currently supports English only, but structured for easy expansion to multiple languages.
 * 
 * Usage:
 * ```typescript
 * import { t } from '@/i18n';
 * 
 * // Access translations
 * const title = t.common.appName; // "Kiyya"
 * const playButton = t.player.play; // "Play"
 * ```
 * 
 * Future i18n Integration:
 * When implementing full i18n support with libraries like react-i18next:
 * 1. Replace this module with proper i18n hooks (useTranslation)
 * 2. Move translation files to public/locales/
 * 3. Add language detection and switching
 * 4. Implement pluralization and interpolation
 * 
 * For now, this module serves as:
 * - Single source of truth for all UI text
 * - Easy identification of translatable strings
 * - Type-safe access to translations
 * - Simple migration path to full i18n
 */

import { en, TranslationKeys } from './en';

/**
 * Current language (hardcoded to English for now)
 * In the future, this would be dynamic based on user preference
 */
const currentLanguage = 'en';

/**
 * Available translations
 * Add more languages here when implementing full i18n
 */
const translations: Record<string, TranslationKeys> = {
  en,
};

/**
 * Get current translations
 * This function will be replaced with proper i18n hooks in the future
 */
export const t = translations[currentLanguage];

/**
 * Get translation for a specific key (utility function)
 * This demonstrates how to access nested translation keys
 * 
 * @example
 * ```typescript
 * const title = getTranslation('common', 'appName'); // "Kiyya"
 * ```
 */
export function getTranslation(
  category: keyof TranslationKeys,
  key: string
): string {
  const categoryTranslations = t[category] as Record<string, string>;
  return categoryTranslations[key] || key;
}

/**
 * Format a translation with variables (placeholder for future implementation)
 * When implementing full i18n, this would handle interpolation
 * 
 * @example
 * ```typescript
 * // Future usage:
 * formatTranslation('downloads.downloadSpeed', { speed: '5 MB/s' })
 * // Would return: "Download speed: 5 MB/s"
 * ```
 */
export function formatTranslation(
  key: string,
  variables?: Record<string, string | number>
): string {
  // Placeholder implementation
  // In the future, this would use proper i18n interpolation
  return key;
}

/**
 * Get plural form of a translation (placeholder for future implementation)
 * When implementing full i18n, this would handle pluralization rules
 * 
 * @example
 * ```typescript
 * // Future usage:
 * pluralize('common.minutes', 5) // "5 minutes"
 * pluralize('common.minutes', 1) // "1 minute"
 * ```
 */
export function pluralize(
  key: string,
  count: number
): string {
  // Placeholder implementation
  // In the future, this would use proper i18n pluralization
  return `${count} ${key}`;
}

/**
 * Export translation keys type for type safety
 */
export type { TranslationKeys };

/**
 * Export individual language files for direct access if needed
 */
export { en };

/**
 * Default export for convenience
 */
export default t;
