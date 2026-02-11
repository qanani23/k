/**
 * Search normalization and query processing utilities
 * Handles season/episode variations and text normalization
 */

export interface NormalizedQuery {
  originalText: string;
  normalizedText: string;
  seasonEpisodeTokens: string[];
  searchTerms: string[];
}

/**
 * Normalize search query to handle season/episode variations
 * Converts various formats to canonical S01E01 format
 * 
 * Supported formats:
 * - S01E01, s1e1, S1E1 (standard format)
 * - 1x01, 1x1 (alternative format)
 * - season 1 episode 1 (verbose format)
 * - season one episode one (word format)
 * - ep 1, episode 1 (episode only)
 */
export function normalizeQuery(query: string): NormalizedQuery {
  const originalText = query.trim();
  let normalizedText = originalText.toLowerCase();
  const seasonEpisodeTokens: string[] = [];
  const searchTerms: string[] = [];

  // Season/Episode normalization patterns
  const patterns = [
    // Season patterns - numeric
    { regex: /\bseason\s+(\d+)/gi, replacement: 'S$1' },
    { regex: /\bs(\d+)(?![a-z])/gi, replacement: 'S$1' }, // s1 but not "series"
    
    // Season patterns - word form
    { regex: /\bseason\s+one\b/gi, replacement: 'S01' },
    { regex: /\bseason\s+two\b/gi, replacement: 'S02' },
    { regex: /\bseason\s+three\b/gi, replacement: 'S03' },
    { regex: /\bseason\s+four\b/gi, replacement: 'S04' },
    { regex: /\bseason\s+five\b/gi, replacement: 'S05' },
    { regex: /\bseason\s+six\b/gi, replacement: 'S06' },
    { regex: /\bseason\s+seven\b/gi, replacement: 'S07' },
    { regex: /\bseason\s+eight\b/gi, replacement: 'S08' },
    { regex: /\bseason\s+nine\b/gi, replacement: 'S09' },
    { regex: /\bseason\s+ten\b/gi, replacement: 'S10' },
    
    // Episode patterns - numeric
    { regex: /\bepisode\s+(\d+)/gi, replacement: 'E$1' },
    { regex: /\bep\.?\s*(\d+)/gi, replacement: 'E$1' }, // ep 1 or ep. 1
    { regex: /\be(\d+)(?![a-z])/gi, replacement: 'E$1' }, // e1 but not "episode"
    
    // Episode patterns - word form
    { regex: /\bepisode\s+one\b/gi, replacement: 'E01' },
    { regex: /\bepisode\s+two\b/gi, replacement: 'E02' },
    { regex: /\bepisode\s+three\b/gi, replacement: 'E03' },
    { regex: /\bepisode\s+four\b/gi, replacement: 'E04' },
    { regex: /\bepisode\s+five\b/gi, replacement: 'E05' },
    { regex: /\bepisode\s+six\b/gi, replacement: 'E06' },
    { regex: /\bepisode\s+seven\b/gi, replacement: 'E07' },
    { regex: /\bepisode\s+eight\b/gi, replacement: 'E08' },
    { regex: /\bepisode\s+nine\b/gi, replacement: 'E09' },
    { regex: /\bepisode\s+ten\b/gi, replacement: 'E10' },
    { regex: /\bepisode\s+eleven\b/gi, replacement: 'E11' },
    { regex: /\bepisode\s+twelve\b/gi, replacement: 'E12' },
    { regex: /\bepisode\s+thirteen\b/gi, replacement: 'E13' },
    { regex: /\bepisode\s+fourteen\b/gi, replacement: 'E14' },
    { regex: /\bepisode\s+fifteen\b/gi, replacement: 'E15' },
    { regex: /\bepisode\s+sixteen\b/gi, replacement: 'E16' },
    { regex: /\bepisode\s+seventeen\b/gi, replacement: 'E17' },
    { regex: /\bepisode\s+eighteen\b/gi, replacement: 'E18' },
    { regex: /\bepisode\s+nineteen\b/gi, replacement: 'E19' },
    { regex: /\bepisode\s+twenty\b/gi, replacement: 'E20' },
  ];

  // Apply normalization patterns
  for (const pattern of patterns) {
    normalizedText = normalizedText.replace(pattern.regex, pattern.replacement);
  }

  // Extract season/episode tokens from various formats
  // Matches: S01E01, s1e1, 1x01, 1x1, S1 E1, etc.
  const seasonEpisodeRegex = /(?:S|s)?0?(\d{1,2})(?:[ .xX-]+|(?=[Ee]))(?:E|e)?0?(\d{1,3})/gi;
  let match;
  const processedPositions = new Set<number>();
  
  while ((match = seasonEpisodeRegex.exec(normalizedText)) !== null) {
    // Avoid duplicate matches at the same position
    if (processedPositions.has(match.index)) {
      continue;
    }
    processedPositions.add(match.index);
    
    const season = match[1].padStart(2, '0');
    const episode = match[2].padStart(2, '0');
    const token = `S${season}E${episode}`;
    
    // Only add unique tokens
    if (!seasonEpisodeTokens.includes(token)) {
      seasonEpisodeTokens.push(token);
    }
  }

  // Extract other search terms (remove season/episode tokens)
  const cleanedText = normalizedText
    .replace(/S\d{1,2}E\d{1,3}/gi, ' ')
    .replace(/\d{1,2}[xX]\d{1,3}/g, ' ')
    .trim();
  
  if (cleanedText) {
    const terms = cleanedText.split(/\s+/).filter(term => term.length > 2);
    searchTerms.push(...terms);
  }

  return {
    originalText,
    normalizedText,
    seasonEpisodeTokens,
    searchTerms,
  };
}

/**
 * Parse episode information from title
 * Extracts season and episode numbers from various title formats
 */
export function parseEpisodeFromTitle(title: string): {
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
} | null {
  // Pattern for "SeriesName S01E01 - Episode Title"
  const standardPattern = /^(.+?)\s+S(\d{1,2})E(\d{1,3})(?:\s*[-–]\s*(.+))?$/i;
  const match = standardPattern.exec(title.trim());
  
  if (match) {
    return {
      seriesName: match[1].trim(),
      seasonNumber: parseInt(match[2], 10),
      episodeNumber: parseInt(match[3], 10),
      episodeTitle: match[4]?.trim(),
    };
  }

  // Alternative patterns
  const altPatterns = [
    // "SeriesName 1x01 - Episode Title"
    /^(.+?)\s+(\d{1,2})x(\d{1,3})(?:\s*[-–]\s*(.+))?$/i,
    // "SeriesName Season 1 Episode 1 - Episode Title"
    /^(.+?)\s+Season\s+(\d{1,2})\s+Episode\s+(\d{1,3})(?:\s*[-–]\s*(.+))?$/i,
  ];

  for (const pattern of altPatterns) {
    const altMatch = pattern.exec(title.trim());
    if (altMatch) {
      return {
        seriesName: altMatch[1].trim(),
        seasonNumber: parseInt(altMatch[2], 10),
        episodeNumber: parseInt(altMatch[3], 10),
        episodeTitle: altMatch[4]?.trim(),
      };
    }
  }

  return null;
}

/**
 * Generate search variations for better matching
 */
export function generateSearchVariations(query: string): string[] {
  const normalized = normalizeQuery(query);
  const variations = new Set<string>();
  
  // Add original query
  variations.add(normalized.originalText);
  variations.add(normalized.normalizedText);
  
  // Add season/episode tokens
  for (const token of normalized.seasonEpisodeTokens) {
    variations.add(token);
    
    // Add variations without leading zeros
    const withoutZeros = token.replace(/S0(\d)/, 'S$1').replace(/E0(\d)/, 'E$1');
    variations.add(withoutZeros);
    
    // Add space-separated version
    const spaced = token.replace(/S(\d+)E(\d+)/, 'S$1 E$2');
    variations.add(spaced);
  }
  
  // Add individual search terms
  for (const term of normalized.searchTerms) {
    if (term.length > 2) {
      variations.add(term);
    }
  }
  
  return Array.from(variations);
}

/**
 * Sanitize search input to prevent SQL injection
 */
export function sanitizeSearchInput(input: string): string {
  // Remove or escape potentially dangerous characters
  return input
    .replace(/[%_]/g, '\\$&') // Escape SQL LIKE wildcards
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[;]/g, '') // Remove semicolons
    .replace(/--/g, '') // Remove SQL comments
    .replace(/\/\*/g, '') // Remove SQL block comments start
    .replace(/\*\//g, '') // Remove SQL block comments end
    .trim();
}

/**
 * Build SQL LIKE patterns for search
 */
export function buildSearchPatterns(query: string): string[] {
  const sanitized = sanitizeSearchInput(query);
  const normalized = normalizeQuery(sanitized);
  const patterns: string[] = [];
  
  // Add patterns for season/episode tokens
  for (const token of normalized.seasonEpisodeTokens) {
    patterns.push(`%${token}%`);
  }
  
  // Add patterns for search terms
  for (const term of normalized.searchTerms) {
    if (term.length > 2) {
      patterns.push(`%${term}%`);
    }
  }
  
  // Add pattern for the full normalized text
  if (normalized.normalizedText && normalized.normalizedText !== normalized.originalText) {
    patterns.push(`%${normalized.normalizedText}%`);
  }
  
  return patterns;
}

/**
 * Score search results based on relevance
 */
export function scoreSearchResult(
  content: { title: string; description?: string; tags: string[] },
  query: string
): number {
  const normalized = normalizeQuery(query);
  let score = 0;
  
  const title = content.title.toLowerCase();
  const description = content.description?.toLowerCase() || '';
  const tags = content.tags.map(tag => tag.toLowerCase());
  
  // Exact title match gets highest score
  if (title === normalized.normalizedText) {
    score += 100;
  }
  
  // Title contains query
  if (title.includes(normalized.normalizedText)) {
    score += 50;
  }
  
  // Season/episode token matches
  for (const token of normalized.seasonEpisodeTokens) {
    if (title.includes(token.toLowerCase())) {
      score += 30;
    }
  }
  
  // Search term matches in title
  for (const term of normalized.searchTerms) {
    if (title.includes(term)) {
      score += 20;
    }
    if (description.includes(term)) {
      score += 10;
    }
  }
  
  // Tag matches
  for (const term of normalized.searchTerms) {
    for (const tag of tags) {
      if (tag.includes(term)) {
        score += 15;
      }
    }
  }
  
  return score;
}

/**
 * Sort search results by relevance score
 */
export function sortSearchResults<T extends { title: string; description?: string; tags: string[] }>(
  results: T[],
  query: string
): T[] {
  return results
    .map(result => ({
      item: result,
      score: scoreSearchResult(result, query),
    }))
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(text: string, query: string): string {
  const normalized = normalizeQuery(query);
  let highlighted = text;
  
  // Highlight season/episode tokens
  for (const token of normalized.seasonEpisodeTokens) {
    const regex = new RegExp(`(${token})`, 'gi');
    highlighted = highlighted.replace(regex, '<mark>$1</mark>');
  }
  
  // Highlight search terms
  for (const term of normalized.searchTerms) {
    if (term.length > 2) {
      const regex = new RegExp(`(${term})`, 'gi');
      highlighted = highlighted.replace(regex, '<mark>$1</mark>');
    }
  }
  
  return highlighted;
}

/**
 * Extract series key from title for grouping
 */
export function extractSeriesKey(title: string): string | null {
  const parsed = parseEpisodeFromTitle(title);
  if (parsed?.seriesName) {
    return parsed.seriesName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  return null;
}

/**
 * Check if query looks like a season/episode search
 */
export function isSeasonEpisodeQuery(query: string): boolean {
  const normalized = normalizeQuery(query);
  return normalized.seasonEpisodeTokens.length > 0;
}

/**
 * Get suggested search terms based on partial input
 */
export function getSuggestedSearchTerms(partialQuery: string): string[] {
  const suggestions: string[] = [];
  const lower = partialQuery.toLowerCase();
  
  // Season suggestions
  if (lower.includes('s') || lower.includes('season')) {
    for (let i = 1; i <= 10; i++) {
      suggestions.push(`Season ${i}`);
      suggestions.push(`S${i.toString().padStart(2, '0')}`);
    }
  }
  
  // Episode suggestions
  if (lower.includes('e') || lower.includes('episode')) {
    for (let i = 1; i <= 20; i++) {
      suggestions.push(`Episode ${i}`);
      suggestions.push(`E${i.toString().padStart(2, '0')}`);
    }
  }
  
  // Common search terms
  const commonTerms = [
    'comedy', 'action', 'drama', 'thriller', 'horror', 'romance',
    'documentary', 'animation', 'sci-fi', 'fantasy', 'mystery'
  ];
  
  for (const term of commonTerms) {
    if (term.startsWith(lower)) {
      suggestions.push(term);
    }
  }
  
  return suggestions.slice(0, 10); // Limit to 10 suggestions
}

/**
 * Check if search should fallback to recent uploads
 * Returns true when search results are empty and query is valid
 */
export function shouldFallbackToRecent(
  query: string,
  results: unknown[],
  minLength: number = 2
): boolean {
  const sanitized = sanitizeSearchInput(query);
  return sanitized.length >= minLength && results.length === 0;
}

/**
 * Get fallback message for zero results
 */
export function getFallbackMessage(query: string): string {
  return `No exact matches found for "${query}". Here are some recent uploads you might like:`;
}