import { 
  ContentItem, 
  Playlist, 
  SeriesInfo, 
  Season, 
  Episode,
  ParsedSeries 
} from '../types';

/**
 * Series parsing and ordering logic
 * 
 * This module handles:
 * - Parsing episode titles in "SeriesName S01E01 - Episode Title" format
 * - Organizing episodes by season using playlist data (canonical)
 * - Fallback to title parsing when playlists unavailable
 * - Episode ordering preservation across reloads
 * - Marking inferred seasons when playlists are missing
 * 
 * CRITICAL: Playlist Order is Canonical
 * =====================================
 * When playlist data is available, the playlist position (PlaylistItem.position) 
 * is the AUTHORITATIVE source for episode ordering. This means:
 * 
 * 1. Episodes MUST be displayed in playlist position order (0, 1, 2, ...)
 * 2. Episode numbers from PlaylistItem.episode_number are preserved but do NOT 
 *    affect display order
 * 3. Even if episode numbers suggest a different order (e.g., ep3, ep1, ep2), 
 *    the playlist position determines the actual order
 * 4. This ordering is preserved across application reloads and must never be 
 *    reordered by episode number
 * 
 * Example:
 * If a playlist has:
 *   - Position 0: Episode 5
 *   - Position 1: Episode 1  
 *   - Position 2: Episode 3
 * 
 * The UI MUST display them in that exact order (5, 1, 3), not sorted by 
 * episode number (1, 3, 5).
 * 
 * This ensures content creators have full control over episode presentation,
 * which is essential for series with non-linear storytelling, special episodes,
 * or intentional ordering that differs from production order.
 */

/**
 * Parse episode title following various episode format patterns
 * Returns null if title doesn't match any expected format
 * 
 * Supported formats:
 * - "SeriesName S01E01 - Episode Title" (standard format)
 * - "SeriesName S1E1 - Episode Title" (single digit variations)
 * - "SeriesName 1x01 - Episode Title" (alternative format)
 * - "SeriesName Season 1 Episode 1 - Episode Title" (verbose format)
 * - "SeriesName S01E01 Episode Title" (without dash separator)
 * - "SeriesName 1x01 Episode Title" (alternative without dash)
 * 
 * @param title - Episode title to parse
 * @returns Parsed series information or null if format doesn't match
 */
export function parseEpisodeTitle(title: string): ParsedSeries | null {
  const trimmedTitle = title.trim();
  
  // Pattern 1: Standard SxxExx format with optional dash
  // Matches: "SeriesName S01E01 - Episode Title" or "SeriesName S01E01 Episode Title"
  // Supports: S01E01, S1E1, S01E1, S1E01, s01e01 (case insensitive)
  const standardPattern = /^(.+?)\s+S(\d{1,2})E(\d{1,3})(?:\s*[-–]\s*(.+)|(?:\s+(.+)))?$/i;
  const standardMatch = trimmedTitle.match(standardPattern);
  
  if (standardMatch) {
    const episodeTitle = standardMatch[4] || standardMatch[5];
    return {
      series_name: standardMatch[1].trim(),
      season_number: parseInt(standardMatch[2], 10),
      episode_number: parseInt(standardMatch[3], 10),
      episode_title: episodeTitle ? episodeTitle.trim() : ''
    };
  }
  
  // Pattern 2: Alternative 1x01 format with optional dash
  // Matches: "SeriesName 1x01 - Episode Title" or "SeriesName 1x01 Episode Title"
  const altPattern = /^(.+?)\s+(\d{1,2})[xX](\d{1,3})(?:\s*[-–]\s*(.+)|(?:\s+(.+)))?$/;
  const altMatch = trimmedTitle.match(altPattern);
  
  if (altMatch) {
    const episodeTitle = altMatch[4] || altMatch[5];
    return {
      series_name: altMatch[1].trim(),
      season_number: parseInt(altMatch[2], 10),
      episode_number: parseInt(altMatch[3], 10),
      episode_title: episodeTitle ? episodeTitle.trim() : ''
    };
  }
  
  // Pattern 3: Verbose "Season X Episode Y" format with optional dash
  // Matches: "SeriesName Season 1 Episode 1 - Episode Title"
  const verbosePattern = /^(.+?)\s+Season\s+(\d{1,2})\s+Episode\s+(\d{1,3})(?:\s*[-–]\s*(.+)|(?:\s+(.+)))?$/i;
  const verboseMatch = trimmedTitle.match(verbosePattern);
  
  if (verboseMatch) {
    const episodeTitle = verboseMatch[4] || verboseMatch[5];
    return {
      series_name: verboseMatch[1].trim(),
      season_number: parseInt(verboseMatch[2], 10),
      episode_number: parseInt(verboseMatch[3], 10),
      episode_title: episodeTitle ? episodeTitle.trim() : ''
    };
  }
  
  // Pattern 4: Compact format without separator (less common but valid)
  // Matches: "SeriesName S01E01Episode Title" (no space or dash before episode title)
  // This is a fallback for edge cases where formatting is inconsistent
  const compactPattern = /^(.+?)\s+S(\d{1,2})E(\d{1,3})([A-Z].*)$/i;
  const compactMatch = trimmedTitle.match(compactPattern);
  
  if (compactMatch) {
    return {
      series_name: compactMatch[1].trim(),
      season_number: parseInt(compactMatch[2], 10),
      episode_number: parseInt(compactMatch[3], 10),
      episode_title: compactMatch[4].trim()
    };
  }
  
  // No pattern matched
  return null;
}

