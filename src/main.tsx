import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { accent } from './config/accent';
import { locale } from './i18n';
import { ApiProvider } from './context/ApiProvider';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';
import App from './App.tsx';

document.documentElement.dataset.accent = accent;
document.documentElement.lang = locale;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApiProvider>
  </StrictMode>,
);
