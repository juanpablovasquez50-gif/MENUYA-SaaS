import './index.css';

import { createRoot } from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

document.documentElement.dataset.astryxTheme = 'neutral';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <Theme theme={neutralTheme}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Theme>,
);
