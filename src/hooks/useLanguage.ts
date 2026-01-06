import { useTranslation } from 'react-i18next';
import { useCallback } from 'react';

export const useLanguage = () => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language as 'en' | 'pt';

  const setLanguage = useCallback((lang: 'en' | 'pt') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  }, [i18n]);

  const toggleLanguage = useCallback(() => {
    const newLang = currentLanguage === 'en' ? 'pt' : 'en';
    setLanguage(newLang);
  }, [currentLanguage, setLanguage]);

  return {
    currentLanguage,
    setLanguage,
    toggleLanguage,
  };
};
