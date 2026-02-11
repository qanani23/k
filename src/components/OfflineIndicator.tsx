import { WifiOff, Download } from 'lucide-react';
import { useOffline } from '../hooks/useOffline';

interface OfflineIndicatorProps {
  showDownloadsLink?: boolean;
  onNavigateToDownloads?: () => void;
}

export default function OfflineIndicator({ 
  showDownloadsLink = true,
  onNavigateToDownloads 
}: OfflineIndicatorProps) {
  const { isOffline } = useOffline();

  if (!isOffline) return null;

  return (
    <div className="fixed top-16 left-0 right-0 bg-yellow-500/20 border-b border-yellow-500/30 backdrop-blur-sm z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-center gap-3 text-yellow-400">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm font-medium">
            Offline Mode - Only downloaded content is available
          </span>
          {showDownloadsLink && onNavigateToDownloads && (
            <>
              <span className="text-yellow-500/50">•</span>
              <button
                onClick={onNavigateToDownloads}
                className="text-sm font-medium hover:text-yellow-300 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                View Downloads
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
