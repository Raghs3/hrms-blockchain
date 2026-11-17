import { useEffect } from 'react';

/**
 * useDocumentTitle - Updates the browser document title per page.
 * Restores previous title on unmount.
 *
 * @param {string} title
 */
export function useDocumentTitle(title) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} | HealthChain` : 'HealthChain — Healthcare Record System';
    return () => {
      document.title = previous;
    };
  }, [title]);
}

export default useDocumentTitle;

