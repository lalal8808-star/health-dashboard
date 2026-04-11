'use client';

import { useEffect } from 'react';

export default function PWAManager() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('SW registration successful with scope: ', registration.scope);
        } catch (err) {
          console.error('SW registration failed: ', err);
        }
      };

      registerServiceWorker();
    }
  }, []);

  return null;
}
