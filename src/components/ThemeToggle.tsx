import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { t } from '../i18n';
import '../styles/components/ThemeToggle.css';

interface ThemeToggleProps {
  theme: string;
  toggleTheme: () => void;
}

export function ThemeToggle({ theme, toggleTheme }: ThemeToggleProps) {
  return (
    <button 
      type="button"
      className="theme-toggle-btn" 
      onClick={toggleTheme}
      title={theme === 'dark' ? t('lightTheme') : t('darkTheme')}
    >
      {theme === 'dark' ? (
        <Sun size={20} className="theme-icon sun" />
      ) : (
        <Moon size={20} className="theme-icon moon" />
      )}
    </button>
  );
}