
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react";

type Language = "zh" | "en";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Try to get language from localStorage, default to Chinese
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const savedLanguage = localStorage.getItem("language") as Language;
      return savedLanguage === "en" ? "en" : "zh";
    } catch {
      return "zh";
    }
  });

  // Translations object - use ref to prevent re-renders
  const translationsRef = useRef<Record<string, string>>({});
  const [translationsLoaded, setTranslationsLoaded] = useState(false);

  // Stable setLanguage function
  const setLanguage = useCallback((newLanguage: Language) => {
    setLanguageState(newLanguage);
  }, []);

  // Update localStorage when language changes
  useEffect(() => {
    try {
      localStorage.setItem("language", language);
    } catch {
      // Ignore localStorage errors
    }

    // Load translations based on selected language
    const loadTranslations = async () => {
      try {
        const translationModule =
          language === "en"
            ? await import("../translations/en.ts")
            : await import("../translations/zh.ts");

        translationsRef.current = translationModule.default || {};
        setTranslationsLoaded(prev => !prev); // Force re-render only when translations change
      } catch (error) {
        console.error("Failed to load translations:", error);
        translationsRef.current = {};
        setTranslationsLoaded(prev => !prev);
      }
    };

    loadTranslations();
  }, [language]);

  // Translation function - stable reference with ref
  const t = useCallback((key: string): string => {
    return translationsRef.current[key] || key;
  }, [translationsLoaded]); // Only depend on the loaded flag

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    language,
    setLanguage,
    t
  }), [language, setLanguage, t]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