/**
 * Generate a normalized series key from series name
 * Used for grouping episodes by series
 * 
 * @param seriesName - Series name to normalize
 * @returns Normalized series key (lowercase, alphanumeric, hyphen-separated)
 */
export function generateSeriesKey(seriesName: string): string {
  return seriesName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('-');
}

/**
 * Convert ContentItem to Episode
 * 
 * @param content - Content item to convert
 * @param episodeNumber - Episode number (from playlist or parsed)
 * @param seasonNumber - Season number (from playlist or parsed)
 * @returns Episode object
 */
export function contentToEpisode(
  content: ContentItem,
  episodeNumber: number,
  seasonNumber: number
): Episode {
  return {
    claim_id: content.claim_id,
    title: content.title,
    episode_number: episodeNumber,
    season_number: seasonNumber,
    thumbnail_url: content.thumbnail_url,
    duration: content.duration
  };
}

/**
 * Organize episodes from playlist data (canonical ordering)
 * 
 * CRITICAL: This function implements the CANONICAL episode ordering system.
 * Playlist position is the authoritative source of truth for episode order.
 * 
 * Ordering Rules:
 * 1. Episodes are sorted by PlaylistItem.position (ascending)
 * 2. Position determines display order, NOT episode_number
 * 3. Episode numbers are preserved from playlist metadata but don't affect order
 * 4. This ordering MUST be preserved across reloads and never reordered
 * 
 * Fallback Behavior:
 * - If episode_number is missing, attempts to parse from title
 * - If parsing fails, uses (position + 1) as episode number
 * - If season_number is missing, uses playlist.season_number or defaults to 1
 * 
 * @param playlist - Playlist containing episode items with position data
 * @param contentMap - Map of claim_id to ContentItem for episode details
 * @returns Array of episodes in playlist position order (canonical)
 */
export function organizeEpisodesFromPlaylist(
  playlist: Playlist,
  contentMap: Map<string, ContentItem>
): Episode[] {
  // Sort by position to ensure playlist order is preserved
  const sortedItems = [...playlist.items].sort((a, b) => a.position - b.position);
  
  const episodes: Episode[] = [];
  
  for (const item of sortedItems) {
    const content = contentMap.get(item.claim_id);
    if (!content) {
      continue; // Skip if content not found
    }
    
    // Use playlist metadata if available, otherwise parse from title
    let episodeNumber = item.episode_number;
    let seasonNumber = item.season_number || playlist.season_number;
    
    if (!episodeNumber || !seasonNumber) {
      const parsed = parseEpisodeTitle(content.title);
      if (parsed) {
        episodeNumber = episodeNumber || parsed.episode_number;
        seasonNumber = seasonNumber || parsed.season_number;
      }
    }
    
    // If still no episode/season number, use position as episode number
    if (!episodeNumber) {
      episodeNumber = item.position + 1;
    }
    if (!seasonNumber) {
      seasonNumber = 1; // Default to season 1
    }
    
    episodes.push(contentToEpisode(content, episodeNumber, seasonNumber));
  }
  
  return episodes;
}

