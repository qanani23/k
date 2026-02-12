/**
 * PlayerAdapter Interface
 * 
 * Abstraction layer for video player implementations.
 * Allows separation between production (real Plyr + hls.js) and test (mock) environments.
 * 
 * Architecture:
 * - RealPlayerAdapter: Production implementation with Plyr + hls.js
 * - MockPlayerAdapter: Test implementation with simulated events
 * 
 * This ensures E2E tests validate UI logic without depending on browser media stack.
 */

export interface PlayerQuality {
  quality: string;
  label: string;
}

export interface PlayerEventHandlers {
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onQualityChange?: (quality: string) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onProgress?: (buffered: number) => void;
}

export interface PlayerAdapter {
  /**
   * Initialize the player with a video element
   */
  initialize(videoElement: HTMLVideoElement, handlers: PlayerEventHandlers): void;

  /**
   * Load a video source
   */
  loadSource(url: string, type: 'mp4' | 'hls'): Promise<void>;

  /**
   * Set available quality options
   */
  setQualities(qualities: PlayerQuality[]): void;

  /**
   * Change video quality
   */
  changeQuality(quality: string): Promise<void>;

  /**
   * Play the video
   */
  play(): Promise<void>;

  /**
   * Pause the video
   */
  pause(): void;

  /**
   * Seek to a specific time
   */
  seek(time: number): void;

  /**
   * Get current playback time
   */
  getCurrentTime(): number;

  /**
   * Get video duration
   */
  getDuration(): number;

  /**
   * Check if player is ready
   */
  isReady(): boolean;

  /**
   * Check if video is playing
   */
  isPlaying(): boolean;

  /**
   * Destroy the player instance
   */
  destroy(): void;

  /**
   * Get the underlying player instance (for advanced use)
   */
  getPlayerInstance(): any;
}

/**
 * Factory function to create appropriate player adapter based on environment
 */
export function createPlayerAdapter(): PlayerAdapter {
  // In test environment, use mock adapter
  if (import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_MOCK_PLAYER === 'true') {
    return new MockPlayerAdapter();
  }
  
  // In production, use real adapter
  return new RealPlayerAdapter();
}

/**
 * Mock Player Adapter for Testing
 * 
 * Simulates player behavior without real media playback.
 * Emits expected events so UI logic continues working.
 */
class MockPlayerAdapter implements PlayerAdapter {
  private videoElement: HTMLVideoElement | null = null;
  private handlers: PlayerEventHandlers = {};
  private mockContainer: HTMLDivElement | null = null;
  private currentTime = 0;
  private duration = 120; // Mock 2-minute video
  private playing = false;
  private ready = false;
  private qualities: PlayerQuality[] = [];
  private currentQuality = '';

  initialize(videoElement: HTMLVideoElement, handlers: PlayerEventHandlers): void {
    this.videoElement = videoElement;
    this.handlers = handlers;

    // Create mock player container
    this.mockContainer = document.createElement('div');
    this.mockContainer.setAttribute('data-testid', 'mock-player');
    this.mockContainer.style.width = '100%';
    this.mockContainer.style.height = '100%';
    this.mockContainer.style.backgroundColor = '#000';
    this.mockContainer.style.display = 'flex';
    this.mockContainer.style.alignItems = 'center';
    this.mockContainer.style.justifyContent = 'center';
    this.mockContainer.style.color = '#fff';
    this.mockContainer.textContent = 'Mock Player (Test Mode)';

    // Replace video element with mock container
    if (videoElement.parentNode) {
      videoElement.parentNode.insertBefore(this.mockContainer, videoElement);
      videoElement.style.display = 'none';
    }

    // Simulate ready state immediately
    setTimeout(() => {
      this.ready = true;
      this.handlers.onReady?.();
    }, 100);
  }

  async loadSource(url: string, type: 'mp4' | 'hls'): Promise<void> {
    // Simulate loading delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Mark as ready
    this.ready = true;
    this.handlers.onReady?.();
  }

