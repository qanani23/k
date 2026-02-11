import { Download, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ForcedUpdateScreenProps {
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  onUpdate: () => void;
  onExit: () => void;
}

const ForcedUpdateScreen = ({ 
  latestVersion, 
  releaseNotes, 
  downloadUrl, 
  onUpdate, 
  onExit 
}: ForcedUpdateScreenProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const updateButtonRef = useRef<HTMLButtonElement>(null);

  const handleUpdate = () => {
    // Open download URL in external browser
    window.open(downloadUrl, '_blank');
    onUpdate();
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'update' | 'exit') => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (action === 'update') {
        handleUpdate();
      } else {
        onExit();
      }
    }
  };

  // Focus management: trap focus within modal
  useEffect(() => {
    // Focus the update button when modal opens
    setTimeout(() => {
      updateButtonRef.current?.focus();
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

    return () => {
      document.removeEventListener('keydown', handleFocusTrap);
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forced-update-title"
    >
      <div ref={modalRef} className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Download className="w-8 h-8 text-white" />
          </div>
          <h1 id="forced-update-title" className="text-2xl font-bold text-white mb-2">Update Required</h1>
          <p className="text-slate-400">
            A new version of Kiyya is available and required to continue.
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">
              Version {latestVersion}
            </h2>
            <div className="text-sm text-slate-300 max-h-32 overflow-y-auto">
              {releaseNotes.split('\n').map((line, index) => (
                <p key={index} className="mb-1">
                  {line}
                </p>
              ))}
            </div>
          </div>
          
          <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-3">
            <p className="text-yellow-200 text-sm">
              ⚠️ This update is required for security and compatibility. 
              The application cannot continue without updating.
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            ref={updateButtonRef}
            onClick={handleUpdate}
            onKeyDown={(e) => handleKeyDown(e, 'update')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center space-x-2"
            aria-label="Update application now"
          >
            <Download className="w-4 h-4" />
            <span>Update Now</span>
          </button>
          <button
            onClick={onExit}
            onKeyDown={(e) => handleKeyDown(e, 'exit')}
            className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
            aria-label="Exit application"
          >
            <X className="w-4 h-4" />
            <span>Exit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForcedUpdateScreen;