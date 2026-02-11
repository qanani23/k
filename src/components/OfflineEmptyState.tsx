import { WifiOff, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface OfflineEmptyStateProps {
  title?: string;
  message?: string;
  showDownloadsButton?: boolean;
}

export default function OfflineEmptyState({
  title = 'No Internet Connection',
  message = 'You are currently offline. Only downloaded content is available for viewing.',
  showDownloadsButton = true,
}: OfflineEmptyStateProps) {
  const navigate = useNavigate();

  return (
    <div className="glass rounded-xl p-12 text-center">
      <WifiOff className="w-16 h-16 text-text-secondary mx-auto mb-4" />
      <h3 className="text-xl font-medium text-text-primary mb-2">
        {title}
      </h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto">
        {message}
      </p>
      {showDownloadsButton && (
        <button
          onClick={() => navigate('/downloads')}
          className="btn-primary flex items-center gap-2 mx-auto"
          aria-label="View downloaded content"
        >
          <Download className="w-4 h-4" />
          View Downloaded Content
        </button>
      )}
    </div>
  );
}
