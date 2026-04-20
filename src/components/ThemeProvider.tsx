import React, { useEffect } from 'react';
import { useGlobalState } from '../contexts/GlobalStateContext';

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useGlobalState();

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
