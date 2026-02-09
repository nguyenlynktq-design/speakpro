import React, { useState, useEffect } from 'react';
import {
    CheckCircle2, XCircle, ChevronRight, Loader2,
    Download, Image, FileText, RotateCcw, HelpCircle, Trophy
} from 'lucide-react';
import { ComprehensionQuestionData, generateComprehensionQuestions } from '../services/geminiService';
import { CEFRLevel } from '../types';

interface ComprehensionQuizProps {
    imageUri: string;
    script: string;
    level: CEFRLevel;
    theme: string;
}

const ComprehensionQuiz: React.FC<ComprehensionQuizProps> = ({ imageUri, script, level, theme }) => {
    const [questions, setQuestions] = useState<ComprehensionQuestionData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([]);
    const [showResult, setShowResult] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);

    const loadQuestions = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const qs = await generateComprehensionQuestions(imageUri, script, level);
            setQuestions(qs);
            setSelectedAnswers(new Array(qs.length).fill(null));
            setCurrentQuestion(0);
            setShowResult(false);
            setShowExplanation(false);
        } catch (err: any) {
            setError(err.message || 'Không thể tạo câu hỏi');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (imageUri && script) {
            loadQuestions();
        }
    }, [imageUri, script]);

    const handleSelectAnswer = (optionIndex: number) => {
        if (showExplanation) return;
        const newAnswers = [...selectedAnswers];
        newAnswers[currentQuestion] = optionIndex;
        setSelectedAnswers(newAnswers);
        setShowExplanation(true);
    };

    const handleNext = () => {
        setShowExplanation(false);
        if (currentQuestion < questions.length - 1) {
            setCurrentQuestion(currentQuestion + 1);
        } else {
            setShowResult(true);
        }
    };

    const handleDownloadImage = () => {
        const link = document.createElement('a');
        link.href = imageUri;
        link.download = `speakpro_${theme.replace(/\s+/g, '_')}_image.png`;
        link.click();
    };

    const handleDownloadScript = () => {
        const content = `SpeakPro - Bài Thuyết Trình
================================
Chủ đề: ${theme}
Trình độ: ${level}
================================

${script}

================================
Powered by SpeakPro • Ms Ly AI
`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `speakpro_${theme.replace(/\s+/g, '_')}_script.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const correctCount = selectedAnswers.filter(
        (ans, i) => ans === questions[i]?.correctIndex
    ).length;

    const currentQ = questions[currentQuestion];
    const selectedAnswer = selectedAnswers[currentQuestion];
    const isCorrect = selectedAnswer === currentQ?.correctIndex;

    if (isLoading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 mt-6">
                <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                    <span className="font-bold text-slate-600">Đang tạo câu hỏi đọc hiểu...</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-2xl border border-red-100 p-6 mt-6">
                <div className="text-center py-4">
                    <p className="text-red-500 font-bold mb-3">{error}</p>
                    <button
                        onClick={loadQuestions}
                        className="px-4 py-2 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all"
                    >
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    if (questions.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden mt-6 shadow-lg">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <HelpCircle className="text-white/80" size={20} />
                    <span className="text-white font-black">Kiểm Tra Đọc Hiểu</span>
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold text-white">
                        {level}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownloadImage}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-bold transition-all"
                        title="Tải ảnh"
                    >
                        <Image size={14} /> Tải ảnh
                    </button>
                    <button
                        onClick={handleDownloadScript}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xs font-bold transition-all"
                        title="Tải bài"
                    >
                        <FileText size={14} /> Tải bài
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            {!showResult && (
                <div className="px-5 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-500">
                            Câu {currentQuestion + 1}/{questions.length}
                        </span>
                        <span className="text-sm font-bold text-green-600">
                            ✓ {correctCount} đúng
                        </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                            style={{ width: `${((currentQuestion + (showExplanation ? 1 : 0)) / questions.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Question or Result */}
            <div className="p-5">
                {showResult ? (
                    <div className="text-center py-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trophy className="text-amber-500" size={40} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">
                            Hoàn Thành!
                        </h3>
                        <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-500 mb-1">
                            {correctCount}/{questions.length}
                        </p>
                        <p className="text-slate-400 font-bold mb-6">câu trả lời đúng</p>

                        {/* All answers summary */}
                        <div className="grid grid-cols-5 gap-2 max-w-md mx-auto mb-6">
                            {questions.map((q, i) => (
                                <div
                                    key={i}
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white ${selectedAnswers[i] === q.correctIndex ? 'bg-green-500' : 'bg-red-400'
                                        }`}
                                >
                                    {i + 1}
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={loadQuestions}
                            className="px-6 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-all flex items-center gap-2 mx-auto"
                        >
                            <RotateCcw size={18} /> Làm lại
                        </button>
                    </div>
                ) : currentQ && (
                    <div className="animate-in fade-in duration-300">
                        {/* Question */}
                        <h4 className="text-lg font-black text-slate-800 mb-4 leading-relaxed">
                            {currentQ.question}
                        </h4>

                        {/* Options */}
                        <div className="space-y-3">
                            {currentQ.options.map((option, i) => {
                                const isSelected = selectedAnswer === i;
                                const isCorrectOption = i === currentQ.correctIndex;
                                let bgColor = 'bg-slate-50 hover:bg-blue-50 border-slate-100';
                                let textColor = 'text-slate-700';

                                if (showExplanation) {
                                    if (isCorrectOption) {
                                        bgColor = 'bg-green-50 border-green-200';
                                        textColor = 'text-green-700';
                                    } else if (isSelected && !isCorrectOption) {
                                        bgColor = 'bg-red-50 border-red-200';
                                        textColor = 'text-red-600';
                                    }
                                } else if (isSelected) {
                                    bgColor = 'bg-blue-50 border-blue-300';
                                    textColor = 'text-blue-700';
                                }

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleSelectAnswer(i)}
                                        disabled={showExplanation}
                                        className={`w-full p-4 rounded-xl border-2 ${bgColor} ${textColor} font-bold text-left transition-all flex items-center gap-3`}
                                    >
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${showExplanation && isCorrectOption ? 'bg-green-500 text-white' :
                                                showExplanation && isSelected && !isCorrectOption ? 'bg-red-400 text-white' :
                                                    'bg-white border border-slate-200 text-slate-500'
                                            }`}>
                                            {String.fromCharCode(65 + i)}
                                        </span>
                                        <span className="flex-1">{option}</span>
                                        {showExplanation && isCorrectOption && <CheckCircle2 className="text-green-500" size={20} />}
                                        {showExplanation && isSelected && !isCorrectOption && <XCircle className="text-red-400" size={20} />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Explanation */}
                        {showExplanation && (
                            <div className={`mt-4 p-4 rounded-xl animate-in slide-in-from-top-2 duration-300 ${isCorrect ? 'bg-green-50 border border-green-100' : 'bg-amber-50 border border-amber-100'
                                }`}>
                                <p className={`font-bold mb-1 ${isCorrect ? 'text-green-600' : 'text-amber-600'}`}>
                                    {isCorrect ? '🎉 Chính xác!' : '💡 Đáp án đúng:'}
                                </p>
                                <p className="text-slate-600 text-sm">{currentQ.explanation}</p>
                            </div>
                        )}

                        {/* Next Button */}
                        {showExplanation && (
                            <button
                                onClick={handleNext}
                                className="w-full mt-4 py-4 bg-blue-600 text-white font-black text-lg rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                            >
                                {currentQuestion < questions.length - 1 ? (
                                    <>Câu tiếp theo <ChevronRight size={20} /></>
                                ) : (
                                    <>Xem kết quả <Trophy size={20} /></>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ComprehensionQuiz;