  setQualities(qualities: PlayerQuality[]): void {
    this.qualities = qualities;
    if (qualities.length > 0 && !this.currentQuality) {
      this.currentQuality = qualities[0].quality;
    }
  }

  async changeQuality(quality: string): Promise<void> {
    const oldQuality = this.currentQuality;
    this.currentQuality = quality;
    
    // Simulate quality change delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    this.handlers.onQualityChange?.(quality);
  }

  async play(): Promise<void> {
    if (!this.ready) {
      throw new Error('Player not ready');
    }

    this.playing = true;
    this.handlers.onPlay?.();

    // Simulate time updates
    this.simulatePlayback();
  }

  pause(): void {
    this.playing = false;
    this.handlers.onPause?.();
  }

  seek(time: number): void {
    this.currentTime = Math.max(0, Math.min(time, this.duration));
    this.handlers.onTimeUpdate?.(this.currentTime);
  }

  getCurrentTime(): number {
    return this.currentTime;
  }

  getDuration(): number {
    return this.duration;
  }

  isReady(): boolean {
    return this.ready;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  destroy(): void {
    this.playing = false;
    this.ready = false;
    
    if (this.mockContainer && this.mockContainer.parentNode) {
      this.mockContainer.parentNode.removeChild(this.mockContainer);
    }
    
    if (this.videoElement) {
      this.videoElement.style.display = '';
    }
    
    this.mockContainer = null;
    this.videoElement = null;
    this.handlers = {};
  }

  getPlayerInstance(): any {
    return {
      mock: true,
      container: this.mockContainer,
    };
  }

  private simulatePlayback(): void {
    if (!this.playing) return;

    const interval = setInterval(() => {
      if (!this.playing) {
        clearInterval(interval);
        return;
      }

      this.currentTime += 0.1;
      
      if (this.currentTime >= this.duration) {
        this.currentTime = this.duration;
        this.playing = false;
        clearInterval(interval);
        this.handlers.onEnded?.();
      } else {
        this.handlers.onTimeUpdate?.(this.currentTime);
      }
    }, 100);
  }
}

/**
 * Real Player Adapter for Production
 * 
 * Uses Plyr + hls.js for actual video playback.
 * This is a placeholder - actual implementation will be in RealPlayerAdapter.ts
 */
class RealPlayerAdapter implements PlayerAdapter {
  private plyrInstance: any = null;
  private hlsInstance: any = null;
  private videoElement: HTMLVideoElement | null = null;
  private handlers: PlayerEventHandlers = {};
  private ready = false;

  initialize(videoElement: HTMLVideoElement, handlers: PlayerEventHandlers): void {
    this.videoElement = videoElement;
    this.handlers = handlers;
    
    // Actual Plyr initialization will be implemented in the real adapter
    // This is just a placeholder structure
    console.warn('RealPlayerAdapter: Use dedicated RealPlayerAdapter.ts for production');
  }

  async loadSource(url: string, type: 'mp4' | 'hls'): Promise<void> {
    throw new Error('RealPlayerAdapter: Not implemented - use RealPlayerAdapter.ts');
  }

  setQualities(qualities: PlayerQuality[]): void {
    // Implementation in RealPlayerAdapter.ts
  }

  async changeQuality(quality: string): Promise<void> {
    // Implementation in RealPlayerAdapter.ts
  }

  async play(): Promise<void> {
    // Implementation in RealPlayerAdapter.ts
  }

  pause(): void {
    // Implementation in RealPlayerAdapter.ts
  }

  seek(time: number): void {
    // Implementation in RealPlayerAdapter.ts
  }

  getCurrentTime(): number {
    return 0;
  }

  getDuration(): number {
    return 0;
  }

  isReady(): boolean {
    return this.ready;
  }

  isPlaying(): boolean {
    return false;
  }

  destroy(): void {
    // Implementation in RealPlayerAdapter.ts
  }

  getPlayerInstance(): any {
    return this.plyrInstance;
  }
}
