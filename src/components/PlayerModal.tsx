import { useEffect, useRef, useState, useCallback } from 'react';
import * as PlyrNamespace from 'plyr';
import Hls from 'hls.js';
import { X, Settings, AlertCircle, ExternalLink } from 'lucide-react';
import { ContentItem, Quality, QUALITY_LEVELS } from '../types';
import { saveProgress, getProgress, streamOffline, openExternal } from '../lib/api';
import { nextLowerQuality, qualityScore } from '../types';
import { scheduleIdleTask } from '../lib/idle';
import { checkContentCompatibility, isHLSSupported, isMP4CodecSupported } from '../lib/codec';
import 'plyr/dist/plyr.css';

// Handle Plyr import for both CommonJS and ES modules
const Plyr = (PlyrNamespace as any).default || PlyrNamespace;

interface PlayerModalProps {
  content: ContentItem;
  isOpen: boolean;
  onClose: () => void;
  initialQuality?: string;
  isOffline?: boolean;
}

export default function PlayerModal({
  content,
  isOpen,
  onClose,
  initialQuality,
  isOffline = false
}: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Plyr | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bufferingCountRef = useRef<number>(0);
  const bufferingWindowRef = useRef<number>(Date.now());
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  
  // CDN Playback: Default to "master" quality for HLS adaptive streaming
  const [currentQuality, setCurrentQuality] = useState<string>(initialQuality || 'master');
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [isBuffering, setIsBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [compatibilityWarning, setCompatibilityWarning] = useState<string | null>(null);
  
  const currentQualityRef = useRef<string>(currentQuality);

  // Update ref when currentQuality changes
  useEffect(() => {
    currentQualityRef.current = currentQuality;
  }, [currentQuality]);

  // Handle buffering and auto quality downgrade
  const handleBuffering = useCallback(() => {
    const now = Date.now();
    const timeSinceWindowStart = now - bufferingWindowRef.current;

    // Reset window if more than 10 seconds have passed
    if (timeSinceWindowStart > 10000) {
      bufferingCountRef.current = 0;
      bufferingWindowRef.current = now;
    }

    bufferingCountRef.current += 1;

    // If buffering 3+ times in 10 seconds, downgrade quality
    if (bufferingCountRef.current >= 3) {
      const lowerQuality = nextLowerQuality(currentQualityRef.current as Quality);
      
      if (lowerQuality) {
        console.log(`Auto-downgrading quality from ${currentQualityRef.current} to ${lowerQuality}`);
        setCurrentQuality(lowerQuality);
        bufferingCountRef.current = 0;
        bufferingWindowRef.current = Date.now();
        
        // Show notification
        setError(`Quality downgraded to ${lowerQuality} due to buffering`);
        setTimeout(() => setError(null), 3000);
      }
    }
  }, []); // No dependencies - uses refs instead

  // Check compatibility
  useEffect(() => {
    // Check content compatibility using codec utilities
    const compatibility = checkContentCompatibility(content.video_urls);
    
    if (!compatibility.compatible) {
      setCompatibilityWarning(
        compatibility.reason || 
        'This video may not play on your platform'
      );
    } else {
      setCompatibilityWarning(null);
    }
  }, [content]);

  // Get available qualities
  useEffect(() => {
    const qualities = Object.keys(content.video_urls)
      .filter(q => QUALITY_LEVELS.includes(q as Quality) || q === 'master')
      .sort((a, b) => {
        // Prioritize 'master' quality for HLS adaptive streaming
        if (a === 'master') return -1;
        if (b === 'master') return 1;
        return qualityScore(b as Quality) - qualityScore(a as Quality);
      });
    
    setAvailableQualities(qualities);
    
    // Set initial quality if not provided
    if (!initialQuality && qualities.length > 0) {
      // CDN Playback: Default to 'master' if available, otherwise highest quality
      const defaultQuality = qualities.includes('master') ? 'master' : 
                            qualities.includes('720p') ? '720p' : qualities[0];
      setCurrentQuality(defaultQuality);
    }
  }, [content, initialQuality]);

  // Load saved progress
  useEffect(() => {
    if (!isOpen) return;

    const loadProgress = async () => {
      try {
        const progress = await getProgress(content.claim_id);
        if (progress && videoRef.current) {
          videoRef.current.currentTime = progress.position_seconds;
        }
      } catch (err) {
        console.error('Failed to load progress:', err);
      }
    };

    loadProgress();
  }, [isOpen, content.claim_id]);

  // Initialize player
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const initPlayer = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get video URL
        let videoUrl: string;
        
        if (isOffline) {
          // Get offline URL from local server
          const response = await streamOffline({
            claim_id: content.claim_id,
            quality: currentQuality
          });
          videoUrl = response.url;
        } else {
          // Get online URL
          const videoData = content.video_urls[currentQuality];
          if (!videoData) {
            throw new Error(`Quality ${currentQuality} not available`);
          }
          videoUrl = videoData.url;
        }

        // Check if HLS stream
        const isHls = videoUrl.includes('.m3u8') || content.video_urls[currentQuality]?.type === 'hls';

        if (isHls && Hls.isSupported()) {
          // Use hls.js for HLS streams
          if (hlsRef.current) {
            hlsRef.current.destroy();
          }

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 90
          });

          hls.loadSource(videoUrl);
          
          if (videoRef.current) {
            hls.attachMedia(videoRef.current);
          }

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            setIsLoading(false);
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  setError('Network error occurred. Please check your connection.');
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  setError('Media error occurred. Trying to recover...');
                  hls.recoverMediaError();
                  break;
                default:
                  setError('Fatal error occurred during playback.');
                  break;
              }
            }
          });

          hlsRef.current = hls;
        } else if (isHls && videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          videoRef.current.src = videoUrl;
          setIsLoading(false);
        } else if (isHls && !isHLSSupported()) {
          // HLS not supported at all
          setError('HLS streams are not supported on this platform. Please try using an external player.');
          setCompatibilityWarning('HLS streams are not supported on this platform');
          setIsLoading(false);
        } else if (videoRef.current) {
          // Regular MP4 stream - check codec compatibility
          const videoData = content.video_urls[currentQuality];
          if (videoData?.type === 'mp4' && !isMP4CodecSupported()) {
            setError('MP4 codec not supported on this platform. Please try using an external player.');
            setCompatibilityWarning('MP4 video format is not supported on this platform');
          }
          
          videoRef.current.src = videoUrl;
          setIsLoading(false);
        }

        // Initialize Plyr
        if (!playerRef.current && videoRef.current) {
          const player = new Plyr(videoRef.current, {
            controls: [
              'play-large',
              'play',
              'progress',
              'current-time',
              'duration',
              'mute',
              'volume',
              'settings',
              'fullscreen'
            ],
            settings: ['quality', 'speed'],
            quality: {
              default: parseInt(currentQuality.replace('p', '')),
              options: availableQualities.map(q => parseInt(q.replace('p', '')))
            },
            speed: {
              selected: 1,
              options: [0.5, 0.75, 1, 1.25, 1.5, 2]
            },
            keyboard: { focused: true, global: true },
            tooltips: { controls: true, seek: true }
          });

          playerRef.current = player;

          // Handle buffering
          player.on('waiting', () => {
            setIsBuffering(true);
            handleBuffering();
          });

          player.on('playing', () => {
            setIsBuffering(false);
          });

          player.on('error', (event: any) => {
            console.error('Plyr error:', event);
            setError('Playback error occurred. Please try a different quality.');
          });

          // Also attach waiting listener directly to video element for testing
          if (videoRef.current) {
            videoRef.current.addEventListener('waiting', handleBuffering);
          }
        }

      } catch (err) {
        console.error('Failed to initialize player:', err);
        setError(err instanceof Error ? err.message : 'Failed to load video');
        setIsLoading(false);
      }
    };

    initPlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // Clean up video event listener
      if (videoRef.current) {
        videoRef.current.removeEventListener('waiting', handleBuffering);
      }
    };
  }, [isOpen, currentQuality, content, isOffline, availableQualities]); // Removed handleBuffering from dependencies

  // Save progress periodically
  useEffect(() => {
    if (!isOpen || !videoRef.current) return;

    const saveProgressPeriodically = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const position = Math.floor(videoRef.current.currentTime);
        
        // Use requestIdleCallback for non-critical background progress saving
        scheduleIdleTask(() => {
          saveProgress({
            claim_id: content.claim_id,
            position_seconds: position,
            quality: currentQuality
          }).catch(err => {
            console.error('Failed to save progress:', err);
          });
        }, { timeout: 2000 }); // 2 second timeout to ensure it runs
      }
    };

    // Save every 20 seconds
    progressIntervalRef.current = setInterval(saveProgressPeriodically, 20000);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      // Save progress one last time on unmount
      // Use immediate save for final progress (not idle) to ensure it's captured
      if (videoRef.current) {
        const position = Math.floor(videoRef.current.currentTime);
        saveProgress({
          claim_id: content.claim_id,
          position_seconds: position,
          quality: currentQuality
        }).catch(err => {
          console.error('Failed to save final progress:', err);
        });
      }
    };
  }, [isOpen, content.claim_id, currentQuality]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
  }, [isOpen]);

  // Handle quality change
  const handleQualityChange = (quality: string) => {
    setCurrentQuality(quality);
    setShowQualityMenu(false);
    bufferingCountRef.current = 0;
    bufferingWindowRef.current = Date.now();
  };

  // Handle keyboard navigation for quality menu
  const handleQualityMenuKeyDown = (e: React.KeyboardEvent, quality: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleQualityChange(quality);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setShowQualityMenu(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const currentIndex = availableQualities.indexOf(quality);
      const nextIndex = e.key === 'ArrowDown' 
        ? (currentIndex + 1) % availableQualities.length
        : currentIndex <= 0 ? availableQualities.length - 1 : currentIndex - 1;
      
      // Focus the next quality button
      const nextButton = document.querySelector(`[data-quality="${availableQualities[nextIndex]}"]`) as HTMLButtonElement;
      nextButton?.focus();
    }
  };

  // Handle external player
  const handleExternalPlayer = async () => {
    try {
      const videoData = content.video_urls[currentQuality];
      if (videoData) {
        await openExternal(videoData.url);
      }
    } catch (err) {
      console.error('Failed to open external player:', err);
    }
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus management: trap focus within modal and restore on close
  useEffect(() => {
    if (!isOpen) return;

    // Store the previously focused element
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Focus the close button when modal opens
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 100);

    // Focus trap: keep focus within modal
    const handleFocusTrap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: moving backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab: moving forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleFocusTrap);

    // Cleanup: restore focus to previous element
    return () => {
      document.removeEventListener('keydown', handleFocusTrap);
      
      // Restore focus when modal closes
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="player-modal-title"
    >
      <div 
        ref={modalRef}
        className="relative w-full max-w-6xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors"
          aria-label="Close player"
        >
          <X className="w-8 h-8" />
        </button>

        {/* Title */}
        <div className="mb-4">
          <h2 id="player-modal-title" className="text-2xl font-bold text-white">{content.title}</h2>
          {content.description && (
            <p className="text-gray-400 mt-1 line-clamp-2">{content.description}</p>
          )}
        </div>

        {/* Compatibility Warning */}
        {compatibilityWarning && (
          <div className="mb-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-200 font-medium">Compatibility Warning</p>
              <p className="text-yellow-300/80 text-sm mt-1">{compatibilityWarning}</p>
              <button
                onClick={handleExternalPlayer}
                className="mt-2 text-sm text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition-colors"
                aria-label="Play video in external player"
              >
                <ExternalLink className="w-4 h-4" />
                Play via external player
              </button>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-4 bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-200 font-medium">Playback Error</p>
              <p className="text-red-300/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Video Player */}
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            playsInline
            crossOrigin="anonymous"
          />

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Loading video...</p>
              </div>
            </div>
          )}

          {/* Buffering Indicator */}
          {isBuffering && !isLoading && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded-lg text-sm">
              Buffering...
            </div>
          )}
        </div>

        {/* Quality Selector */}
        {/* CDN Playback: Hide quality selector if only "master" quality available (HLS adaptive) */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {availableQualities.length > 1 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
                  aria-label="Select video quality"
                  aria-expanded={showQualityMenu}
                  aria-haspopup="menu"
                >
                  <Settings className="w-4 h-4" />
                  <span>Quality: {currentQuality}</span>
                </button>

                {/* Quality Menu */}
                {showQualityMenu && (
                  <div className="absolute bottom-full mb-2 left-0 bg-gray-900 border border-gray-700 rounded-lg overflow-hidden min-w-[150px]" role="menu">
                    {availableQualities.map((quality) => (
                      <button
                        key={quality}
                        data-quality={quality}
                        onClick={() => handleQualityChange(quality)}
                        onKeyDown={(e) => handleQualityMenuKeyDown(e, quality)}
                        className={`w-full text-left px-4 py-2 hover:bg-white/10 transition-colors ${
                          quality === currentQuality ? 'bg-white/20 text-white' : 'text-gray-300'
                        }`}
                        role="menuitem"
                        aria-label={`Select ${quality} quality`}
                        aria-current={quality === currentQuality}
                      >
                        {quality}
                        {quality === currentQuality && ' ✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isOffline && (
              <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-sm">
                Playing offline
              </div>
            )}
          </div>

          {/* External Player Button */}
          {!isOffline && (
            <button
              onClick={handleExternalPlayer}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors"
              aria-label="Open in external player"
            >
              <ExternalLink className="w-4 h-4" />
              <span>External Player</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
