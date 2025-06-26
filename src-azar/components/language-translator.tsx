"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface TranslatorProps {
  originalText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  onTranslationComplete?: (translatedText: string) => void;
}

export function LanguageTranslator({
  originalText,
  sourceLanguage = 'auto',
  targetLanguage,
  onTranslationComplete
}: TranslatorProps) {
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);

  // Mock language options for UI display
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
  ];

  // Get language name from code
  const getLanguageName = (code: string) => {
    const language = languages.find(lang => lang.code === code);
    return language ? language.name : code;
  };

  // Mock translation function
  const translateText = () => {
    setIsTranslating(true);

    // Detect language (mock implementation)
    const detectedLang = detectLanguage(originalText);
    setDetectedLanguage(detectedLang);

    // Simulating API call delay
    setTimeout(() => {
      // Mock translation - in a real app, this would call a translation API
      const translated = mockTranslate(originalText, targetLanguage);

      setTranslatedText(translated);
      setIsTranslating(false);

      if (onTranslationComplete) {
        onTranslationComplete(translated);
      }
    }, 800);
  };

  // Mock language detection
  const detectLanguage = (text: string): string => {
    // This is a simple mock implementation
    // In a real app, this would use a language detection API

    // Randomly return a language code for demo purposes
    const langs = ['en', 'es', 'fr', 'de', 'it', 'ru', 'zh', 'ja'];
    return langs[Math.floor(Math.random() * langs.length)];
  };

  // Mock translation
  const mockTranslate = (text: string, targetLang: string): string => {
    // This would be replaced with a real translation API
    const greetings: Record<string, string> = {
      'en': 'Hello! How are you today?',
      'es': '¡Hola! ¿Cómo estás hoy?',
      'fr': 'Bonjour! Comment allez-vous aujourd\'hui?',
      'de': 'Hallo! Wie geht es dir heute?',
      'it': 'Ciao! Come stai oggi?',
      'pt': 'Olá! Como você está hoje?',
      'ru': 'Привет! Как ты сегодня?',
      'zh': '你好！今天怎么样？',
      'ja': 'こんにちは！今日はどうですか？',
      'ko': '안녕하세요! 오늘 어떻게 지내세요?',
      'ar': 'مرحبا! كيف حالك اليوم؟',
      'hi': 'नमस्ते! आज आप कैसे हैं?',
    };

    // If it's a short common greeting, return appropriate translation
    if (text.length < 30 && text.toLowerCase().includes('hello') || text.toLowerCase().includes('hi')) {
      return greetings[targetLang] || `Translated to ${getLanguageName(targetLang)}: ${text}`;
    }

    // For other messages, just prepend with language name for demo
    return `Translated to ${getLanguageName(targetLang)}: ${text}`;
  };

  // Translate automatically when component mounts or when text/language changes
  useEffect(() => {
    if (originalText) {
      translateText();
    }
  }, [originalText, targetLanguage]);

  // Toggle between original and translated text
  const toggleOriginal = () => {
    setShowOriginal(!showOriginal);
  };

  if (!originalText) return null;

  return (
    <div className="text-sm">
      {isTranslating ? (
        <div className="flex items-center text-zinc-400 mt-1">
          <div className="h-3 w-3 border-t-2 border-blue-500 border-r-2 rounded-full animate-spin mr-2"></div>
          Translating...
        </div>
      ) : (
        <>
          <div className="text-zinc-300">
            {showOriginal ? originalText : translatedText}
          </div>

          <div className="flex items-center justify-between mt-1 text-xs">
            <div className="text-zinc-500">
              {detectedLanguage && !showOriginal && (
                <>Translated from {getLanguageName(detectedLanguage)}</>
              )}
            </div>

            <button
              onClick={toggleOriginal}
              className="text-blue-400 hover:text-blue-300"
            >
              {showOriginal ? "Show translation" : "Show original"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// LanguageSelector component
interface LanguageSelectorProps {
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

export function LanguageSelector({ selectedLanguage, onLanguageChange }: LanguageSelectorProps) {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'ru', name: 'Russian' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
    { code: 'hi', name: 'Hindi' },
  ];

  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Get current language name
  const currentLanguage = languages.find(lang => lang.code === selectedLanguage)?.name || selectedLanguage;

  return (
    <div className="relative">
      <Button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="bg-zinc-800 hover:bg-zinc-700 text-white text-sm py-1 px-3 h-auto flex items-center"
        aria-haspopup="true"
        aria-expanded={isMenuOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
        {currentLanguage}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </Button>

      {isMenuOpen && (
        <div className="absolute z-10 mt-1 w-48 bg-zinc-800 rounded-md shadow-lg py-1">
          <div className="max-h-60 overflow-y-auto">
            {languages.map(language => (
              <button
                key={language.code}
                className={`w-full text-left px-4 py-2 text-sm ${language.code === selectedLanguage ? 'bg-blue-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}`}
                onClick={() => {
                  onLanguageChange(language.code);
                  setIsMenuOpen(false);
                }}
              >
                {language.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// AutoTranslate toggle component
interface AutoTranslateToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export function AutoTranslateToggle({ enabled, onToggle }: AutoTranslateToggleProps) {
  return (
    <div className="flex items-center">
      <button
        onClick={onToggle}
        className="flex items-center text-sm text-zinc-400 hover:text-white"
      >
        <div className={`w-9 h-5 flex items-center rounded-full p-1 duration-300 ease-in-out ${enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}>
          <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${enabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
        </div>
        <span className="ml-2">Auto-translate</span>
      </button>
    </div>
  );
}
