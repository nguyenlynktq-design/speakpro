import React, { useState, useEffect } from 'react';
import {
    History, X, Trophy, Clock, Flame, TrendingUp,
    Calendar, Trash2, ChevronDown, ChevronUp, BookOpen, BarChart3
} from 'lucide-react';
import {
    getLessonsGroupedByDay,
    getWeeklySkillAverages,
    getRecentLessons,
    getDailyStreak,
    deleteLessonRecord,
    formatDuration,
    getVietnameseDayName,
    LessonRecord
} from '../services/historyService';

interface HistoryPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const SKILL_LABELS: Record<string, { label: string; color: string; emoji: string }> = {
    pronunciation: { label: 'Phát âm', color: 'bg-pink-500', emoji: '🔊' },
    fluency: { label: 'Lưu loát', color: 'bg-blue-500', emoji: '💨' },
    intonation: { label: 'Ngữ điệu', color: 'bg-purple-500', emoji: '🎵' },
    vocabulary: { label: 'Từ vựng', color: 'bg-green-500', emoji: '📚' },
    grammar: { label: 'Ngữ pháp', color: 'bg-orange-500', emoji: '📝' },
    taskFulfillment: { label: 'Hoàn thành', color: 'bg-cyan-500', emoji: '✅' }
};

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
    const [weeklyData, setWeeklyData] = useState<ReturnType<typeof getLessonsGroupedByDay>>([]);
    const [skillAverages, setSkillAverages] = useState<ReturnType<typeof getWeeklySkillAverages> | null>(null);
    const [recentLessons, setRecentLessons] = useState<LessonRecord[]>([]);
    const [streak, setStreak] = useState(0);
    const [expandedLesson, setExpandedLesson] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
        }
    }, [isOpen]);

    const loadData = () => {
        setWeeklyData(getLessonsGroupedByDay());
        setSkillAverages(getWeeklySkillAverages());
        setRecentLessons(getRecentLessons(10));
        setStreak(getDailyStreak());
    };

    const handleDelete = (id: string) => {
        deleteLessonRecord(id);
        loadData();
    };

    if (!isOpen) return null;

    const maxDailyScore = Math.max(...weeklyData.map(d => d.avgScore), 5);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2.5 rounded-xl">
                            <History className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white">Lịch Sử Học Tập</h2>
                            <p className="text-white/70 text-sm font-medium">7 ngày gần nhất</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all"
                    >
                        <X className="text-white" size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`flex-1 px-6 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'overview'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <BarChart3 size={18} /> Tổng Quan
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 px-6 py-4 font-bold text-sm flex items-center justify-center gap-2 transition-all ${activeTab === 'history'
                                ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <BookOpen size={18} /> Các Bài Học
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
                    {activeTab === 'overview' && skillAverages && (
                        <div className="space-y-6">
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-4 border border-orange-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Flame className="text-orange-500" size={20} />
                                        <span className="text-xs font-bold text-orange-600 uppercase">Streak</span>
                                    </div>
                                    <p className="text-3xl font-black text-orange-600">{streak} <span className="text-lg">ngày</span></p>
                                </div>
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BookOpen className="text-blue-500" size={20} />
                                        <span className="text-xs font-bold text-blue-600 uppercase">Bài học</span>
                                    </div>
                                    <p className="text-3xl font-black text-blue-600">{skillAverages.totalLessons}</p>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="text-green-500" size={20} />
                                        <span className="text-xs font-bold text-green-600 uppercase">Thời gian</span>
                                    </div>
                                    <p className="text-3xl font-black text-green-600">{formatDuration(skillAverages.totalTime)}</p>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-4 border border-purple-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className="text-purple-500" size={20} />
                                        <span className="text-xs font-bold text-purple-600 uppercase">TB Điểm</span>
                                    </div>
                                    <p className="text-3xl font-black text-purple-600">
                                        {skillAverages.totalLessons > 0
                                            ? ((skillAverages.pronunciation + skillAverages.fluency + skillAverages.intonation +
                                                skillAverages.vocabulary + skillAverages.grammar + skillAverages.taskFulfillment) / 6).toFixed(1)
                                            : '0'}
                                    </p>
                                </div>
                            </div>

                            {/* Weekly Chart */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Calendar className="text-slate-500" size={18} />
                                    <h3 className="font-bold text-slate-700">Điểm theo ngày</h3>
                                </div>
                                <div className="flex items-end justify-between gap-2 h-32">
                                    {weeklyData.map((day, i) => (
                                        <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
                                            <div className="w-full flex flex-col items-center">
                                                {day.avgScore > 0 && (
                                                    <span className="text-xs font-bold text-indigo-600 mb-1">{day.avgScore}</span>
                                                )}
                                                <div
                                                    className={`w-full rounded-t-lg transition-all duration-500 ${day.lessons.length > 0
                                                            ? 'bg-gradient-to-t from-indigo-500 to-purple-500'
                                                            : 'bg-slate-200'
                                                        }`}
                                                    style={{
                                                        height: day.avgScore > 0
                                                            ? `${Math.max((day.avgScore / maxDailyScore) * 80, 8)}px`
                                                            : '8px'
                                                    }}
                                                />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-xs font-bold text-slate-500">{getVietnameseDayName(day.date)}</p>
                                                <p className="text-[10px] text-slate-400">{day.lessons.length} bài</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Skills Radar */}
                            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Trophy className="text-amber-500" size={18} />
                                    <h3 className="font-bold text-slate-700">Kỹ năng trung bình</h3>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(SKILL_LABELS).map(([key, { label, color, emoji }]) => {
                                        const value = skillAverages[key as keyof typeof skillAverages] as number;
                                        return (
                                            <div key={key} className="bg-white rounded-xl p-4 border border-slate-100">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span>{emoji}</span>
                                                    <span className="text-sm font-bold text-slate-600">{label}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className={`h-full ${color} transition-all duration-500`}
                                                            style={{ width: `${(value / 5) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="font-black text-slate-700 text-sm w-8">{value}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'history' && (
                        <div className="space-y-3">
                            {recentLessons.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <BookOpen className="text-slate-300" size={32} />
                                    </div>
                                    <p className="text-slate-400 font-bold">Chưa có bài học nào</p>
                                    <p className="text-slate-300 text-sm">Hãy hoàn thành bài thuyết trình đầu tiên!</p>
                                </div>
                            ) : (
                                recentLessons.map((lesson) => {
                                    const isExpanded = expandedLesson === lesson.id;
                                    const lessonDate = new Date(lesson.date);
                                    return (
                                        <div
                                            key={lesson.id}
                                            className="bg-white rounded-2xl border border-slate-100 overflow-hidden transition-all hover:shadow-md"
                                        >
                                            <div
                                                className="p-4 flex items-center justify-between cursor-pointer"
                                                onClick={() => setExpandedLesson(isExpanded ? null : lesson.id)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-white text-lg ${lesson.score >= 4 ? 'bg-green-500' : lesson.score >= 3 ? 'bg-amber-500' : 'bg-red-400'
                                                        }`}>
                                                        {lesson.score.toFixed(1)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{lesson.theme}</h4>
                                                        <div className="flex items-center gap-2 text-xs text-slate-400">
                                                            <span>{lessonDate.toLocaleDateString('vi-VN')}</span>
                                                            <span>•</span>
                                                            <span>{lesson.level}</span>
                                                            <span>•</span>
                                                            <span>{formatDuration(lesson.duration)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(lesson.id); }}
                                                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-2 border-t border-slate-50 bg-slate-50/50 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {Object.entries(SKILL_LABELS).map(([key, { label, emoji }]) => (
                                                            <div key={key} className="text-center p-2 bg-white rounded-lg">
                                                                <p className="text-lg">{emoji}</p>
                                                                <p className="text-xs font-bold text-slate-500">{label}</p>
                                                                <p className="font-black text-slate-700">{lesson[key as keyof LessonRecord] as number}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HistoryPanel;
