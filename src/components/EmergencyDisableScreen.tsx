import { X, AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface EmergencyDisableScreenProps {
  releaseNotes: string;
  onExit: () => void;
}

const EmergencyDisableScreen = ({ 
  releaseNotes, 
  onExit 
}: EmergencyDisableScreenProps) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const exitButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management: trap focus within modal
  useEffect(() => {
    // Focus the exit button when modal opens
    setTimeout(() => {
      exitButtonRef.current?.focus();
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
      aria-labelledby="emergency-disable-title"
    >
      <div ref={modalRef} className="bg-slate-800 rounded-lg shadow-2xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-white" />
          </div>
          <h1 id="emergency-disable-title" className="text-2xl font-bold text-white mb-2">Service Unavailable</h1>
          <p className="text-slate-400">
            Kiyya is temporarily unavailable for maintenance.
          </p>
        </div>

        <div className="mb-6">
          <div className="bg-slate-700 rounded-lg p-4 mb-4">
            <h2 className="text-lg font-semibold text-white mb-2">
              Maintenance Notice
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
              ⚠️ The service is temporarily unavailable. Please check back later.
            </p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            ref={exitButtonRef}
            onClick={onExit}
            className="bg-slate-600 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center space-x-2"
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

export default EmergencyDisableScreen;
