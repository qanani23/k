/**
 * Quality selection and management utilities
 * Implements the quality selection logic specified in the design document
 */

export interface QualitySelectionOptions {
  availableQualities: string[];
  lastUsedQuality?: string;
  networkSpeed?: 'slow' | 'medium' | 'fast';
  autoUpgrade?: boolean;
}

/**
 * Choose initial quality based on network conditions and user preferences
 * Implements the quality selection algorithm from the design document
 */
export function chooseInitialQuality(options: QualitySelectionOptions): string {
  const { availableQualities, lastUsedQuality, networkSpeed } = options;
  
  if (!availableQualities.length) {
    return '480p'; // Fallback
  }

  // If user has a preferred quality and it's available, use it
  if (lastUsedQuality && availableQualities.includes(lastUsedQuality)) {
    return lastUsedQuality;
  }

  // Estimate network speed
  let estimatedSpeed: number;
  if (typeof networkSpeed === 'string') {
    // Handle string network speed values
    estimatedSpeed = networkSpeed === 'fast' ? 10 : networkSpeed === 'medium' ? 3 : 1;
  } else {
    estimatedSpeed = networkSpeed ?? 
      (navigator as any).connection?.downlink ?? 
      3; // Default to 3 Mbps if unknown
  }

  // Quality selection based on network speed
  if (estimatedSpeed >= 5) {
    // High speed: prefer 1080p, fallback to 720p, then best available
    if (availableQualities.includes('1080p')) return '1080p';
    if (availableQualities.includes('720p')) return '720p';
    return availableQualities[availableQualities.length - 1]; // Highest available
  }
  
  if (estimatedSpeed >= 2) {
    // Medium speed: prefer 720p, fallback to 480p, then best available
    if (availableQualities.includes('720p')) return '720p';
    if (availableQualities.includes('480p')) return '480p';
    return availableQualities[availableQualities.length - 1];
  }
  
  // Low speed: prefer 480p, then lowest available
  if (availableQualities.includes('480p')) return '480p';
  return availableQualities[0]; // Lowest available
}

/**
 * Get the next lower quality for downgrading during buffering
 */
export function getNextLowerQuality(currentQuality: string, availableQualities: string[]): string | null {
  const qualityOrder = ['360p', '480p', '720p', '1080p'];
  const currentIndex = qualityOrder.indexOf(currentQuality);
  
  if (currentIndex <= 0) {
    return null; // Already at lowest quality
  }
  
  // Find the next lower quality that's available
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (availableQualities.includes(qualityOrder[i])) {
      return qualityOrder[i];
    }
  }
  
  return null;
}

/**
 * Get the next higher quality for upgrading
 */
export function getNextHigherQuality(currentQuality: string, availableQualities: string[]): string | null {
  const qualityOrder = ['360p', '480p', '720p', '1080p'];
  const currentIndex = qualityOrder.indexOf(currentQuality);
  
  if (currentIndex >= qualityOrder.length - 1) {
    return null; // Already at highest quality
  }
  
  // Find the next higher quality that's available
  for (let i = currentIndex + 1; i < qualityOrder.length; i++) {
    if (availableQualities.includes(qualityOrder[i])) {
      return qualityOrder[i];
    }
  }
  
  return null;
}

/**
 * Check if quality upgrade is recommended based on network conditions
 */
export function shouldUpgradeQuality(
  currentQuality: string,
  availableQualities: string[],
  networkSpeed?: number
): boolean {
  const estimatedSpeed = networkSpeed ?? 
    (navigator as any).connection?.downlink ?? 
    3;

  const nextHigher = getNextHigherQuality(currentQuality, availableQualities);
  if (!nextHigher) return false;

  // Conservative upgrade thresholds
  const upgradeThresholds = {
    '480p': 3, // Need 3+ Mbps to upgrade from 480p to 720p
    '720p': 6, // Need 6+ Mbps to upgrade from 720p to 1080p
  };

  const threshold = upgradeThresholds[currentQuality as keyof typeof upgradeThresholds];
  return threshold ? estimatedSpeed >= threshold : false;
}

