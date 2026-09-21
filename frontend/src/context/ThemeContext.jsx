import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem('speedway-theme') || 'system');
  const [systemTheme, setSystemTheme] = useState(() => (
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  ));

  useEffect(() => {
    localStorage.setItem('speedway-theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    const handleSystemThemeChange = (event) => setSystemTheme(event.matches ? 'light' : 'dark');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, []);

  const toggleTheme = (nextTheme) => {
    setTheme(nextTheme || (prev => prev === 'light' ? 'dark' : 'light'));
  };

  const resolvedTheme = theme === 'system' ? systemTheme : theme;

  // UIProvider renders global overlays outside each account layout. Apply the
  // resolved preference at the document level so those overlays (including
  // logout confirmation) follow light, dark, and system themes too.
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
