import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import sv from './sv.json';
import en from './en.json';

export const LANGUAGES = ['sv', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'basketapp.language';

function storedLanguage(): Language {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'sv' || v === 'en') return v;
  } catch {
    /* storage blocked: fall back to Swedish */
  }
  return 'sv';
}

void i18n.use(initReactI18next).init({
  resources: { sv: { translation: sv }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: 'sv',
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false }, // React escapes already
  returnNull: false,
});

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});
document.documentElement.lang = i18n.language;

export default i18n;
