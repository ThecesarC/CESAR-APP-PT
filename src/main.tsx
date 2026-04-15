import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler to catch and silence Firestore internal assertion failures
// which often occur when quota is exceeded.
window.addEventListener('error', (event) => {
  if (event.message?.includes('FIRESTORE') && event.message?.includes('INTERNAL ASSERTION FAILED')) {
    event.preventDefault();
    return;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('FIRESTORE') && event.reason?.message?.includes('INTERNAL ASSERTION FAILED')) {
    event.preventDefault();
    return;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
