import { describe, it, expect } from 'vitest';
import { 
  chooseInitialQuality, 
  getNextLowerQuality, 
  getNextHigherQuality,
  shouldUpgradeQuality,
  BufferingManager 
} from '../../src/lib/quality';

describe('Quality Selection', () => {
  describe('chooseInitialQuality', () => {
    it('should return last used quality if available', () => {
      const result = chooseInitialQuality({
        availableQualities: ['480p', '720p', '1080p'],
        lastUsedQuality: '720p',
        networkSpeed: 'medium'
      });
      
      expect(result).toBe('720p');
    });

    it('should select quality based on network speed', () => {
      // High speed should prefer 1080p
      const highSpeed = chooseInitialQuality({
        availableQualities: ['480p', '720p', '1080p'],
        networkSpeed: 'fast'
      });
      expect(highSpeed).toBe('1080p');

      // Medium speed should prefer 720p
      const mediumSpeed = chooseInitialQuality({
        availableQualities: ['480p', '720p', '1080p'],
        networkSpeed: 'medium'
      });
      expect(mediumSpeed).toBe('720p');

      // Low speed should prefer 480p
      const lowSpeed = chooseInitialQuality({
        availableQualities: ['480p', '720p', '1080p'],
        networkSpeed: 'slow'
      });
      expect(lowSpeed).toBe('480p');
    });

    it('should fallback to available qualities when preferred is not available', () => {
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p'],
        networkSpeed: 'fast' // High speed but no HD available
      });
      expect(result).toBe('480p'); // Highest available
    });

    it('should handle empty qualities array', () => {
      const result = chooseInitialQuality({
        availableQualities: [],
        networkSpeed: 'medium'
      });
      expect(result).toBe('480p'); // Fallback
    });
  });

  describe('getNextLowerQuality', () => {
    it('should return next lower quality', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      expect(getNextLowerQuality('1080p', availableQualities)).toBe('720p');
      expect(getNextLowerQuality('720p', availableQualities)).toBe('480p');
      expect(getNextLowerQuality('480p', availableQualities)).toBe('360p');
    });

    it('should return null when already at lowest quality', () => {
      const availableQualities = ['360p', '480p', '720p'];
      expect(getNextLowerQuality('360p', availableQualities)).toBeNull();
    });

    it('should skip unavailable qualities', () => {
      const availableQualities = ['360p', '720p', '1080p']; // Missing 480p
      expect(getNextLowerQuality('720p', availableQualities)).toBe('360p');
    });
  });

  describe('getNextHigherQuality', () => {
    it('should return next higher quality', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      expect(getNextHigherQuality('360p', availableQualities)).toBe('480p');
      expect(getNextHigherQuality('480p', availableQualities)).toBe('720p');
      expect(getNextHigherQuality('720p', availableQualities)).toBe('1080p');
    });

    it('should return null when already at highest quality', () => {
      const availableQualities = ['360p', '480p', '1080p'];
      expect(getNextHigherQuality('1080p', availableQualities)).toBeNull();
    });
  });

  describe('shouldUpgradeQuality', () => {
    it('should recommend upgrade when network speed is sufficient', () => {
      expect(shouldUpgradeQuality('480p', ['480p', '720p'], 4)).toBe(true);
      expect(shouldUpgradeQuality('720p', ['720p', '1080p'], 8)).toBe(true);
    });

    it('should not recommend upgrade when network speed is insufficient', () => {
      expect(shouldUpgradeQuality('480p', ['480p', '720p'], 2)).toBe(false);
      expect(shouldUpgradeQuality('720p', ['720p', '1080p'], 4)).toBe(false);
    });

    it('should not recommend upgrade when already at highest quality', () => {
      expect(shouldUpgradeQuality('1080p', ['720p', '1080p'], 10)).toBe(false);
    });
  });
});

