/**
 * Codec compatibility detection and HLS support utilities
 * Implements Requirement 18: Video Player Compatibility and Codec Handling
 */

import Hls from 'hls.js';
import { VideoUrl, CompatibilityInfo } from '../types';

/**
 * Check if HLS streams are supported (either natively or via hls.js)
 */
export function isHLSSupported(): boolean {
  // Check for hls.js support first
  if (Hls.isSupported()) {
    return true;
  }

  // Check for native HLS support (Safari)
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

/**
 * Check if MediaSource API is available (required for hls.js)
 */
export function isMediaSourceSupported(): boolean {
  return typeof window !== 'undefined' && 'MediaSource' in window;
}

/**
 * Test MP4 codec compatibility using canPlayType
 * Tests H.264 video codec with AAC audio codec
 */
export function isMP4CodecSupported(): boolean {
  const video = document.createElement('video');
  
  // Test H.264 video with AAC audio (most common format)
  const h264aac = video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
  
  // canPlayType returns '', 'maybe', or 'probably'
  // We accept both 'maybe' and 'probably' as supported
  return h264aac === 'probably' || h264aac === 'maybe';
}

/**
 * Test specific codec string compatibility
 */
export function testCodec(mimeType: string, codec?: string): boolean {
  const video = document.createElement('video');
  
  if (codec) {
    const fullType = `${mimeType}; codecs="${codec}"`;
    const result = video.canPlayType(fullType);
    return result === 'probably' || result === 'maybe';
  }
  
  const result = video.canPlayType(mimeType);
  return result === 'probably' || result === 'maybe';
}

/**
 * Check compatibility for a specific video URL
 */
export function checkVideoUrlCompatibility(videoUrl: VideoUrl): CompatibilityInfo {
  if (videoUrl.type === 'hls') {
    // Check HLS support
    const hlsSupported = isHLSSupported();
    
    if (!hlsSupported) {
      return {
        compatible: false,
        reason: 'HLS streams are not supported on this platform',
        fallback_available: true
      };
    }
    
    return {
      compatible: true,
      fallback_available: true
    };
  }
  
  if (videoUrl.type === 'mp4') {
    // Check MP4 codec support
    if (videoUrl.codec) {
      const codecSupported = testCodec('video/mp4', videoUrl.codec);
      
      if (!codecSupported) {
        return {
          compatible: false,
          reason: `Video codec ${videoUrl.codec} is not supported on this platform`,
          fallback_available: true
        };
      }
    } else {
      // No specific codec provided, test general H.264/AAC support
      const mp4Supported = isMP4CodecSupported();
      
      if (!mp4Supported) {
        return {
          compatible: false,
          reason: 'MP4 video format is not supported on this platform',
          fallback_available: true
        };
      }
    }
    
    return {
      compatible: true,
      fallback_available: true
    };
  }
  
  // Unknown type
  return {
    compatible: false,
    reason: 'Unknown video format',
    fallback_available: true
  };
}

/**
 * Check compatibility for all video URLs and return overall compatibility
 * Prioritizes MP4 over HLS when both are available and compatible
 */
export function checkContentCompatibility(
  videoUrls: Record<string, VideoUrl>
): CompatibilityInfo {
  const urls = Object.values(videoUrls);
  
  if (urls.length === 0) {
    return {
      compatible: false,
      reason: 'No video URLs available',
      fallback_available: false
    };
  }
  
  // Check if any MP4 URLs are compatible (preferred)
  const mp4Urls = urls.filter(url => url.type === 'mp4');
  for (const url of mp4Urls) {
    const compat = checkVideoUrlCompatibility(url);
    if (compat.compatible) {
      return {
        compatible: true,
        fallback_available: true
      };
    }
  }
  
  // Check if any HLS URLs are compatible (fallback)
  const hlsUrls = urls.filter(url => url.type === 'hls');
  for (const url of hlsUrls) {
    const compat = checkVideoUrlCompatibility(url);
    if (compat.compatible) {
      return {
        compatible: true,
        fallback_available: true
      };
    }
  }
  
  // No compatible formats found
  const firstUrl = urls[0];
  const firstCompat = checkVideoUrlCompatibility(firstUrl);
  
  return {
    compatible: false,
    reason: firstCompat.reason || 'This video may not play on your platform',
    fallback_available: true
  };
}

/**
 * Get the best compatible video URL for a given quality
 * Prioritizes MP4 over HLS when both are available and compatible
 */
export function getBestCompatibleUrl(
  videoUrls: Record<string, VideoUrl>,
  quality: string
): VideoUrl | null {
  const url = videoUrls[quality];
  
  if (!url) {
    return null;
  }
  
  // If the requested quality URL is compatible, use it
  const compat = checkVideoUrlCompatibility(url);
  if (compat.compatible) {
    return url;
  }
  
  // If not compatible, try to find an alternative
  // Prefer MP4 over HLS
  const allUrls = Object.values(videoUrls);
  const mp4Urls = allUrls.filter(u => u.type === 'mp4');
  
  for (const mp4Url of mp4Urls) {
    const mp4Compat = checkVideoUrlCompatibility(mp4Url);
    if (mp4Compat.compatible) {
      return mp4Url;
    }
  }
  
  // Try HLS as last resort
  const hlsUrls = allUrls.filter(u => u.type === 'hls');
  for (const hlsUrl of hlsUrls) {
    const hlsCompat = checkVideoUrlCompatibility(hlsUrl);
    if (hlsCompat.compatible) {
      return hlsUrl;
    }
  }
  
  // No compatible URL found, return the original
  return url;
}

/**
 * Get platform-specific compatibility information for diagnostics
 */
export function getPlatformCompatibilityInfo(): {
  hlsSupported: boolean;
  hlsJsSupported: boolean;
  nativeHlsSupported: boolean;
  mediaSourceSupported: boolean;
  mp4CodecSupported: boolean;
  userAgent: string;
} {
  const video = document.createElement('video');
  
  return {
    hlsSupported: isHLSSupported(),
    hlsJsSupported: Hls.isSupported(),
    nativeHlsSupported: video.canPlayType('application/vnd.apple.mpegurl') !== '',
    mediaSourceSupported: isMediaSourceSupported(),
    mp4CodecSupported: isMP4CodecSupported(),
    userAgent: navigator.userAgent
  };
}
