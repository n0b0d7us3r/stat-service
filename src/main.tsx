import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DbProvider } from './context/DbContext';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DbProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DbProvider>
  </StrictMode>,
);