describe('BufferingManager', () => {
  it('should track buffering events', () => {
    const manager = new BufferingManager();
    
    manager.recordBufferingEvent();
    manager.recordBufferingEvent();
    
    const stats = manager.getStats();
    expect(stats.totalEvents).toBe(2);
    expect(stats.recentEvents).toBe(2);
  });

  it('should recommend downgrade after multiple buffering events', () => {
    const manager = new BufferingManager();
    
    // Record 3 buffering events (threshold for downgrade)
    manager.recordBufferingEvent();
    manager.recordBufferingEvent();
    manager.recordBufferingEvent();
    
    expect(manager.shouldDowngradeQuality()).toBe(true);
  });

  it('should allow upgrade after stable playback', () => {
    const manager = new BufferingManager();
    
    // Initially no buffering events
    expect(manager.canUpgradeQuality()).toBe(true);
    
    // After buffering events
    manager.recordBufferingEvent();
    expect(manager.canUpgradeQuality()).toBe(false);
  });

  it('should reset buffering history', () => {
    const manager = new BufferingManager();
    
    manager.recordBufferingEvent();
    manager.recordBufferingEvent();
    
    manager.reset();
    
    const stats = manager.getStats();
    expect(stats.totalEvents).toBe(0);
    expect(stats.recentEvents).toBe(0);
  });
});

