import React, { useEffect, useState } from 'react';
import { db, isQuotaError } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data());
      }
    }, (error) => {
      if (!isQuotaError(error)) {
        console.error("Theme settings error:", error);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      if (settings.primaryColor) root.style.setProperty('--primary', settings.primaryColor);
      if (settings.backgroundColor) root.style.setProperty('--background', settings.backgroundColor);
      if (settings.fontFamily) root.style.setProperty('--font-family', settings.fontFamily);
    }
  }, [settings]);

  return (
    <div style={{ fontFamily: settings?.fontFamily || 'inherit' }}>
      {children}
    </div>
  );
}
