import React, { createContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; 

export const SettingsContext = createContext({
  lang: 'en',
  setLang: () => {},
  theme: 'light',
  setTheme: () => {},
  t: (k) => k
});

export function SettingsProvider({ children }) {
  const { t, i18n } = useTranslation();
  
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    
    if (theme === 'dark') {
      // Если тема темная:
      document.body.classList.add('theme-dark');
      document.body.setAttribute('data-bs-theme', 'dark');
    } else {
      // Если тема светлая:
      document.body.classList.remove('theme-dark');
      document.body.setAttribute('data-bs-theme', 'light');
    }
  }, [theme]);

  const setLang = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('lang', lang);
  };

  const lang = i18n.language;

  return (
    <SettingsContext.Provider value={{ lang, setLang, theme, setTheme, t }}>
      {children}
    </SettingsContext.Provider>
  );
}