describe('Quality Selection with Simulated Network Conditions', () => {
  describe('Network Speed Simulation', () => {
    it('should select 1080p for high-speed connections (>= 5 Mbps)', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Simulate various high-speed scenarios
      const highSpeeds = [5, 7, 10, 15, 20, 50, 100];
      
      highSpeeds.forEach(speed => {
        const result = chooseInitialQuality({
          availableQualities,
          networkSpeed: speed as any
        });
        expect(result).toBe('1080p');
      });
    });

    it('should select 720p for medium-speed connections (2-5 Mbps)', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Simulate medium-speed scenarios
      const mediumSpeeds = [2, 2.5, 3, 3.5, 4, 4.5, 4.9];
      
      mediumSpeeds.forEach(speed => {
        const result = chooseInitialQuality({
          availableQualities,
          networkSpeed: speed as any
        });
        expect(result).toBe('720p');
      });
    });

    it('should select 480p for low-speed connections (< 2 Mbps)', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Simulate low-speed scenarios
      const lowSpeeds = [0.5, 1, 1.5, 1.9];
      
      lowSpeeds.forEach(speed => {
        const result = chooseInitialQuality({
          availableQualities,
          networkSpeed: speed as any
        });
        expect(result).toBe('480p');
      });
    });

    it('should handle edge case speeds at boundaries', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Exactly at boundary: 5 Mbps should select 1080p
      expect(chooseInitialQuality({
        availableQualities,
        networkSpeed: 5 as any
      })).toBe('1080p');
      
      // Just below boundary: 4.99 Mbps should select 720p
      expect(chooseInitialQuality({
        availableQualities,
        networkSpeed: 4.99 as any
      })).toBe('720p');
      
      // Exactly at boundary: 2 Mbps should select 720p
      expect(chooseInitialQuality({
        availableQualities,
        networkSpeed: 2 as any
      })).toBe('720p');
      
      // Just below boundary: 1.99 Mbps should select 480p
      expect(chooseInitialQuality({
        availableQualities,
        networkSpeed: 1.99 as any
      })).toBe('480p');
    });

    it('should handle extremely slow connections', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Very slow connections
      const extremelySlow = [0.1, 0.25, 0.5];
      
      extremelySlow.forEach(speed => {
        const result = chooseInitialQuality({
          availableQualities,
          networkSpeed: speed as any
        });
        expect(result).toBe('480p');
      });
    });

    it('should handle extremely fast connections', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Very fast connections
      const extremelyFast = [100, 500, 1000];
      
      extremelyFast.forEach(speed => {
        const result = chooseInitialQuality({
          availableQualities,
          networkSpeed: speed as any
        });
        expect(result).toBe('1080p');
      });
    });
  });

  describe('Limited Quality Availability with Network Conditions', () => {
    it('should select best available quality when preferred is unavailable (high speed)', () => {
      // High speed but only SD qualities available
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p'],
        networkSpeed: 10 as any
      });
      expect(result).toBe('480p'); // Highest available
    });

    it('should select best available quality when preferred is unavailable (medium speed)', () => {
      // Medium speed but 720p not available
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p', '1080p'],
        networkSpeed: 3 as any
      });
      expect(result).toBe('480p'); // Falls back to 480p since 720p missing
    });

    it('should select lowest available for slow connections with limited options', () => {
      // Slow connection with only HD qualities
      const result = chooseInitialQuality({
        availableQualities: ['720p', '1080p'],
        networkSpeed: 1 as any
      });
      expect(result).toBe('720p'); // Lowest available
    });

    it('should handle single quality option regardless of speed', () => {
      const singleQuality = ['720p'];
      
      expect(chooseInitialQuality({
        availableQualities: singleQuality,
        networkSpeed: 0.5 as any
      })).toBe('720p');
      
      expect(chooseInitialQuality({
        availableQualities: singleQuality,
        networkSpeed: 10 as any
      })).toBe('720p');
    });
  });

  describe('Network Degradation Scenarios', () => {
    it('should recommend downgrade when network degrades during playback', () => {
      const manager = new BufferingManager();
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Start with high quality
      let currentQuality = '1080p';
      
      // Simulate network degradation causing buffering
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      // Should recommend downgrade
      expect(manager.shouldDowngradeQuality()).toBe(true);
      
      // Downgrade quality
      const nextQuality = getNextLowerQuality(currentQuality, availableQualities);
      expect(nextQuality).toBe('720p');
      currentQuality = nextQuality!;
      
      // Reset after quality change
      manager.reset();
      
      // If buffering continues, downgrade again
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      expect(manager.shouldDowngradeQuality()).toBe(true);
      const finalQuality = getNextLowerQuality(currentQuality, availableQualities);
      expect(finalQuality).toBe('480p');
    });

    it('should handle rapid network fluctuations', () => {
      const manager = new BufferingManager();
      
      // Simulate rapid buffering events
      for (let i = 0; i < 5; i++) {
        manager.recordBufferingEvent();
      }
      
      expect(manager.shouldDowngradeQuality()).toBe(true);
      
      const stats = manager.getStats();
      expect(stats.recentEvents).toBeGreaterThanOrEqual(3);
    });

    it('should allow upgrade when network improves and playback stabilizes', () => {
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      let currentQuality = '480p';
      
      // Simulate improved network conditions
      const improvedSpeed = 8; // High speed
      
      // Check if upgrade is recommended
      const shouldUpgrade = shouldUpgradeQuality(currentQuality, availableQualities, improvedSpeed);
      expect(shouldUpgrade).toBe(true);
      
      // Get next higher quality
      const nextQuality = getNextHigherQuality(currentQuality, availableQualities);
      expect(nextQuality).toBe('720p');
    });
  });

  describe('User Preference Override with Network Conditions', () => {
    it('should respect user preference even on slow connections', () => {
      // User prefers 1080p despite slow connection
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p', '720p', '1080p'],
        lastUsedQuality: '1080p',
        networkSpeed: 1 as any // Very slow
      });
      expect(result).toBe('1080p');
    });

    it('should respect user preference even on fast connections', () => {
      // User prefers 480p despite fast connection
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p', '720p', '1080p'],
        lastUsedQuality: '480p',
        networkSpeed: 20 as any // Very fast
      });
      expect(result).toBe('480p');
    });

    it('should fallback to network-based selection when preference unavailable', () => {
      // User prefers 720p but it's not available
      const result = chooseInitialQuality({
        availableQualities: ['360p', '480p', '1080p'],
        lastUsedQuality: '720p',
        networkSpeed: 10 as any
      });
      expect(result).toBe('1080p'); // Network-based selection
    });
  });

  describe('Adaptive Quality Upgrade Scenarios', () => {
    it('should recommend upgrade from 480p to 720p with sufficient bandwidth', () => {
      const availableQualities = ['480p', '720p', '1080p'];
      const currentQuality = '480p';
      const goodSpeed = 4; // Above 3 Mbps threshold
      
      expect(shouldUpgradeQuality(currentQuality, availableQualities, goodSpeed)).toBe(true);
    });

    it('should not recommend upgrade from 480p to 720p with insufficient bandwidth', () => {
      const availableQualities = ['480p', '720p', '1080p'];
      const currentQuality = '480p';
      const poorSpeed = 2; // Below 3 Mbps threshold
      
      expect(shouldUpgradeQuality(currentQuality, availableQualities, poorSpeed)).toBe(false);
    });

    it('should recommend upgrade from 720p to 1080p with sufficient bandwidth', () => {
      const availableQualities = ['480p', '720p', '1080p'];
      const currentQuality = '720p';
      const excellentSpeed = 8; // Above 6 Mbps threshold
      
      expect(shouldUpgradeQuality(currentQuality, availableQualities, excellentSpeed)).toBe(true);
    });

    it('should not recommend upgrade from 720p to 1080p with insufficient bandwidth', () => {
      const availableQualities = ['480p', '720p', '1080p'];
      const currentQuality = '720p';
      const moderateSpeed = 5; // Below 6 Mbps threshold
      
      expect(shouldUpgradeQuality(currentQuality, availableQualities, moderateSpeed)).toBe(false);
    });

    it('should not recommend upgrade when already at highest available quality', () => {
      const availableQualities = ['480p', '720p'];
      const currentQuality = '720p';
      const excellentSpeed = 20;
      
      expect(shouldUpgradeQuality(currentQuality, availableQualities, excellentSpeed)).toBe(false);
    });
  });

  describe('Buffering Manager with Time-Based Events', () => {
    it('should only count recent buffering events within time window', async () => {
      const manager = new BufferingManager();
      
      // Record events
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      // Wait a bit (simulated by checking stats immediately)
      const stats = manager.getStats();
      expect(stats.recentEvents).toBe(2);
      
      // All events should be recent since they just happened
      expect(stats.totalEvents).toBe(2);
    });

    it('should not recommend downgrade with only 2 buffering events', () => {
      const manager = new BufferingManager();
      
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      // Should not downgrade with only 2 events (threshold is 3)
      expect(manager.shouldDowngradeQuality()).toBe(false);
    });

    it('should recommend downgrade with exactly 3 buffering events', () => {
      const manager = new BufferingManager();
      
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      // Should downgrade with 3 events (at threshold)
      expect(manager.shouldDowngradeQuality()).toBe(true);
    });

    it('should recommend downgrade with more than 3 buffering events', () => {
      const manager = new BufferingManager();
      
      for (let i = 0; i < 5; i++) {
        manager.recordBufferingEvent();
      }
      
      // Should definitely downgrade with 5 events
      expect(manager.shouldDowngradeQuality()).toBe(true);
    });
  });

  describe('Complete Adaptive Quality Workflow', () => {
    it('should handle complete quality adaptation cycle', () => {
      const manager = new BufferingManager();
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      
      // Start with high quality on fast network
      let currentQuality = chooseInitialQuality({
        availableQualities,
        networkSpeed: 10 as any
      });
      expect(currentQuality).toBe('1080p');
      
      // Network degrades, causing buffering
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      // Should downgrade
      expect(manager.shouldDowngradeQuality()).toBe(true);
      currentQuality = getNextLowerQuality(currentQuality, availableQualities)!;
      expect(currentQuality).toBe('720p');
      manager.reset();
      
      // Playback stabilizes
      expect(manager.canUpgradeQuality()).toBe(true);
      
      // Network improves
      const canUpgrade = shouldUpgradeQuality(currentQuality, availableQualities, 8);
      expect(canUpgrade).toBe(true);
      
      // Upgrade back to higher quality
      currentQuality = getNextHigherQuality(currentQuality, availableQualities)!;
      expect(currentQuality).toBe('1080p');
    });

    it('should handle worst-case degradation to lowest quality', () => {
      const manager = new BufferingManager();
      const availableQualities = ['360p', '480p', '720p', '1080p'];
      let currentQuality = '1080p';
      
      // Repeatedly degrade due to poor network
      const degradationSteps = [
        { from: '1080p', to: '720p' },
        { from: '720p', to: '480p' },
        { from: '480p', to: '360p' },
      ];
      
      degradationSteps.forEach(step => {
        // Simulate buffering
        manager.recordBufferingEvent();
        manager.recordBufferingEvent();
        manager.recordBufferingEvent();
        
        expect(manager.shouldDowngradeQuality()).toBe(true);
        expect(currentQuality).toBe(step.from);
        
        const nextQuality = getNextLowerQuality(currentQuality, availableQualities);
        expect(nextQuality).toBe(step.to);
        currentQuality = nextQuality!;
        
        manager.reset();
      });
      
      // At lowest quality, no further downgrade possible
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      manager.recordBufferingEvent();
      
      expect(manager.shouldDowngradeQuality()).toBe(true);
      const noLower = getNextLowerQuality(currentQuality, availableQualities);
      expect(noLower).toBeNull();
    });
  });
});