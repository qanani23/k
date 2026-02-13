# i18n Module

## Overview

This module provides a centralized location for all user-facing text strings in the Kiyya desktop streaming application. It is designed to prepare the application for future internationalization (i18n) support while maintaining a simple structure for the current English-only implementation.

## Purpose

1. **Single Source of Truth**: All UI text is defined in one place
2. **Easy Identification**: Clearly marks all translatable strings
3. **Type Safety**: TypeScript types ensure correct usage
4. **Future-Ready**: Structured for easy migration to full i18n libraries

## Current Structure

```
src/i18n/
├── index.ts      # Main module exports and utility functions
├── en.ts         # English translations
└── README.md     # This file
```

## Usage

### Basic Usage

```typescript
import { t } from '@/i18n';

// Access translations
const appName = t.common.appName; // "Kiyya"
const playButton = t.player.play; // "Play"
const errorMessage = t.errors.networkError; // "Network error occurred"
```

### In React Components

```typescript
import { t } from '@/i18n';

function MyComponent() {
  return (
    <div>
      <h1>{t.common.appName}</h1>
      <button>{t.common.play}</button>
      <p>{t.errors.loadFailed}</p>
    </div>
  );
}
```

### ARIA Labels

```typescript
import { t } from '@/i18n';

function AccessibleButton() {
  return (
    <button aria-label={t.aria.playVideo}>
      <PlayIcon />
    </button>
  );
}
```

## Translation Categories

The translations are organized into logical categories:

- **common**: Shared strings used across multiple components
- **nav**: Navigation bar strings
- **hero**: Hero section strings
- **player**: Video player strings
- **downloads**: Downloads page strings
- **favorites**: Favorites page strings
- **settings**: Settings page strings
- **search**: Search page strings
- **detail**: Movie/Series detail pages
- **forcedUpdate**: Forced update screen
- **emergencyDisable**: Emergency disable screen
- **offline**: Offline indicator
- **errors**: Error messages
- **aria**: Accessibility labels (ARIA)
- **toast**: Toast notifications
- **categories**: Content categories
- **quality**: Video quality levels
- **time**: Time formats
- **fileSize**: File size units

## Adding New Translations

To add new translatable strings:

1. Open `src/i18n/en.ts`
2. Add the string to the appropriate category
3. If needed, create a new category
4. Use the string in your component via `t.category.key`

Example:

```typescript
// In en.ts
export const en = {
  // ... existing categories
  myNewCategory: {
    myNewString: 'Hello World',
  },
};

// In your component
import { t } from '@/i18n';

function MyComponent() {
  return <div>{t.myNewCategory.myNewString}</div>;
}
```

## Future i18n Implementation

When implementing full internationalization support:

### Step 1: Choose an i18n Library

Recommended: `react-i18next` (most popular React i18n library)

```bash
npm install react-i18next i18next
```

### Step 2: Migrate Translation Files

Move translation files to the standard location:

```
public/
└── locales/
    ├── en/
    │   └── translation.json
    ├── es/
    │   └── translation.json
    └── fr/
        └── translation.json
```

### Step 3: Initialize i18next

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      es: { translation: esTranslations },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });
```

### Step 4: Replace Current Usage

Replace:
```typescript
import { t } from '@/i18n';
const text = t.common.appName;
```

With:
```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();
  const text = t('common.appName');
}
```

### Step 5: Add Language Switching

```typescript
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  
  return (
    <select onChange={(e) => i18n.changeLanguage(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option>
    </select>
  );
}
```

## Benefits of Current Approach

1. **No External Dependencies**: Keeps the bundle size small
2. **Type Safety**: Full TypeScript support
3. **Simple Migration**: Easy to replace with full i18n later
4. **Clear Organization**: All text in one place
5. **Developer Friendly**: Easy to find and update strings

## Best Practices

1. **Always use the i18n module**: Never hardcode user-facing text in components
2. **Use descriptive keys**: Make it clear what the text is for
3. **Group related strings**: Keep similar strings in the same category
4. **Document context**: Add comments for strings that need context
5. **Keep it DRY**: Reuse common strings (e.g., "Save", "Cancel")

## Exceptions

Some text may not need translation:

- **Technical identifiers**: File paths, URLs, API endpoints
- **Code/Debug output**: Console logs, error codes
- **Brand names**: "Kiyya", "Odysee"
- **Proper nouns**: Names of people, places (unless localized)

These can remain hardcoded but should be clearly marked with a comment:

```typescript
// Technical identifier - no translation needed
const API_ENDPOINT = 'https://api.example.com';

// Brand name - no translation needed
const BRAND_NAME = 'Kiyya';
```

## Testing

When testing components that use translations:

```typescript
import { t } from '@/i18n';

describe('MyComponent', () => {
  it('displays the correct text', () => {
    render(<MyComponent />);
    expect(screen.getByText(t.common.appName)).toBeInTheDocument();
  });
});
```

## Questions?

For questions about the i18n module or adding new translations, please refer to:
- This README
- The main project documentation
- The i18n module source code (`src/i18n/index.ts`)
