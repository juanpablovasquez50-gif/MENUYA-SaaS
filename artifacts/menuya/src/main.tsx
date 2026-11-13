import './index.css';

import { createRoot } from 'react-dom/client';
import { defineTheme, Theme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

const clickokTheme = defineTheme({
  name: 'clickok',
  extends: neutralTheme,
  tokens: {
    '--color-accent': ['#7656ed', '#927bff'],
    '--color-on-accent': ['#ffffff', '#17112b'],
  },
  components: {
    button: {
      'variant:secondary': {
        backgroundColor: '#f1edff',
        color: '#4f35bd',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: '#ddd5ff',
      },
    },
  },
});

document.documentElement.dataset.astryxTheme = 'clickok';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <Theme theme={clickokTheme}>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </Theme>,
);
