"use client";

import React from 'react';

interface LanguageToggleProps {
  currentLang: 'es' | 'en';
  onChange: (lang: 'es' | 'en') => void;
}

export default function LanguageToggle({ currentLang, onChange }: LanguageToggleProps) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900/60 p-1 backdrop-blur-md shadow-[0_0_15px_rgba(0,0,0,0.5)]">
      <button
        onClick={() => onChange('es')}
        className={`px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all duration-300 ease-in-out focus:outline-none cursor-pointer ${
          currentLang === 'es'
            ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)] scale-105'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
        }`}
      >
        ES
      </button>
      <button
        onClick={() => onChange('en')}
        className={`px-4 py-1.5 text-xs sm:text-sm font-bold rounded-md transition-all duration-300 ease-in-out focus:outline-none cursor-pointer ${
          currentLang === 'en'
            ? 'bg-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.3)] scale-105'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
        }`}
      >
        EN
      </button>
    </div>
  );
}