/**
 * Organize episodes by parsing titles (fallback when playlists unavailable)
 * Groups episodes by series and season, then sorts by episode number
 * 
 * @param content - Array of content items to organize
 * @returns Map of series_key to SeriesInfo with inferred seasons
 */
export function organizeEpisodesByParsing(content: ContentItem[]): Map<string, SeriesInfo> {
  const seriesMap = new Map<string, Map<number, Episode[]>>();
  const seriesTitles = new Map<string, string>();
  
  // Parse all content and group by series and season
  for (const item of content) {
    const parsed = parseEpisodeTitle(item.title);
    if (!parsed) {
      continue; // Skip items that don't match episode format
    }
    
    const seriesKey = generateSeriesKey(parsed.series_name);
    
    // Track series title
    if (!seriesTitles.has(seriesKey)) {
      seriesTitles.set(seriesKey, parsed.series_name);
    }
    
    // Get or create series map
    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, new Map<number, Episode[]>());
    }
    
    const seasonMap = seriesMap.get(seriesKey)!;
    
    // Get or create season array
    if (!seasonMap.has(parsed.season_number)) {
      seasonMap.set(parsed.season_number, []);
    }
    
    const episodes = seasonMap.get(parsed.season_number)!;
    episodes.push(contentToEpisode(item, parsed.episode_number, parsed.season_number));
  }
  
  // Convert to SeriesInfo objects
  const result = new Map<string, SeriesInfo>();
  
  for (const [seriesKey, seasonMap] of seriesMap.entries()) {
    const seasons: Season[] = [];
    let totalEpisodes = 0;
    
    // Sort seasons by number
    const sortedSeasonNumbers = Array.from(seasonMap.keys()).sort((a, b) => a - b);
    
    for (const seasonNumber of sortedSeasonNumbers) {
      const episodes = seasonMap.get(seasonNumber)!;
      
      // Sort episodes by episode number
      episodes.sort((a, b) => a.episode_number - b.episode_number);
      
      seasons.push({
        number: seasonNumber,
        episodes,
        playlist_id: undefined, // No playlist available
        inferred: true // Mark as inferred since we parsed from titles
      });
      
      totalEpisodes += episodes.length;
    }
    
    result.set(seriesKey, {
      series_key: seriesKey,
      title: seriesTitles.get(seriesKey) || seriesKey,
      seasons,
      total_episodes: totalEpisodes
    });
  }
  
  return result;
}

/**
 * Organize series from playlists (canonical method)
 * Uses playlist data as the authoritative source for episode ordering
 * 
 * @param playlists - Array of playlists from the backend
 * @param contentMap - Map of claim_id to ContentItem for episode details
 * @returns Map of series_key to SeriesInfo with playlist-based seasons
 */
