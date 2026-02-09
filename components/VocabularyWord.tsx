import React, { useState, useRef, useEffect } from 'react';
import { Volume2, X, Loader2, BookOpen } from 'lucide-react';

interface VocabularyWordProps {
    word: string;
    onGetMeaning: (word: string) => Promise<{ meaning: string; phonetic: string; example: string }>;
    onSpeak: (word: string) => void;
}

interface TooltipData {
    meaning: string;
    phonetic: string;
    example: string;
}

const VocabularyWord: React.FC<VocabularyWordProps> = ({ word, onGetMeaning, onSpeak }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const [position, setPosition] = useState<'above' | 'below'>('above');
    const wordRef = useRef<HTMLSpanElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const handleClick = async (e: React.MouseEvent) => {
        e.stopPropagation();

        // Calculate position
        if (wordRef.current) {
            const rect = wordRef.current.getBoundingClientRect();
            const spaceAbove = rect.top;
            const spaceBelow = window.innerHeight - rect.bottom;
            setPosition(spaceAbove > 200 || spaceAbove > spaceBelow ? 'above' : 'below');
        }

        if (isOpen) {
            setIsOpen(false);
            return;
        }

        setIsOpen(true);

        if (!tooltipData) {
            setIsLoading(true);
            try {
                const data = await onGetMeaning(word);
                setTooltipData(data);
            } catch (err) {
                setTooltipData({
                    meaning: 'Không thể tải nghĩa',
                    phonetic: '',
                    example: ''
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSpeak = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSpeak(word);
    };

    // Close tooltip when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node) &&
                wordRef.current && !wordRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [isOpen]);

    // Don't make punctuation clickable
    const cleanWord = word.replace(/[.,!?;:'"()]/g, '');
    if (!cleanWord || cleanWord.length < 2) {
        return <span>{word} </span>;
    }

    return (
        <span className="relative inline-block">
            <span
                ref={wordRef}
                onClick={handleClick}
                className={`cursor-pointer transition-all duration-200 rounded px-0.5 -mx-0.5 ${isOpen
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-yellow-100 hover:text-yellow-700 active:bg-yellow-200'
                    }`}
            >
                {word}
            </span>
            {' '}

            {isOpen && (
                <div
                    ref={tooltipRef}
                    className={`absolute z-[100] w-72 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 ${position === 'above'
                            ? 'bottom-full mb-2 left-1/2 -translate-x-1/2'
                            : 'top-full mt-2 left-1/2 -translate-x-1/2'
                        }`}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen className="text-white/80" size={16} />
                            <span className="text-white font-black text-lg">{cleanWord}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleSpeak}
                                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all active:scale-90"
                                title="Nghe phát âm"
                            >
                                <Volume2 className="text-white" size={16} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-all"
                            >
                                <X className="text-white" size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-4 gap-2 text-slate-400">
                                <Loader2 className="animate-spin" size={20} />
                                <span className="text-sm font-medium">Đang tải...</span>
                            </div>
                        ) : tooltipData ? (
                            <div className="space-y-3">
                                {tooltipData.phonetic && (
                                    <div className="text-sm text-slate-400 font-medium">
                                        {tooltipData.phonetic}
                                    </div>
                                )}
                                <div className="text-base font-bold text-slate-800">
                                    🇻🇳 {tooltipData.meaning}
                                </div>
                                {tooltipData.example && (
                                    <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 italic border border-slate-100">
                                        "{tooltipData.example}"
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* Arrow */}
                    <div
                        className={`absolute w-3 h-3 bg-white border-slate-100 rotate-45 left-1/2 -translate-x-1/2 ${position === 'above'
                                ? '-bottom-1.5 border-r border-b'
                                : '-top-1.5 border-l border-t'
                            }`}
                    />
                </div>
            )}
        </span>
    );
};

// Helper component to render text with clickable words
interface InteractiveTextProps {
    text: string;
    onGetMeaning: (word: string) => Promise<{ meaning: string; phonetic: string; example: string }>;
    onSpeak: (word: string) => void;
    className?: string;
}

export const InteractiveText: React.FC<InteractiveTextProps> = ({
    text,
    onGetMeaning,
    onSpeak,
    className = ''
}) => {
    // Split text into words while preserving punctuation
    const words = text.split(/\s+/);

    return (
        <span className={className}>
            {words.map((word, index) => (
                <VocabularyWord
                    key={`${word}-${index}`}
                    word={word}
                    onGetMeaning={onGetMeaning}
                    onSpeak={onSpeak}
                />
            ))}
        </span>
    );
};

export default VocabularyWord;
