import React from 'react';
import { Sun, Moon } from 'lucide-react';
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
      title={theme === 'dark' ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
    >
      {theme === 'dark' ? (
        <Sun size={20} className="theme-icon sun" />
      ) : (
        <Moon size={20} className="theme-icon moon" />
      )}
    </button>
  );
}