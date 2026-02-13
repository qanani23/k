# i18n Quick Reference Guide

## Quick Start

### Import the i18n module

```typescript
import { t } from '@/i18n';
```

### Use translations in your component

```typescript
function MyComponent() {
  return (
    <div>
      <h1>{t.common.appName}</h1>
      <button>{t.common.play}</button>
    </div>
  );
}
```

## Common Patterns

### Basic Text

```typescript
<h1>{t.common.appName}</h1>
<p>{t.common.loading}</p>
<button>{t.common.save}</button>
```

### Conditional Text

```typescript
{isFavorite ? t.hero.removeFromFavorites : t.hero.addToFavorites}
```

### ARIA Labels

```typescript
<button aria-label={t.aria.playVideo}>
  <PlayIcon />
</button>
```

### Error Messages

```typescript
{error && <p>{t.errors.loadFailed}</p>}
```

## Translation Categories

| Category | Use For | Example |
|----------|---------|---------|
| `t.common.*` | Shared strings | `t.common.play` |
| `t.nav.*` | Navigation | `t.nav.home` |
| `t.hero.*` | Hero section | `t.hero.shuffle` |
| `t.player.*` | Video player | `t.player.pause` |
| `t.downloads.*` | Downloads page | `t.downloads.title` |
| `t.favorites.*` | Favorites page | `t.favorites.noFavorites` |
| `t.settings.*` | Settings page | `t.settings.theme` |
| `t.search.*` | Search | `t.search.noResults` |
| `t.detail.*` | Detail pages | `t.detail.seasons` |
| `t.errors.*` | Error messages | `t.errors.networkError` |
| `t.aria.*` | Accessibility | `t.aria.openSearch` |
| `t.toast.*` | Notifications | `t.toast.success` |

## Frequently Used Strings

### Actions
- `t.common.play` - "Play"
- `t.common.pause` - "Pause"
- `t.common.save` - "Save"
- `t.common.cancel` - "Cancel"
- `t.common.delete` - "Delete"
- `t.common.close` - "Close"
- `t.common.retry` - "Try Again"

### States
- `t.common.loading` - "Loading..."
- `t.common.error` - "Error"
- `t.common.saving` - "Saving..."

### Navigation
- `t.nav.home` - "Home"
- `t.nav.movies` - "Movies"
- `t.nav.series` - "Series"
- `t.nav.downloads` - "Downloads"
- `t.nav.favorites` - "Favorites"
- `t.nav.settings` - "Settings"

### Errors
- `t.errors.generic` - "Something went wrong"
- `t.errors.networkError` - "Network error occurred"
- `t.errors.loadFailed` - "Failed to load content"
- `t.errors.notFound` - "Content not found"

## Adding New Strings

1. Open `src/i18n/en.ts`
2. Find the appropriate category
3. Add your string:

```typescript
export const en = {
  // ... existing categories
  myCategory: {
    myNewString: 'My New Text',
  },
};
```

4. Use it in your component:

```typescript
import { t } from '@/i18n';

<p>{t.myCategory.myNewString}</p>
```

## Best Practices

✅ **DO**:
- Always use `t.category.key` for user-facing text
- Use descriptive key names
- Include ARIA labels for accessibility
- Keep strings in the appropriate category

❌ **DON'T**:
- Hardcode user-facing text: `<button>Play</button>`
- Concatenate strings: `"Download " + status`
- Mix languages: `{t.common.play} video`

## Testing

```typescript
import { t } from '@/i18n';

describe('MyComponent', () => {
  it('displays correct text', () => {
    render(<MyComponent />);
    expect(screen.getByText(t.common.appName)).toBeInTheDocument();
  });
});
```

## Need Help?

- **Full documentation**: `src/i18n/README.md`
- **Examples**: `src/i18n/EXAMPLE_USAGE.tsx`
- **Migration guide**: `I18N_MIGRATION_STATUS.md`
- **Implementation details**: `I18N_IMPLEMENTATION_SUMMARY.md`