export function organizeSeriesFromPlaylists(
  playlists: Playlist[],
  contentMap: Map<string, ContentItem>
): Map<string, SeriesInfo> {
  const seriesMap = new Map<string, Season[]>();
  const seriesTitles = new Map<string, string>();
  
  for (const playlist of playlists) {
    const seriesKey = playlist.series_key || generateSeriesKey(playlist.title);
    
    // Track series title
    if (!seriesTitles.has(seriesKey)) {
      seriesTitles.set(seriesKey, playlist.title);
    }
    
    // Get or create seasons array for this series
    if (!seriesMap.has(seriesKey)) {
      seriesMap.set(seriesKey, []);
    }
    
    const seasons = seriesMap.get(seriesKey)!;
    
    // Organize episodes from this playlist
    const episodes = organizeEpisodesFromPlaylist(playlist, contentMap);
    
    if (episodes.length > 0) {
      const seasonNumber = playlist.season_number || 1;
      
      seasons.push({
        number: seasonNumber,
        episodes,
        playlist_id: playlist.id,
        inferred: false // Not inferred, from playlist
      });
    }
  }
  
  // Convert to SeriesInfo objects
  const result = new Map<string, SeriesInfo>();
  
  for (const [seriesKey, seasons] of seriesMap.entries()) {
    // Sort seasons by number
    seasons.sort((a, b) => a.number - b.number);
    
    const totalEpisodes = seasons.reduce((sum, season) => sum + season.episodes.length, 0);
    
    result.set(seriesKey, {
      series_key: seriesKey,
      title: seriesTitles.get(seriesKey) || seriesKey,
      seasons,
      total_episodes: totalEpisodes
    });
  }
  
  return result;
}

/**
 * Get series info for a specific claim ID
 * Attempts to use playlists first, falls back to parsing if unavailable
 * 
 * @param claimId - Claim ID to find series for
 * @param playlists - Available playlists
 * @param allContent - All content items (for fallback parsing)
 * @returns SeriesInfo if found, null otherwise
 */
export function getSeriesForClaim(
  claimId: string,
  playlists: Playlist[],
  allContent: ContentItem[]
): SeriesInfo | null {
  // Build content map for efficient lookup
  const contentMap = new Map<string, ContentItem>();
  for (const item of allContent) {
    contentMap.set(item.claim_id, item);
  }
  
  // First, try to find in playlists
  for (const playlist of playlists) {
    const hasClaimId = playlist.items.some(item => item.claim_id === claimId);
    if (hasClaimId) {
      const seriesMap = organizeSeriesFromPlaylists([playlist], contentMap);
      const seriesKey = playlist.series_key || generateSeriesKey(playlist.title);
      return seriesMap.get(seriesKey) || null;
    }
  }
  
  // Fallback: try to parse from title
  const content = contentMap.get(claimId);
  if (!content) {
    return null;
  }
  
  const parsed = parseEpisodeTitle(content.title);
  if (!parsed) {
    return null;
  }
  
  // Find all episodes in the same series
  const seriesContent = allContent.filter(item => {
    const itemParsed = parseEpisodeTitle(item.title);
    return itemParsed && generateSeriesKey(itemParsed.series_name) === generateSeriesKey(parsed.series_name);
  });
  
  const seriesMap = organizeEpisodesByParsing(seriesContent);
  const seriesKey = generateSeriesKey(parsed.series_name);
  
  return seriesMap.get(seriesKey) || null;
}

/**
 * Merge playlist-based and parsed series data
 * Prefers playlist data when available, supplements with parsed data
 * 
 * @param playlists - Available playlists
 * @param allContent - All content items
 * @returns Combined map of all series
 */
export function mergeSeriesData(
  playlists: Playlist[],
  allContent: ContentItem[]
): Map<string, SeriesInfo> {
  const contentMap = new Map<string, ContentItem>();
  for (const item of allContent) {
    contentMap.set(item.claim_id, item);
  }
  
  // Start with playlist-based series (authoritative)
  const result = organizeSeriesFromPlaylists(playlists, contentMap);
  
  // Track which content items are already in playlists
  const claimedIds = new Set<string>();
  for (const playlist of playlists) {
    for (const item of playlist.items) {
      claimedIds.add(item.claim_id);
    }
  }
  
  // Find content not in any playlist
  const unclaimedContent = allContent.filter(item => !claimedIds.has(item.claim_id));
  
  // Parse unclaimed content and add to result
  const parsedSeries = organizeEpisodesByParsing(unclaimedContent);
  
  for (const [seriesKey, seriesInfo] of parsedSeries.entries()) {
    if (!result.has(seriesKey)) {
      // New series not in playlists
      result.set(seriesKey, seriesInfo);
    } else {
      // Series exists in playlists, merge inferred seasons
      const existing = result.get(seriesKey)!;
      
      // Add inferred seasons that don't conflict with playlist seasons
      const existingSeasonNumbers = new Set(existing.seasons.map(s => s.number));
      
      for (const season of seriesInfo.seasons) {
        if (!existingSeasonNumbers.has(season.number)) {
          existing.seasons.push(season);
        }
      }
      
      // Re-sort seasons and update total
      existing.seasons.sort((a, b) => a.number - b.number);
      existing.total_episodes = existing.seasons.reduce(
        (sum, season) => sum + season.episodes.length, 
        0
      );
    }
  }
  
  return result;
}

