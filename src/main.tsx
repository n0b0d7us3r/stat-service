import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiProvider } from './context/ApiProvider';
import { AuthProvider } from './context/AuthContext';
import './styles/index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApiProvider>
  </StrictMode>,
);
