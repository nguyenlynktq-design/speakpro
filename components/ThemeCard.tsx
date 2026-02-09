
import React from 'react';
import { Theme } from '../types';

interface ThemeCardProps {
  theme: Theme;
  isSelected: boolean;
  onClick: (theme: Theme) => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({ theme, isSelected, onClick }) => {
  return (
    <button
      onClick={() => onClick(theme)}
      className={`p-4 rounded-2xl border-4 transition-all duration-300 flex flex-col items-center justify-center gap-2 group
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-lg scale-105' 
          : 'border-transparent bg-white shadow-sm hover:border-blue-200 hover:shadow-md'
        }`}
    >
      <span className="text-4xl group-hover:scale-110 transition-transform">{theme.icon}</span>
      <span className="font-bold text-gray-700 text-sm md:text-base">{theme.label}</span>
    </button>
  );
};

export default ThemeCard;
