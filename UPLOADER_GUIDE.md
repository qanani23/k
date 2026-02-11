# Kiyya Uploader Guide

## Overview

This guide provides comprehensive instructions for content uploaders to properly tag and organize content on Odysee for optimal display in the Kiyya desktop streaming application. Following these conventions ensures content appears correctly categorized, searchable, and organized within the application.

## Table of Contents

1. [Hard-Coded Tags Reference](#hard-coded-tags-reference)
2. [Content Type Guidelines](#content-type-guidelines)
3. [Episode Naming Conventions](#episode-naming-conventions)
4. [Playlist Organization](#playlist-organization)
5. [Thumbnail Requirements](#thumbnail-requirements)
6. [Category Filter Tags](#category-filter-tags)
7. [Hero Content](#hero-content)
8. [Quality Checklist](#quality-checklist)

---

## Hard-Coded Tags Reference

The Kiyya application uses these exact tag strings for content discovery and categorization. **These tags are authoritative and must be used exactly as shown:**

### Base Content Type Tags

- `series` - Identifies episodic series content
- `movie` - Identifies standalone movie content
- `sitcom` - Identifies sitcom content
- `kids` - Identifies children's content
- `hero_trailer` - Identifies featured content for homepage hero display

### Category Filter Tags

#### Movies
- `comedy_movies` - Comedy movies
- `action_movies` - Action movies
- `romance_movies` - Romance movies

#### Series
- `comedy_series` - Comedy series
- `action_series` - Action series
- `romance_series` - Romance series

#### Kids
- `comedy_kids` - Comedy kids content
- `action_kids` - Action kids content

**Important:** Tag names are case-sensitive and must match exactly. Do not modify spellings or create variations.

---

## Content Type Guidelines

### Movies

**Required Tags:**
- Base tag: `movie`
- At least one category filter tag (e.g., `action_movies`, `comedy_movies`, `romance_movies`)

**Example:**
```
Title: The Great Adventure
Tags: movie, action_movies
```

**Optional Tags:**
- Additional descriptive tags for internal organization
- Series-specific tags if the movie is part of a franchise

### Series Episodes

**Required Tags:**
- Base tag: `series`
- Series-specific tag in format: `{series_name}_series` (e.g., `revenge_series`, `lost_series`)
- At least one category filter tag (e.g., `action_series`, `comedy_series`)

**Example:**
```
Title: Revenge S01E01 - Pilot
Tags: series, revenge_series, action_series
```

**Optional Tags:**
- Season-specific tag: `{series_name}_s{season_number}` (e.g., `revenge_s1`)
  - Use for fallback grouping when playlists are unavailable
  - Zero-pad season numbers (s01, s02, etc.)

### Sitcoms

**Required Tags:**
- Base tag: `sitcom`
- Series-specific tag: `{sitcom_name}_series`

**Example:**
```
Title: Friends S01E01 - The One Where Monica Gets a Roommate
Tags: sitcom, friends_series
```

### Kids Content

**Required Tags:**
- Base tag: `kids`
- At least one category filter tag (e.g., `comedy_kids`, `action_kids`)

**Example:**
```
Title: Adventure Time - Pilot
Tags: kids, action_kids
```

---

## Episode Naming Conventions

### Standard Format

All series episodes must follow this exact naming pattern:

```
SeriesName S##E## - Episode Title
```

**Components:**
- `SeriesName`: The name of the series (consistent across all episodes)
- `S##`: Season number with zero-padding (S01, S02, S10, etc.)
- `E##`: Episode number with zero-padding (E01, E02, E10, etc.)
- ` - `: Space, hyphen, space separator
- `Episode Title`: Descriptive episode title

### Examples

**Correct:**
```
Revenge S01E01 - Pilot
Revenge S01E02 - Trust
Revenge S02E15 - Retribution
Lost S03E08 - Flashes Before Your Eyes
```

**Incorrect:**
```
Revenge - Season 1 Episode 1 - Pilot          ❌ (not using S##E## format)
Revenge S1E1 - Pilot                          ❌ (missing zero-padding)
Revenge 1x01 - Pilot                          ❌ (using 1x01 instead of S01E01)
S01E01 - Pilot                                ❌ (missing series name)
Revenge S01E01 Pilot                          ❌ (missing hyphen separator)
```

### Season and Episode Number Rules

1. **Always use zero-padding:**
   - Seasons 1-9: S01, S02, ..., S09
   - Seasons 10+: S10, S11, S12, etc.
   - Episodes 1-9: E01, E02, ..., E09
   - Episodes 10+: E10, E11, E12, etc.

2. **Consistency is critical:**
   - Use the exact same series name across all episodes
   - Maintain consistent capitalization
   - Use the same separator pattern (space-hyphen-space)

3. **Special episodes:**
   - Specials can use S00E01, S00E02, etc.
   - Holiday episodes should still follow standard numbering within their season

---

## Playlist Organization

Playlists are the **authoritative source** for episode ordering in Kiyya. Proper playlist organization is essential for correct series display.

### Playlist Naming Convention

```
SeriesName – Season X
```

**Components:**
- `SeriesName`: Exact series name matching episode titles
- ` – `: Space, en dash (–), space separator (or hyphen is acceptable)
- `Season X`: Season number (can use 1, 2, 3 or 01, 02, 03)

### Examples

**Correct:**
```
Revenge – Season 1
Revenge – Season 2
Lost – Season 3
Breaking Bad – Season 01
```

**Acceptable Variations:**
```
Revenge - Season 1                            ✓ (hyphen instead of en dash)
Revenge – Season 01                           ✓ (zero-padded season number)
```

**Incorrect:**
```
Revenge S1                                    ❌ (missing "Season" word)
Season 1 - Revenge                            ❌ (wrong order)
Revenge: Season 1                             ❌ (using colon)
```

### Playlist Item Ordering

1. **Add episodes in correct viewing order**
   - Episode 1 should be first in the playlist
   - Episode 2 should be second, etc.
   - Playlist order overrides title parsing

2. **Complete seasons**
   - Include all episodes for a season in one playlist
   - Do not split seasons across multiple playlists

3. **Consistency**
   - Create one playlist per season
   - Use consistent naming across all season playlists

### Fallback Behavior

If playlists are not available or incomplete:
- Kiyya will parse episode numbers from titles (S##E## format)
- Episodes will be grouped by season number
- A notice will display: "Seasons inferred automatically"
- **This is a fallback only** - playlists are strongly recommended

---

## Thumbnail Requirements

### Aspect Ratio

All content thumbnails must use a **2:3 aspect ratio** (portrait orientation):

**Recommended Resolutions:**
- Standard: 720×1080 pixels
- High Quality: 1280×1920 pixels
- Minimum: 480×720 pixels

### Quality Guidelines

1. **Upload custom thumbnails for every video**
   - Do not rely on auto-generated thumbnails
   - Use high-quality source images

2. **Poster-style design**
   - Design thumbnails like movie/TV posters
   - Include title text if appropriate
   - Ensure key visual elements are centered

3. **Consistency within series**
   - Use similar design style across all episodes
   - Maintain consistent branding elements

4. **Season posters**
   - For playlist/season thumbnails, use the first episode's thumbnail
   - Alternatively, create a custom season poster

### Technical Requirements

- **Format:** JPEG or PNG
- **File size:** Under 2MB recommended
- **Color space:** sRGB
- **Avoid:** Excessive text, low contrast, busy backgrounds

---

## Category Filter Tags

Category filter tags enable content to appear in specific filtered views within the application.

### Movies Category

| Filter | Tag | Description |
|--------|-----|-------------|
| Comedy | `comedy_movies` | Comedy movies |
| Action | `action_movies` | Action movies |
| Romance | `romance_movies` | Romance movies |

**Usage:**
```
Title: The Hangover
Tags: movie, comedy_movies
```

### Series Category

| Filter | Tag | Description |
|--------|-----|-------------|
| Comedy | `comedy_series` | Comedy series |
| Action | `action_series` | Action series |
| Romance | `romance_series` | Romance series |

**Usage:**
```
Title: Breaking Bad S01E01 - Pilot
Tags: series, breaking_bad_series, action_series
```

### Kids Category

| Filter | Tag | Description |
|--------|-----|-------------|
| Comedy | `comedy_kids` | Comedy kids content |
| Action | `action_kids` | Action kids content |

**Usage:**
```
Title: SpongeBob SquarePants S01E01 - Help Wanted
Tags: kids, comedy_kids, spongebob_series
```

### Multiple Category Tags

Content can have multiple category filter tags if appropriate:

```
Title: Guardians of the Galaxy
Tags: movie, action_movies, comedy_movies
```

This allows the movie to appear in both Action and Comedy filtered views.

---

## Hero Content

Hero content appears prominently on the application's home page with autoplay capability.

### Hero Tag

Use the `hero_trailer` tag to mark content for hero display:

```
Title: Kiyya Presents: Summer Blockbusters
Tags: hero_trailer, movie
```

### Hero Content Guidelines

1. **Selection criteria:**
   - High-quality, engaging content
   - Appropriate for prominent display
   - Represents the best of your channel

2. **Video requirements:**
   - Should work well with autoplay (muted)
   - Engaging visuals in the first few seconds
   - High-quality thumbnail for fallback display

3. **Quantity:**
   - Tag 10-20 videos as hero content
   - Application randomly selects one per session
   - Rotate hero content regularly

4. **Content types:**
   - Trailers for upcoming content
   - Highlight reels
   - Featured movies or episodes
   - Special announcements

### Hero Behavior

- Application fetches up to 20 items tagged with `hero_trailer`
- One is randomly selected per application session
- Autoplay is attempted (muted)
- If autoplay fails, poster thumbnail is displayed with play button
- Hero selection persists for the entire session

---

## Quality Checklist

Before publishing content, verify the following:

### Tagging Checklist

- [ ] Base content type tag applied (`movie`, `series`, `sitcom`, or `kids`)
- [ ] At least one category filter tag applied
- [ ] Series-specific tag applied (for series content)
- [ ] `hero_trailer` tag applied (if appropriate)
- [ ] All tags match exact spelling from this guide

### Naming Checklist (Series Only)

- [ ] Title follows `SeriesName S##E## - Episode Title` format
- [ ] Season number is zero-padded (S01, not S1)
- [ ] Episode number is zero-padded (E01, not E1)
- [ ] Series name is consistent across all episodes
- [ ] Separator is space-hyphen-space (` - `)

### Playlist Checklist (Series Only)

- [ ] Playlist created for each season
- [ ] Playlist title follows `SeriesName – Season X` format
- [ ] Episodes added in correct viewing order
- [ ] All episodes for the season are included
- [ ] Playlist order matches intended episode sequence

### Thumbnail Checklist

- [ ] Custom thumbnail uploaded (not auto-generated)
- [ ] Aspect ratio is 2:3 (portrait)
- [ ] Resolution is at least 720×1080 pixels
- [ ] Image is clear and high quality
- [ ] Design is consistent with other content in series

### Metadata Checklist

- [ ] Description is complete and accurate
- [ ] Release date is set correctly
- [ ] Content is published (not unlisted or private)
- [ ] Video quality is appropriate (720p minimum recommended)

---

## Common Mistakes to Avoid

### 1. Inconsistent Series Names

**Wrong:**
```
Revenge S01E01 - Pilot
The Revenge S01E02 - Trust
Revenge: S01E03 - Betrayal
```

**Correct:**
```
Revenge S01E01 - Pilot
Revenge S01E02 - Trust
Revenge S01E03 - Betrayal
```

### 2. Missing Zero-Padding

**Wrong:**
```
Lost S1E5 - White Rabbit
```

**Correct:**
```
Lost S01E05 - White Rabbit
```

### 3. Incorrect Tag Spelling

**Wrong:**
```
Tags: movies, action-movies, series-action
```

**Correct:**
```
Tags: movie, action_movies, action_series
```

### 4. Missing Required Tags

**Wrong:**
```
Title: Breaking Bad S01E01 - Pilot
Tags: breaking_bad_series
```

**Correct:**
```
Title: Breaking Bad S01E01 - Pilot
Tags: series, breaking_bad_series, action_series
```

### 5. Incorrect Playlist Ordering

**Wrong:**
- Episode 5 listed first
- Episode 1 listed third
- Episodes out of sequence

**Correct:**
- Episode 1 listed first
- Episode 2 listed second
- All episodes in sequential order

---

## Advanced Topics

### Multi-Season Series Management

For long-running series:

1. **Create separate playlists for each season**
   ```
   Breaking Bad – Season 1
   Breaking Bad – Season 2
   Breaking Bad – Season 3
   Breaking Bad – Season 4
   Breaking Bad – Season 5
   ```

2. **Use consistent series tags across all seasons**
   ```
   Tags: series, breaking_bad_series, action_series
   ```

3. **Maintain episode numbering within each season**
   ```
   Breaking Bad S01E01 - Pilot
   Breaking Bad S01E02 - Cat's in the Bag...
   ...
   Breaking Bad S02E01 - Seven Thirty-Seven
   Breaking Bad S02E02 - Grilled
   ```

### Special Episodes and Extras

For special episodes, behind-the-scenes content, or extras:

1. **Use Season 0 for specials**
   ```
   Breaking Bad S00E01 - Behind the Scenes
   Breaking Bad S00E02 - Cast Interviews
   ```

2. **Create a separate playlist if needed**
   ```
   Breaking Bad – Specials
   ```

3. **Tag appropriately**
   ```
   Tags: series, breaking_bad_series, action_series
   ```

### Related Content Recommendations

The application automatically suggests related content based on category tags:

- When a user views a movie, 10 random items from the same category are suggested
- The current content is excluded from recommendations
- Proper category tagging ensures relevant recommendations

**Example:**
```
User watches: The Dark Knight (tags: movie, action_movies)
App suggests: Other content tagged with action_movies
```

---

## Support and Questions

### Validation

After uploading content, verify it appears correctly in Kiyya:

1. Check that content appears in the correct category
2. Verify series episodes are grouped by season
3. Confirm episode ordering matches playlist order
4. Test that thumbnails display properly
5. Verify search functionality finds your content

### Troubleshooting

**Content not appearing:**
- Verify all required tags are applied
- Check tag spelling matches this guide exactly
- Ensure content is published (not unlisted)

**Episodes out of order:**
- Check playlist item ordering
- Verify episode numbers in titles are correct
- Ensure zero-padding is used consistently

**Thumbnails not displaying:**
- Verify thumbnail aspect ratio is 2:3
- Check file size is under 2MB
- Ensure thumbnail uploaded successfully

### Updates to This Guide

This guide reflects the current tagging system for Kiyya. Tag names and conventions are fixed and should not be modified without updating the application code.

For questions or clarification, refer to the application's technical documentation or contact the development team.

---

## Quick Reference

### Essential Tags

```
Base Tags:        series, movie, sitcom, kids, hero_trailer
Movie Filters:    comedy_movies, action_movies, romance_movies
Series Filters:   comedy_series, action_series, romance_series
Kids Filters:     comedy_kids, action_kids
```

### Episode Title Format

```
SeriesName S##E## - Episode Title
```

### Playlist Title Format

```
SeriesName – Season X
```

### Thumbnail Specs

```
Aspect Ratio:     2:3 (portrait)
Resolution:       720×1080 or 1280×1920
Format:           JPEG or PNG
Max Size:         2MB
```

---

**Document Version:** 1.0  
**Last Updated:** February 2026  
**Application:** Kiyya Desktop Streaming Application
