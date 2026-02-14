import { useRef, useEffect } from 'react';

/**
 * Development-only hook for tracking component render counts
 * Logs a warning when render count exceeds 10 to help identify infinite re-render loops
 * 
 * @param componentName - Name of the component being tracked
 * @returns Current render count (only in development mode)
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   useRenderCount('MyComponent');
 *   // ... rest of component
 * }
 * ```
 */
export function useRenderCount(componentName: string): number {
  const renderCount = useRef(0);
  const isDev = import.meta.env.DEV;
  
  useEffect(() => {
    if (isDev) {
      renderCount.current += 1;
      console.log(`[${componentName}] Render count: ${renderCount.current}`);
      
      if (renderCount.current > 10) {
        console.warn(
          `[${componentName}] ⚠️ Excessive re-renders detected! (${renderCount.current} renders)`,
          '\nThis may indicate an infinite re-render loop.',
          '\nCheck for unstable dependencies in useEffect, useCallback, or useMemo.'
        );
      }
    }
  });
  
  return isDev ? renderCount.current : 0;
}