/**
 * Get quality display label
 */
export function getQualityLabel(quality: string): string {
  const labels: Record<string, string> = {
    '360p': '360p',
    '480p': '480p (SD)',
    '720p': '720p (HD)',
    '1080p': '1080p (Full HD)',
  };
  
  return labels[quality] || quality;
}

/**
 * Get estimated bandwidth requirement for quality
 */
export function getQualityBandwidth(quality: string): number {
  const bandwidths: Record<string, number> = {
    '360p': 1,    // 1 Mbps
    '480p': 2.5,  // 2.5 Mbps
    '720p': 5,    // 5 Mbps
    '1080p': 8,   // 8 Mbps
  };
  
  return bandwidths[quality] || 2.5;
}

/**
 * Sort qualities in ascending order (lowest to highest)
 */
export function sortQualitiesAscending(qualities: string[]): string[] {
  const order = ['360p', '480p', '720p', '1080p'];
  return qualities.sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    return indexA - indexB;
  });
}

/**
 * Sort qualities in descending order (highest to lowest)
 */
export function sortQualitiesDescending(qualities: string[]): string[] {
  return sortQualitiesAscending(qualities).reverse();
}

/**
 * Check if a quality is considered "high definition"
 */
export function isHDQuality(quality: string): boolean {
  return ['720p', '1080p'].includes(quality);
}

/**
 * Get the best quality that fits within a bandwidth limit
 */
export function getBestQualityForBandwidth(
  availableQualities: string[],
  maxBandwidth: number
): string {
  const sortedQualities = sortQualitiesDescending(availableQualities);
  
  for (const quality of sortedQualities) {
    if (getQualityBandwidth(quality) <= maxBandwidth) {
      return quality;
    }
  }
  
  // If no quality fits, return the lowest available
  return sortQualitiesAscending(availableQualities)[0] || '480p';
}

/**
 * Buffering management class for adaptive quality
 */
export class BufferingManager {
  private bufferingEvents: number[] = [];
  private readonly maxEvents = 10;
  private readonly timeWindow = 10000; // 10 seconds

  /**
   * Record a buffering event
   */
  recordBufferingEvent(): void {
    const now = Date.now();
    this.bufferingEvents.push(now);
    
    // Clean old events outside the time window
    this.bufferingEvents = this.bufferingEvents.filter(
      time => now - time <= this.timeWindow
    );
    
    // Keep only the most recent events
    if (this.bufferingEvents.length > this.maxEvents) {
      this.bufferingEvents = this.bufferingEvents.slice(-this.maxEvents);
    }
  }

  /**
   * Check if quality should be downgraded due to excessive buffering
   */
  shouldDowngradeQuality(): boolean {
    const now = Date.now();
    const recentEvents = this.bufferingEvents.filter(
      time => now - time <= this.timeWindow
    );
    
    // Downgrade if 3 or more buffering events in the last 10 seconds
    return recentEvents.length >= 3;
  }

  /**
   * Check if it's safe to upgrade quality (stable playback)
   */
  canUpgradeQuality(): boolean {
    const now = Date.now();
    const recentEvents = this.bufferingEvents.filter(
      time => now - time <= 10000 // Last 10 seconds
    );
    
    // Can upgrade if no buffering events in the last 10 seconds
    return recentEvents.length === 0;
  }

  /**
   * Reset buffering history (e.g., when quality changes)
   */
  reset(): void {
    this.bufferingEvents = [];
  }

  /**
   * Get buffering statistics
   */
  getStats(): { recentEvents: number; totalEvents: number } {
    const now = Date.now();
    const recentEvents = this.bufferingEvents.filter(
      time => now - time <= this.timeWindow
    ).length;
    
    return {
      recentEvents,
      totalEvents: this.bufferingEvents.length,
    };
  }
}