/**
 * Validate episode ordering within a season
 * Checks for duplicate episode numbers and gaps in sequence
 * 
 * @param season - Season to validate
 * @returns Validation result with any issues found
 */
export function validateSeasonOrdering(season: Season): {
  valid: boolean;
  duplicates: number[];
  gaps: number[];
} {
  const episodeNumbers = season.episodes.map(e => e.episode_number);
  const uniqueNumbers = new Set(episodeNumbers);
  
  // Check for duplicates
  const duplicates: number[] = [];
  if (uniqueNumbers.size !== episodeNumbers.length) {
    const counts = new Map<number, number>();
    for (const num of episodeNumbers) {
      counts.set(num, (counts.get(num) || 0) + 1);
    }
    for (const [num, count] of counts.entries()) {
      if (count > 1) {
        duplicates.push(num);
      }
    }
  }
  
  // Check for gaps
  const gaps: number[] = [];
  const sortedNumbers = Array.from(uniqueNumbers).sort((a, b) => a - b);
  for (let i = 0; i < sortedNumbers.length - 1; i++) {
    const current = sortedNumbers[i];
    const next = sortedNumbers[i + 1];
    if (next - current > 1) {
      // Gap detected
      for (let missing = current + 1; missing < next; missing++) {
        gaps.push(missing);
      }
    }
  }
  
  return {
    valid: duplicates.length === 0 && gaps.length === 0,
    duplicates,
    gaps
  };
}

/**
 * Sort episodes within a season by episode number
 * Ensures consistent ordering
 * 
 * @param episodes - Episodes to sort
 * @returns Sorted episodes array
 */
export function sortEpisodes(episodes: Episode[]): Episode[] {
  return [...episodes].sort((a, b) => a.episode_number - b.episode_number);
}

/**
 * Get next episode in series
 * 
 * @param currentEpisode - Current episode
 * @param series - Series info
 * @returns Next episode or null if at end
 */
export function getNextEpisode(
  currentEpisode: Episode,
  series: SeriesInfo
): Episode | null {
  const currentSeason = series.seasons.find(
    s => s.number === currentEpisode.season_number
  );
  
  if (!currentSeason) {
    return null;
  }
  
  // Find current episode index
  const currentIndex = currentSeason.episodes.findIndex(
    e => e.claim_id === currentEpisode.claim_id
  );
  
  if (currentIndex === -1) {
    return null;
  }
  
  // Check if there's a next episode in current season
  if (currentIndex < currentSeason.episodes.length - 1) {
    return currentSeason.episodes[currentIndex + 1];
  }
  
  // Check if there's a next season
  const currentSeasonIndex = series.seasons.findIndex(
    s => s.number === currentEpisode.season_number
  );
  
  if (currentSeasonIndex < series.seasons.length - 1) {
    const nextSeason = series.seasons[currentSeasonIndex + 1];
    return nextSeason.episodes[0] || null;
  }
  
  return null; // End of series
}

/**
 * Get previous episode in series
 * 
 * @param currentEpisode - Current episode
 * @param series - Series info
 * @returns Previous episode or null if at beginning
 */
export function getPreviousEpisode(
  currentEpisode: Episode,
  series: SeriesInfo
): Episode | null {
  const currentSeason = series.seasons.find(
    s => s.number === currentEpisode.season_number
  );
  
  if (!currentSeason) {
    return null;
  }
  
  // Find current episode index
  const currentIndex = currentSeason.episodes.findIndex(
    e => e.claim_id === currentEpisode.claim_id
  );
  
  if (currentIndex === -1) {
    return null;
  }
  
  // Check if there's a previous episode in current season
  if (currentIndex > 0) {
    return currentSeason.episodes[currentIndex - 1];
  }
  
  // Check if there's a previous season
  const currentSeasonIndex = series.seasons.findIndex(
    s => s.number === currentEpisode.season_number
  );
  
  if (currentSeasonIndex > 0) {
    const prevSeason = series.seasons[currentSeasonIndex - 1];
    return prevSeason.episodes[prevSeason.episodes.length - 1] || null;
  }
  
  return null; // Beginning of series
}

/**
 * Check if a content item is a series episode
 * 
 * @param content - Content item to check
 * @returns True if the content is a series episode
 */
export function isSeriesEpisode(content: ContentItem): boolean {
  // Check if content has series tag
  if (content.tags.includes('series') || content.tags.includes('sitcom')) {
    return true;
  }
  
  // Check if title matches episode format
  const parsed = parseEpisodeTitle(content.title);
  return parsed !== null;
}

/**
 * Group series episodes into SeriesInfo structures
 * CRITICAL: This function ensures series are NEVER displayed as flat episode lists
 * 
 * This function takes a flat array of ContentItem (which may include individual episodes)
 * and groups them into proper SeriesInfo structures with seasons and episodes organized.
 * 
 * @param content - Array of content items (may include series episodes)
 * @param playlists - Optional playlists for canonical ordering
 * @returns Object with series (grouped) and non-series content (movies, etc.)
 */
export function groupSeriesContent(
  content: ContentItem[],
  playlists: Playlist[] = []
): {
  series: Map<string, SeriesInfo>;
  nonSeriesContent: ContentItem[];
} {
  // Separate series episodes from other content
  const seriesEpisodes: ContentItem[] = [];
  const nonSeriesContent: ContentItem[] = [];
  
  for (const item of content) {
    if (isSeriesEpisode(item)) {
      seriesEpisodes.push(item);
    } else {
      nonSeriesContent.push(item);
    }
  }
  
  // If no series episodes, return early
  if (seriesEpisodes.length === 0) {
    return {
      series: new Map(),
      nonSeriesContent
    };
  }
  
  // Group series episodes using playlists if available, otherwise parse titles
  let seriesMap: Map<string, SeriesInfo>;
  
  if (playlists.length > 0) {
    // Use playlist-based organization (canonical)
    seriesMap = mergeSeriesData(playlists, seriesEpisodes);
  } else {
    // Fallback to title parsing
    seriesMap = organizeEpisodesByParsing(seriesEpisodes);
  }
  
  return {
    series: seriesMap,
    nonSeriesContent
  };
}

/**
 * Get representative content item for a series
 * Returns the first episode of the first season to represent the series
 * 
 * @param series - Series info
 * @returns ContentItem representing the series (first episode)
 */
export function getSeriesRepresentative(
  series: SeriesInfo,
  allContent: ContentItem[]
): ContentItem | null {
  if (series.seasons.length === 0 || series.seasons[0].episodes.length === 0) {
    return null;
  }
  
  const firstEpisode = series.seasons[0].episodes[0];
  const contentItem = allContent.find(c => c.claim_id === firstEpisode.claim_id);
  
  return contentItem || null;
}

/**
 * Convert SeriesInfo to a display-friendly format
 * Creates a pseudo-ContentItem that represents the entire series
 * 
 * @param series - Series info
 * @param representativeContent - Content item to use as base (first episode)
 * @returns ContentItem representing the series
 */
export function seriesToContentItem(
  series: SeriesInfo,
  representativeContent: ContentItem
): ContentItem {
  return {
    ...representativeContent,
    title: series.title,
    description: `${series.seasons.length} season${series.seasons.length !== 1 ? 's' : ''} • ${series.total_episodes} episodes`,
    // Add a special marker to indicate this is a series container
    tags: [...representativeContent.tags, '__series_container__']
  };
}
